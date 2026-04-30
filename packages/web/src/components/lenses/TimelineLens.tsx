import type { Graph, GraphNode, GraphSegment, GraphEdge } from "@threadgraph/shared";

const SEGMENT_COLORS: Record<
  string,
  { band: string; tag: string }
> = {
  exploring:  { band: "border-blue-700/40 bg-blue-950/20",    tag: "bg-blue-900/60 text-blue-300 ring-blue-700/50" },
  learning:   { band: "border-cyan-700/40 bg-cyan-950/20",    tag: "bg-cyan-900/60 text-cyan-300 ring-cyan-700/50" },
  deciding:   { band: "border-green-700/40 bg-green-950/20",  tag: "bg-green-900/60 text-green-300 ring-green-700/50" },
  building:   { band: "border-orange-700/40 bg-orange-950/20",tag: "bg-orange-900/60 text-orange-300 ring-orange-700/50" },
  drafting:   { band: "border-amber-700/40 bg-amber-950/20",  tag: "bg-amber-900/60 text-amber-300 ring-amber-700/50" },
  debugging:  { band: "border-red-700/40 bg-red-950/20",      tag: "bg-red-900/60 text-red-300 ring-red-700/50" },
  critiquing: { band: "border-purple-700/40 bg-purple-950/20",tag: "bg-purple-900/60 text-purple-300 ring-purple-700/50" },
  synthesising:{ band: "border-indigo-700/40 bg-indigo-950/20",tag: "bg-indigo-900/60 text-indigo-300 ring-indigo-700/50" },
};

const FALLBACK_COLORS = {
  band: "border-gray-700/40 bg-gray-900/20",
  tag: "bg-gray-800 text-gray-400 ring-gray-700/50",
};

const TYPE_ICONS: Record<string, string> = {
  insight: "💡",
  decision: "✅",
};

type RevisitsTarget = { label: string; type: string };

function SegmentBand({
  segment,
  anchoredNodes,
  revisitsMap,
}: {
  segment: GraphSegment;
  anchoredNodes: GraphNode[];
  revisitsMap: Map<string, RevisitsTarget[]>;
}) {
  const colors = SEGMENT_COLORS[segment.type] ?? FALLBACK_COLORS;

  return (
    <div className={`rounded-xl border p-4 ${colors.band}`}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${colors.tag}`}
        >
          {segment.type}
        </span>
        <span className="text-sm font-medium text-white">{segment.label}</span>
        <span className="ml-auto text-xs text-gray-600">
          turns {segment.turn_start}–{segment.turn_end}
        </span>
      </div>

      {/* Anchored key nodes */}
      {anchoredNodes.length > 0 && (
        <div className="space-y-1.5">
          {anchoredNodes.map((n) => {
            const revisited = revisitsMap.get(n.id) ?? [];
            return (
              <div
                key={n.id}
                className="rounded-lg bg-gray-900/60 px-3 py-2 ring-1 ring-white/10"
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-sm">{TYPE_ICONS[n.type] ?? ""}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-200">{n.label}</p>
                    <p className="text-[10px] leading-relaxed text-gray-500">{n.summary}</p>
                  </div>
                </div>
                {revisited.map((r, i) => (
                  <div key={i} className="mt-1.5 flex items-center gap-1.5 pl-6">
                    <span className="text-[10px] text-gray-600">↩</span>
                    <span className="text-[10px] text-gray-500">
                      revisits earlier {r.type}:
                    </span>
                    <span className="text-[10px] text-gray-400 italic truncate">{r.label}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TimelineLens({ graph }: { graph: Graph }) {
  if (graph.segments.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
        No segments — run the pipeline on a transcript to generate timeline data.
      </div>
    );
  }

  // Sort segments chronologically
  const sortedSegments = [...graph.segments].sort(
    (a, b) => a.turn_start - b.turn_start
  );

  // Key node types to anchor in the timeline
  const KEY_TYPES = new Set(["decision", "insight"]);
  const keyNodes = graph.nodes.filter((n) => KEY_TYPES.has(n.type));

  // Map each key node to the earliest segment that covers any of its source_segments (turn numbers)
  function nodeSegmentIndex(node: GraphNode): number {
    for (let i = 0; i < sortedSegments.length; i++) {
      const seg = sortedSegments[i];
      const overlaps = node.source_segments.some(
        (turn) => turn >= seg.turn_start && turn <= seg.turn_end
      );
      if (overlaps) return i;
    }
    return -1;
  }

  // Group key nodes by their segment index
  const nodesBySegment = new Map<number, GraphNode[]>();
  for (const node of keyNodes) {
    const idx = nodeSegmentIndex(node);
    if (idx === -1) continue;
    if (!nodesBySegment.has(idx)) nodesBySegment.set(idx, []);
    nodesBySegment.get(idx)!.push(node);
  }

  // Build map from later-node-id → earlier nodes it revisits
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const revisitsMap = new Map<string, RevisitsTarget[]>();
  for (const edge of graph.edges as GraphEdge[]) {
    if (edge.relation !== "revisits") continue;
    const earlier = nodeById.get(edge.to);
    if (!earlier) continue;
    if (!revisitsMap.has(edge.from)) revisitsMap.set(edge.from, []);
    revisitsMap.get(edge.from)!.push({ label: earlier.label, type: earlier.type });
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-1 text-lg font-semibold text-white">Timeline</h2>
        <p className="mb-6 text-sm text-gray-500">
          Conversational phases in order, with key decisions and insights anchored to their segment.
        </p>

        <div className="space-y-3">
          {sortedSegments.map((seg, i) => (
            <SegmentBand
              key={seg.id}
              segment={seg}
              anchoredNodes={nodesBySegment.get(i) ?? []}
              revisitsMap={revisitsMap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
