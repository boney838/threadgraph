import type { Graph, GraphSegment } from "@threadgraph/shared";

const SEGMENT_COLORS: Record<string, string> = {
  exploring: "bg-blue-900/60 text-blue-300 ring-blue-700/50",
  learning: "bg-cyan-900/60 text-cyan-300 ring-cyan-700/50",
  deciding: "bg-green-900/60 text-green-300 ring-green-700/50",
  building: "bg-orange-900/60 text-orange-300 ring-orange-700/50",
  drafting: "bg-amber-900/60 text-amber-300 ring-amber-700/50",
  debugging: "bg-red-900/60 text-red-300 ring-red-700/50",
  critiquing: "bg-purple-900/60 text-purple-300 ring-purple-700/50",
  synthesising: "bg-indigo-900/60 text-indigo-300 ring-indigo-700/50",
};

function SegmentTag({ type }: { type: GraphSegment["type"] }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${SEGMENT_COLORS[type] ?? "bg-gray-800 text-gray-400"}`}>
      {type}
    </span>
  );
}

export default function ReentryBriefLens({ graph }: { graph: Graph }) {
  const summaryText = graph.clusters
    .slice(0, 3)
    .map((c) => c.summary)
    .filter(Boolean)
    .join(" ");

  const lastSegment = graph.segments[graph.segments.length - 1];

  const confirmed = graph.nodes.filter(
    (n) => n.type === "decision" && n.status === "explored"
  );

  const openNodes = graph.nodes.filter((n) => n.status === "open");
  const riskEdges = graph.edges.filter((e) => e.risk);

  const nodeById = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h2 className="mb-1 text-lg font-semibold text-white">Re-entry brief</h2>
          <p className="text-sm text-gray-500">Catch up fast after a gap.</p>
        </div>

        {/* Thread summary */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">What this thread was about</h3>
          <p className="text-sm leading-relaxed text-gray-300">
            {summaryText || "No cluster summaries available."}
          </p>
        </section>

        {/* Where it ended */}
        {lastSegment && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Where it ended</h3>
            <div className="rounded-lg bg-gray-900 p-4 ring-1 ring-white/10">
              <div className="mb-2 flex items-center gap-2">
                <SegmentTag type={lastSegment.type} />
                <span className="text-sm font-medium text-white">{lastSegment.label}</span>
              </div>
              <p className="text-xs text-gray-500">
                Turns {lastSegment.turn_start}–{lastSegment.turn_end}
              </p>
            </div>
          </section>
        )}

        {/* Confirmed */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Confirmed <span className="text-gray-600">({confirmed.length})</span>
          </h3>
          {confirmed.length === 0 ? (
            <p className="text-xs text-gray-600">No explored decisions yet.</p>
          ) : (
            <ul className="space-y-2">
              {confirmed.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-green-400">✓</span>
                  <span className="text-gray-300">{n.label}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Still open */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
            Still open <span className="text-gray-600">({openNodes.length + riskEdges.length})</span>
          </h3>
          {openNodes.length === 0 && riskEdges.length === 0 ? (
            <p className="text-xs text-gray-600">Nothing flagged as open.</p>
          ) : (
            <ul className="space-y-2">
              {openNodes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-yellow-400">○</span>
                  <span className="text-gray-300">{n.label}</span>
                </li>
              ))}
              {riskEdges.map((e, i) => {
                const from = nodeById[e.from];
                const to = nodeById[e.to];
                return (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 shrink-0 text-red-400">⚠</span>
                    <span className="text-gray-300">
                      Risk: <span className="text-gray-200">{from?.label ?? e.from}</span>
                      {" "}→{" "}
                      <span className="text-gray-200">{to?.label ?? e.to}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
