import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { GraphNode as TGNode } from "@threadgraph/shared";

const TYPE_STYLES: Record<string, string> = {
  insight: "border-purple-500 bg-purple-950/60",
  decision: "border-green-500 bg-green-950/60",
  question: "border-yellow-500 bg-yellow-950/60",
  problem: "border-red-500 bg-red-950/60",
  action: "border-blue-500 bg-blue-950/60",
  reference: "border-cyan-500 bg-cyan-950/60",
  draft: "border-orange-500 bg-orange-950/60",
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

const STATUS_DOT: Record<string, string> = {
  explored: "bg-green-400",
  open: "bg-yellow-400",
  abandoned: "bg-gray-500",
};

export type GraphNodeData = Node<{ node: TGNode }, "graphNode">;

function GraphNodeComponent({ data, selected }: NodeProps<GraphNodeData>) {
  const { node } = data;
  const styleClass = TYPE_STYLES[node.type] ?? "border-gray-500 bg-gray-900";

  return (
    <div
      className={`relative w-52 rounded-xl border px-3 py-3 shadow-lg transition-all ${styleClass} ${
        selected ? "ring-2 ring-white" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />

      {/* Type badge + status dot */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-300">
          <span>{TYPE_ICONS[node.type]}</span>
          {node.type}
        </span>
        <span
          className={`h-2 w-2 rounded-full ${STATUS_DOT[node.status] ?? "bg-gray-500"}`}
          title={node.status}
        />
      </div>

      {/* Label */}
      <p className="text-sm font-semibold leading-snug text-white line-clamp-2">{node.label}</p>

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {node.tags.slice(0, 4).map((tag: string) => (
            <span key={tag} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
    </div>
  );
}

export default memo(GraphNodeComponent);
