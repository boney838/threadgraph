import type { Graph, GraphNode } from "@threadgraph/shared";

const RELEVANT_TYPES = new Set(["decision", "action", "insight"]);

const TYPE_ICONS: Record<string, string> = {
  insight: "💡",
  decision: "✅",
  action: "🎯",
};

const STATUS_PILL: Record<string, string> = {
  explored: "bg-green-900/60 text-green-300 ring-green-700/50",
  open: "bg-yellow-900/60 text-yellow-300 ring-yellow-700/50",
  abandoned: "bg-gray-800 text-gray-500 ring-gray-700/50",
};

const STATUS_DOT: Record<string, string> = {
  explored: "bg-green-400",
  open: "bg-yellow-400",
  abandoned: "bg-gray-500",
};

function NodeCard({ node }: { node: GraphNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-gray-900 p-3 ring-1 ring-white/10">
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[node.status] ?? "bg-gray-500"}`} title={node.status} />
        <span className="text-base leading-none">{TYPE_ICONS[node.type] ?? ""}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-white leading-snug">{node.label}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${STATUS_PILL[node.status]}`}>
            {node.status}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-gray-400">{node.summary}</p>
        {node.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {node.tags.slice(0, 5).map((t) => (
              <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BuiltDecidedLens({ graph }: { graph: Graph }) {
  const relevantNodes = graph.nodes.filter((n) => RELEVANT_TYPES.has(n.type));
  const nodeById = Object.fromEntries(relevantNodes.map((n) => [n.id, n]));

  const clusteredGroups = graph.clusters
    .map((c) => ({
      cluster: c,
      nodes: c.node_ids.flatMap((id) => (nodeById[id] ? [nodeById[id]] : [])),
    }))
    .filter((g) => g.nodes.length > 0);

  const clusteredIds = new Set(graph.clusters.flatMap((c) => c.node_ids));
  const unclustered = relevantNodes.filter((n) => !clusteredIds.has(n.id));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-1 text-lg font-semibold text-white">What was built / decided</h2>
        <p className="mb-6 text-sm text-gray-500">Decision, action, and insight nodes — grouped by cluster.</p>

        {relevantNodes.length === 0 && (
          <p className="text-sm text-gray-500">No decision, action, or insight nodes found.</p>
        )}

        {clusteredGroups.map(({ cluster, nodes }) => (
          <div key={cluster.id} className="mb-8">
            <div className="mb-3 border-b border-white/10 pb-2">
              <h3 className="text-sm font-semibold text-gray-200">{cluster.label}</h3>
              {cluster.summary && (
                <p className="mt-0.5 text-xs text-gray-500">{cluster.summary}</p>
              )}
            </div>
            <div className="space-y-2">
              {nodes.map((n) => <NodeCard key={n.id} node={n} />)}
            </div>
          </div>
        ))}

        {unclustered.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 border-b border-white/10 pb-2">
              <h3 className="text-sm font-semibold text-gray-500">Unclustered</h3>
            </div>
            <div className="space-y-2">
              {unclustered.map((n) => <NodeCard key={n.id} node={n} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
