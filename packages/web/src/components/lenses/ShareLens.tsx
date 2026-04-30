import type { Graph, GraphNode } from "@threadgraph/shared";

const TYPE_ICONS: Record<string, string> = {
  insight: "💡",
  decision: "✅",
  question: "❓",
  problem: "⚠️",
  action: "🎯",
  reference: "🔗",
  draft: "📝",
};

function NodeRow({ node }: { node: GraphNode }) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <span className="mt-0.5 shrink-0">{TYPE_ICONS[node.type] ?? ""}</span>
      <div>
        <p className="text-sm font-medium text-gray-200">{node.label}</p>
        <p className="text-xs leading-relaxed text-gray-500">{node.summary}</p>
      </div>
    </li>
  );
}

export default function ShareLens({ graph }: { graph: Graph }) {
  const summaryText = graph.clusters
    .slice(0, 3)
    .map((c) => c.summary)
    .filter(Boolean)
    .join(" ");

  const decisions = graph.nodes.filter((n) => n.type === "decision");

  // Artifacts: action and draft nodes represent things built/produced.
  // (The schema has no "produced" edge type; action/draft nodes are the closest semantic match.)
  const artifacts = graph.nodes.filter(
    (n) => n.type === "action" || n.type === "draft"
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-white">Share with someone</h2>
          <p className="text-sm text-gray-500">
            A handoff view for someone who wasn't in the conversation.
          </p>
        </div>

        {/* Plain-language summary */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">What this was about</h3>
          <p className="text-sm leading-relaxed text-gray-300">
            {summaryText || "No summary available."}
          </p>
        </section>

        {/* Key decisions */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Key decisions <span className="text-gray-600">({decisions.length})</span>
          </h3>
          {decisions.length === 0 ? (
            <p className="text-xs text-gray-600">No decision nodes recorded.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {decisions.map((n) => <NodeRow key={n.id} node={n} />)}
            </ul>
          )}
        </section>

        {/* Artifacts produced */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Artifacts produced <span className="text-gray-600">({artifacts.length})</span>
          </h3>
          {artifacts.length === 0 ? (
            <p className="text-xs text-gray-600">No action or draft nodes recorded.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {artifacts.map((n) => <NodeRow key={n.id} node={n} />)}
            </ul>
          )}
        </section>

        {/* All clusters for broader context */}
        {graph.clusters.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Topics covered</h3>
            <ul className="space-y-2">
              {graph.clusters.map((c) => (
                <li key={c.id} className="rounded-lg bg-gray-900 p-3 ring-1 ring-white/10">
                  <p className="text-sm font-medium text-gray-200">{c.label}</p>
                  {c.summary && (
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{c.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
