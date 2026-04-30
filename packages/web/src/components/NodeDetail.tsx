import type { GraphNode, RawTurn } from "@threadgraph/shared";

interface Props {
  node: GraphNode;
  rawTurns: RawTurn[];
  onClose: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  insight: "💡", decision: "✅", question: "❓",
  problem: "⚠️", action: "🎯", reference: "🔗", draft: "📝",
};

export default function NodeDetail({ node, rawTurns, onClose }: Props) {
  const sourceTurn = rawTurns[node.span.source_turn];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-white/10 p-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm">{TYPE_ICONS[node.type]}</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{node.type}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              node.status === "explored" ? "bg-green-900 text-green-300" :
              node.status === "open" ? "bg-yellow-900 text-yellow-300" :
              "bg-gray-800 text-gray-400"
            }`}>
              {node.status}
            </span>
          </div>
          <h3 className="text-base font-semibold text-white">{node.label}</h3>
        </div>
        <button onClick={onClose} className="ml-2 shrink-0 text-gray-500 hover:text-white">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Summary</p>
          <p className="text-sm text-gray-300 leading-relaxed">{node.summary}</p>
        </div>

        {node.tags.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {node.tags.map((t) => (
                <span key={t} className="rounded bg-white/10 px-2 py-0.5 text-xs text-gray-300">{t}</span>
              ))}
            </div>
          </div>
        )}

        {sourceTurn && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">
              Source — Turn {node.span.source_turn + 1} ({sourceTurn.role}{sourceTurn.time ? ` · ${sourceTurn.time}` : ""})
            </p>
            <div className="rounded-lg bg-gray-800 p-3">
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-6">
                {sourceTurn.content}
              </p>
            </div>
            {node.span.text && (
              <div className="mt-2 rounded-lg border-l-2 border-brand-500 bg-gray-800/50 px-3 py-2">
                <p className="text-xs text-gray-400 italic">"{node.span.text}"</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
