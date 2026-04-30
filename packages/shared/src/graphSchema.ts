import { z } from "zod";

// ── Span (Pass 1 output, embedded in Node) ────────────────────────────────────
export const SpanSchema = z.object({
  id: z.string().regex(/^s_\d+$/, "span id must match s_<number>"),
  text: z.string().min(1).max(800),
  source_turn: z.number().int().nonnegative(),
  source_segment_order: z.number().int().min(0).max(2),
  additional_turns: z.array(z.number().int().nonnegative()).default([]),
  role: z.enum(["human", "ai"]),
});

// ── Node (Pass 2 output) ──────────────────────────────────────────────────────
export const NodeTypeSchema = z.enum([
  "insight",
  "decision",
  "question",
  "problem",
  "action",
  "reference",
  "draft",
]);

export const NodeStatusSchema = z.enum(["explored", "open", "abandoned"]);

export const NodeSchema = z.object({
  id: z.string().regex(/^n_s_\d+$/, "node id must match n_s_<number>"),
  span_id: z.string().regex(/^s_\d+$/),
  type: NodeTypeSchema,
  label: z.string().min(1).max(120),
  summary: z.string().min(1).max(600),
  status: NodeStatusSchema,
  source_turn: z.number().int().nonnegative(),
  source_segment_order: z.number().int().min(0).max(2),
  source_segments: z.array(z.number().int().nonnegative()).min(1),
  tags: z.array(z.string()).max(8),
  span: SpanSchema,
});

// ── Edge (Pass 3 output) ──────────────────────────────────────────────────────
export const EdgeRelationSchema = z.enum([
  "spawned",
  "elaborates",
  "contradicts",
  "resolves",
]);

export const EdgeSchema = z
  .object({
    from: z.string().regex(/^n_s_\d+$/),
    to: z.string().regex(/^n_s_\d+$/),
    relation: EdgeRelationSchema,
    label: z.string().max(80).optional(),
  })
  .refine(
    (e) => e.relation !== "contradicts" || e.from < e.to,
    { message: "contradicts edges must use canonical direction (from < to)" }
  )
  .refine((e) => e.from !== e.to, { message: "edges cannot be self-loops" });

// ── Cluster (Pass 3 output) ───────────────────────────────────────────────────
export const ClusterSchema = z.object({
  id: z.string().regex(/^c_\d+$/),
  label: z.string().min(1).max(60),
  summary: z.string().min(1).max(600),
  node_ids: z.array(z.string().regex(/^n_s_\d+$/)).min(1),
});

// ── Raw turn (original transcript) ───────────────────────────────────────────
export const RawTurnSchema = z.object({
  turn: z.number().int().nonnegative(),
  role: z.enum(["Prompt", "Response"]),
  time: z.string(),
  content: z.string(),
});

// ── Pipeline-pass output schemas (worker only, not stored) ───────────────────
export const Pass1OutputSchema = z.object({ spans: z.array(SpanSchema) });
export const Pass2OutputSchema = z.object({ nodes: z.array(NodeSchema) });
export const Pass3OutputSchema = z.object({
  edges: z.array(EdgeSchema),
  clusters: z.array(ClusterSchema),
});

// ── Top-level graph (assembled by worker, persisted to graphs.graph_json) ─────
export const GraphSchema = z.object({
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  clusters: z.array(ClusterSchema),
  raw_turns: z.array(RawTurnSchema),
});

// ── TypeScript types ──────────────────────────────────────────────────────────
export type Graph = z.infer<typeof GraphSchema>;
export type GraphNode = z.infer<typeof NodeSchema>;
export type GraphEdge = z.infer<typeof EdgeSchema>;
export type GraphCluster = z.infer<typeof ClusterSchema>;
export type Span = z.infer<typeof SpanSchema>;
export type RawTurn = z.infer<typeof RawTurnSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type EdgeRelation = z.infer<typeof EdgeRelationSchema>;
