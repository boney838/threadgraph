import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeTypes,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api, type GraphRecord } from "../api/client.ts";
import type { GraphNode, GraphEdge, GraphCluster, RawTurn } from "@threadgraph/shared";
import GraphNodeComponent, { type GraphNodeData } from "../components/GraphNode.tsx";
import NodeDetail from "../components/NodeDetail.tsx";

const NODE_TYPES: NodeTypes = { graphNode: GraphNodeComponent };

const RELATION_COLORS: Record<string, string> = {
  spawned: "#818cf8",
  elaborates: "#34d399",
  contradicts: "#f87171",
  resolves: "#fbbf24",
};

function buildLayout(
  nodes: GraphNode[],
  clusters: GraphCluster[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const NODE_W = 220, NODE_H = 110, PAD_X = 60, PAD_Y = 80;
  const CLUSTER_PAD = 40;

  let clusterOffsetX = CLUSTER_PAD;

  for (const cluster of clusters) {
    const cols = Math.min(3, cluster.node_ids.length);
    let row = 0, col = 0;
    const clusterOffsetY = CLUSTER_PAD;

    for (const nodeId of cluster.node_ids) {
      positions[nodeId] = {
        x: clusterOffsetX + col * (NODE_W + PAD_X),
        y: clusterOffsetY + row * (NODE_H + PAD_Y),
      };
      col++;
      if (col >= cols) { col = 0; row++; }
    }

    const clusterWidth = cols * (NODE_W + PAD_X) + CLUSTER_PAD * 2;
    clusterOffsetX += clusterWidth + CLUSTER_PAD * 2;
  }

  // Orphans — place below clusters
  const orphans = nodes.filter((n) => !(n.id in positions));
  let orphanX = CLUSTER_PAD, orphanY = 600;
  for (const orphan of orphans) {
    positions[orphan.id] = { x: orphanX, y: orphanY };
    orphanX += NODE_W + PAD_X;
    if (orphanX > 1400) { orphanX = CLUSTER_PAD; orphanY += NODE_H + PAD_Y; }
  }

  return positions;
}

function toFlowNodes(nodes: GraphNode[], positions: Record<string, { x: number; y: number }>): GraphNodeData[] {
  return nodes.map((n) => ({
    id: n.id,
    type: "graphNode" as const,
    position: positions[n.id] ?? { x: 0, y: 0 },
    data: { node: n },
  }));
}

function toFlowEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e, i) => ({
    id: `e_${i}_${e.from}_${e.to}`,
    source: e.from,
    target: e.to,
    label: e.label ?? e.relation,
    animated: e.relation === "spawned",
    style: { stroke: RELATION_COLORS[e.relation] ?? "#6b7280" },
    markerEnd: { type: MarkerType.ArrowClosed, color: RELATION_COLORS[e.relation] ?? "#6b7280" },
    labelStyle: { fill: "#9ca3af", fontSize: 10 },
    labelBgStyle: { fill: "#111827", fillOpacity: 0.8 },
  }));
}

export default function Canvas() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<GraphRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState("");

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<GraphNodeData>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!id) return;
    api.getGraph(id)
      .then((r) => {
        setRecord(r);
        setTitle(r.title);
        const g = r.graph_json;
        const positions = buildLayout(g.nodes, g.clusters);
        setFlowNodes(toFlowNodes(g.nodes, positions));
        setFlowEdges(toFlowEdges(g.edges));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, setFlowNodes, setFlowEdges]);

  const rawTurns = useMemo(
    () => (record?.graph_json.raw_turns ?? []) as RawTurn[],
    [record]
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: GraphNodeData) => {
      setSelectedNode(node.data.node);
    },
    []
  );

  const saveTitle = async () => {
    if (!id || title === record?.title) { setIsEditingTitle(false); return; }
    await api.updateGraphTitle(id, title).catch(() => {});
    setIsEditingTitle(false);
  };

  const exportGraph = async (fmt: "json" | "markdown") => {
    if (!id) return;
    const res = await api.exportGraph(id, fmt);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-${id}.${fmt === "json" ? "json" : "md"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">Loading graph…</div>;
  if (error) return <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">{error}</div>;

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      {/* Top bar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-gray-900 px-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs text-gray-500 hover:text-white">← Graphs</Link>
          {isEditingTitle ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              autoFocus
              className="rounded bg-gray-800 px-2 py-0.5 text-sm text-white outline-none ring-1 ring-brand-500"
            />
          ) : (
            <button
              onClick={() => setIsEditingTitle(true)}
              className="text-sm font-medium text-white hover:text-gray-300"
              title="Click to rename"
            >
              {title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-gray-500 sm:inline">
            {record?.graph_json.nodes.length ?? 0} nodes · {record?.graph_json.edges.length ?? 0} edges
          </span>
          <button onClick={() => exportGraph("json")} className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">
            JSON
          </button>
          <button onClick={() => exportGraph("markdown")} className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700">
            MD
          </button>
        </div>
      </div>

      {/* Canvas + sidebar */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Cluster legend */}
        {record && record.graph_json.clusters.length > 0 && (
          <div className="absolute left-3 top-3 z-10 max-w-48 rounded-xl bg-gray-900/90 p-3 ring-1 ring-white/10 backdrop-blur">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Clusters</p>
            {record.graph_json.clusters.map((c: GraphCluster) => (
              <div key={c.id} className="mb-1">
                <p className="text-xs font-medium text-gray-200">{c.label}</p>
                <p className="text-[10px] text-gray-500">{c.node_ids.length} nodes</p>
              </div>
            ))}
          </div>
        )}

        {/* React Flow canvas */}
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={NODE_TYPES}
          fitView
          className="flex-1"
          style={{ background: "#030712" }}
        >
          <Background color="#1f2937" gap={20} />
          <Controls className="[&>button]:bg-gray-800 [&>button]:border-gray-700 [&>button]:text-gray-300" />
          <MiniMap
            nodeColor={(n) => {
              const type = (n.data as { node?: GraphNode })?.node?.type;
              const colors: Record<string, string> = {
                insight: "#7c3aed", decision: "#16a34a", question: "#d97706",
                problem: "#dc2626", action: "#2563eb", reference: "#0891b2", draft: "#ea580c",
              };
              return colors[type ?? ""] ?? "#6b7280";
            }}
            className="!bg-gray-900 !border-gray-700"
          />
        </ReactFlow>

        {/* Node detail panel */}
        {selectedNode && (
          <div className="w-72 shrink-0 border-l border-white/10 bg-gray-900 overflow-hidden">
            <NodeDetail
              node={selectedNode}
              rawTurns={rawTurns}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
