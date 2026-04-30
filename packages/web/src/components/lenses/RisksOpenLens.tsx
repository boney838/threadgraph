import type { Graph, GraphEdge, GraphNode } from "@threadgraph/shared";

const RELATION_LABELS: Record<string, string> = {
  spawned: "spawned",
  elaborates: "elaborates",
  contradicts: "contradicts",
  resolves: "resolves",
};

const TYPE_ICONS: Record<string, string> = {
  insight: "💡",
  decision: "✅",
  question: "❓",
  problem: "⚠️",
  action: "🎯",
  reference: "🔗",
  draft: "📝",
};

function RiskEdgeCard({
  edge,
  from,
  to,
}: {
  edge: GraphEdge;
  from: GraphNode | undefined;
  to: GraphNode | undefined;
}) {
  return (
    <div className="rounded-lg bg-gray-900 p-4 ring-1 ring-red-700/40">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-200">
              {from?.label ?? edge.from}
            </span>
            <span className="text-xs text-gray-600">
              {RELATION_LABELS[edge.relation] ?? edge.relation}
            </span>
            <span className="text-sm font-medium text-gray-200">
              {to?.label ?? edge.to}
            </span>
          </div>
          {edge.label && (
            <p className="mt-1 text-xs text-gray-500 italic">"{edge.label}"</p>
          )}
          {(from?.summary || to?.summary) && (
            <div className="mt-2 space-y-1">
              {from?.summary && (
                <p className="text-xs text-gray-500">
                  <span className="text-gray-600">From:</span> {from.summary}
                </p>
              )}
              {to?.summary && (
                <p className="text-xs text-gray-500">
                  <span className="text-gray-600">To:</span> {to.summary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OpenNodeCard({ node }: { node: GraphNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-gray-900 p-3 ring-1 ring-yellow-700/30">
      <span className="mt-0.5 shrink-0">{TYPE_ICONS[node.type] ?? ""}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-200">{node.label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{node.summary}</p>
      </div>
    </div>
  );
}

export default function RisksOpenLens({ graph }: { graph: Graph }) {
  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));

  const riskEdges = graph.edges.filter((e) => e.risk);
  const openNodes = graph.nodes.filter(
    (n) => n.status === "open" || n.type === "question"
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-white">Risks and open questions</h2>
          <p className="text-sm text-gray-500">Tensions flagged as risks and unresolved threads.</p>
        </div>

        {/* Risks */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Risks <span className="text-gray-600">({riskEdges.length})</span>
          </h3>
          {riskEdges.length === 0 ? (
            <p className="text-xs text-gray-600">No edges flagged as risks.</p>
          ) : (
            <div className="space-y-3">
              {riskEdges.map((e, i) => (
                <RiskEdgeCard
                  key={i}
                  edge={e}
                  from={nodeById[e.from]}
                  to={nodeById[e.to]}
                />
              ))}
            </div>
          )}
        </section>

        {/* Open questions */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Open questions <span className="text-gray-600">({openNodes.length})</span>
          </h3>
          {openNodes.length === 0 ? (
            <p className="text-xs text-gray-600">No open or question nodes found.</p>
          ) : (
            <div className="space-y-2">
              {openNodes.map((n) => (
                <OpenNodeCard key={n.id} node={n} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
