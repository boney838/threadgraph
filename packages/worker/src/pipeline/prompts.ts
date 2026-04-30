// LLM prompt templates for the three-pass pipeline.
// Template variables are substituted by the worker before each call.

export const PASS1_SYSTEM = `You are a precise transcript analyst. Your job is to segment an AI conversation transcript into meaningful conceptual spans — distinct moments where an important idea, decision, question, problem, action, reference, or draft artifact emerged.

Return ONLY valid JSON. No prose, no markdown fences. Follow the schema exactly.`;

export function pass1User(
  transcript: string,
  spanBudget: number,
  turnCount: number
): string {
  return `Analyze this AI conversation transcript (${turnCount} turns) and extract up to ${spanBudget} conceptual spans.

A span captures one key idea per turn segment. Rules:
- Each span must have a unique id in format s_<number> (s_1, s_2, ...)
- text: the key quote or paraphrase (max 800 chars)
- source_turn: 0-based turn index
- source_segment_order: 0, 1, or 2 (position within that turn if multiple spans per turn)
- additional_turns: array of other turn indices this concept spans (empty [] if single-turn)
- role: "human" if from the user, "ai" if from the assistant

Return JSON: { "spans": [ ...SpanSchema ] }

TRANSCRIPT:
${transcript}`;
}

export const PASS2_SYSTEM = `You are a knowledge graph classifier. Given a list of conversation spans, classify each one as a typed node.

Return ONLY valid JSON. No prose, no markdown fences. Follow the schema exactly.

Node types:
- insight: substantive ideas, claims, framings, non-obvious realizations, hypotheses
- decision: resolved choice with commitment language ("we'll use X", "decided to Y")
- question: open or unresolved inquiry (regardless of whether answered)
- problem: named obstacle, constraint, or failure mode
- action: concrete next step or task
- reference: external citation (URL, paper, book, named expert) — NOT mentioned tools/libraries
- draft: content created during the session (email, doc, code snippet, outline)

Status distribution target: ~60% explored, ~25% open, ~15% abandoned.
- explored: concept was addressed or resolved
- open: still unresolved or needs follow-up
- abandoned: mentioned then dropped without resolution

IMPORTANT: Produce EXACTLY one node per span. node.id must equal "n_" + span.id.`;

export function pass2User(spans: object[]): string {
  return `Classify each of these ${spans.length} spans into typed nodes.

For each node:
- id: "n_" + span.id (e.g. if span.id is "s_3", node.id is "n_s_3")
- span_id: the span's id
- type: one of insight/decision/question/problem/action/reference/draft
- label: concise title (max 120 chars)
- summary: 1-2 sentence explanation (max 600 chars)
- status: explored/open/abandoned
- source_turn: copy from span
- source_segment_order: copy from span
- source_segments: [span.source_turn, ...span.additional_turns] deduplicated and sorted
- tags: array of keyword tags (max 8, empty [] if none)

Return JSON: { "nodes": [ ...NodeSchema ] }

SPANS:
${JSON.stringify(spans, null, 2)}`;
}

export const PASS3_SYSTEM = `You are a knowledge graph architect. Given classified nodes from a conversation, build the graph structure: edges and clusters.

Return ONLY valid JSON. No prose, no markdown fences. Follow the schema exactly.

Edge relations:
- spawned: node A directly caused or generated node B
- elaborates: node B expands on or provides detail about node A
- contradicts: node A and B are in tension (use canonical direction: from.id < to.id alphabetically)
- resolves: node A resolves or answers node B (a question, problem, or open action)

Cluster rules:
- Group thematically related nodes into named clusters
- Each cluster needs: id (c_<number>), label (max 60 chars), summary (max 600 chars), node_ids
- A node may appear in at most one cluster
- Orphan nodes (not in any cluster) are allowed`;

export function pass3User(nodes: object[]): string {
  return `Build the graph structure for these ${nodes.length} nodes.

Create edges between causally or semantically related nodes, and group them into thematic clusters.

Return JSON: { "edges": [ ...EdgeSchema ], "clusters": [ ...ClusterSchema ] }

NODES:
${JSON.stringify(nodes, null, 2)}`;
}
