# Data Model: Raw Conversation to Pixels

This document describes how ThreadGraph transforms a raw conversation transcript into an interactive knowledge graph — every type, every relationship, and every rendering decision, end to end.

---

## The Three-Pass Pipeline

The transformation happens in three sequential LLM passes. Each pass builds on the output of the previous one. The raw transcript never changes; each pass adds a layer of structure on top of it.

```
Raw transcript
    │
    ▼ Pass 1 — Extract
  Spans[]          "what moments matter?"
    │
    ▼ Pass 2 — Classify
  GraphNode[]      "what kind of moment is each one?"
    │
    ▼ Pass 3 — Structure
  GraphEdge[]      "how are they related?"
  GraphCluster[]   "which ones belong together spatially?"
  GraphSegment[]   "how did the conversation evolve over time?"
    │
    ▼ Assembled into
  Graph            "one object, persisted to the database"
    │
    ▼ Fetched by the web app
  Canvas / Lenses  "rendered as an interactive graph"
```

---

## Layer 1 — RawTurns (the source of truth)

A `RawTurn` is a single exchange in the conversation as the user originally pasted it. Nothing about it is ever changed or inferred.

| Field | Description |
|---|---|
| `turn` | 0-based index — the position in the conversation |
| `role` | `"Prompt"` (user) or `"Response"` (assistant) |
| `time` | Timestamp string |
| `content` | Full text of the turn |

RawTurns are not rendered directly on the canvas. They appear only in the **node detail sidebar**, showing the original excerpt that a node was derived from.

---

## Layer 2 — Spans (Pass 1 output)

Pass 1 reads the entire transcript and extracts up to a budget of conceptually meaningful moments. A `Span` is a short quoted excerpt — the raw semantic material before any classification.

| Field | Description |
|---|---|
| `id` | Format: `s_<number>` (e.g. `s_3`) |
| `text` | The key quote or paraphrase, up to 800 chars |
| `source_turn` | Index into `raw_turns[]` — which turn this came from |
| `source_segment_order` | `0`, `1`, or `2` — position within the turn if multiple spans came from the same turn |
| `additional_turns` | Other turn indices this concept spans, if it crosses turns |
| `role` | `"human"` or `"ai"` |

**Key facts about Spans:**
- A single turn can produce **0 to 3 spans**. A filler turn ("ok, thanks") produces zero. A dense turn with multiple distinct ideas can produce up to three.
- Spans are not deduplicated. If the same idea appears in turn 3 and turn 15, Pass 1 may extract two separate spans. This is intentional — re-emergence is meaningful and is handled later as a `revisits` relationship rather than being silently collapsed.
- The `source_segment_order` is just a disambiguator, not a literal split of the turn into thirds.

---

## Layer 3 — GraphNodes (Pass 2 output)

Pass 2 takes every span from Pass 1 and classifies it into a typed, labelled node. The relationship is exactly **1 span → 1 node**, no exceptions. The node ID is mechanically derived: `n_` + span ID (e.g. `s_3` → `n_s_3`).

| Field | Description |
|---|---|
| `id` | Format: `n_s_<number>` |
| `span_id` | Back-reference to the source span |
| `span` | The full embedded Span object |
| `type` | Semantic classification (see table below) |
| `label` | Short human-readable title, up to 120 chars |
| `summary` | 1–2 sentence explanation, up to 600 chars |
| `status` | Lifecycle state: `explored`, `open`, or `abandoned` |
| `source_turn` | Copied from the span |
| `source_segment_order` | Copied from the span |
| `source_segments` | Deduplicated, sorted array of all turn indices this node spans |
| `tags` | Up to 8 keyword tags |

### Node types and their visual treatment

| Type | Meaning | Card color |
|---|---|---|
| `insight` | Non-obvious realization, hypothesis, or substantive claim | Purple |
| `decision` | Resolved choice with commitment language ("we'll use X") | Green |
| `question` | Open or unresolved inquiry | Yellow |
| `problem` | Named obstacle, constraint, or failure mode | Red |
| `action` | Concrete next step or task | Blue |
| `reference` | External citation — URL, paper, named expert | Cyan |
| `draft` | Content created during the session — code, doc, outline | Orange |

### Node status and its visual treatment

| Status | Meaning | Indicator |
|---|---|---|
| `explored` | Addressed or resolved | Green dot |
| `open` | Still unresolved or needs follow-up | Yellow dot |
| `abandoned` | Mentioned then dropped without resolution | Gray dot |

Each node renders as a **220×110px card** on the canvas, showing the type icon, status dot, label (2-line clamp), and up to 4 tags as pills.

---

## Layer 4 — GraphEdges, GraphClusters, GraphSegments (Pass 3 output)

Pass 3 sees all nodes at once and builds three kinds of structure simultaneously.

### GraphEdges — relationships between nodes

| Field | Description |
|---|---|
| `from` | Source node ID |
| `to` | Target node ID |
| `relation` | Type of relationship (see table below) |
| `label` | Optional override label, up to 80 chars |
| `risk` | Boolean flag — `true` when a `contradicts` edge touches a `decision` node |

### Edge relation types

| Relation | Meaning | Direction | Visual |
|---|---|---|---|
| `spawned` | Node A directly caused or generated node B | A → B (causal, forward) | Animated dashed indigo arrow |
| `elaborates` | Node B expands on or adds detail about node A | A → B (logical) | Solid green arrow |
| `contradicts` | The two nodes are in tension | Canonical: lower ID → higher ID | Solid red arrow |
| `resolves` | Node A resolves or answers node B | A → B | Solid yellow arrow |
| `revisits` | Node B (later in the conversation) returns to the same core concept as node A (earlier) after a meaningful gap | B → A (later → earlier, backward in time) | Dashed slate arrow, thinner stroke |

**On `revisits`:** this relation exists specifically to preserve the temporal dimension when an idea re-emerges. Rather than merging two similar nodes into one (which loses the information that the concept came back), both nodes are kept and a `revisits` edge connects them. The later node points back to the earlier one. The status and type on each node tell the story of how the concept evolved — a `question` node that `revisits` an earlier `question` that was `abandoned` tells a very different story than a `decision` node that `revisits` an earlier `question` that was `explored`.

### GraphClusters — spatial groupings

Clusters drive the layout of the canvas. Each cluster is a named thematic group of nodes.

| Field | Description |
|---|---|
| `id` | Format: `c_<number>` |
| `label` | Cluster name, up to 60 chars |
| `summary` | Explanation of the grouping, up to 600 chars |
| `node_ids` | Ordered list of node IDs in this cluster |

**Layout algorithm:** clusters tile left-to-right. Within each cluster, nodes arrange in a grid of up to 3 columns. Nodes not in any cluster (orphans) are placed in a row below all clusters at y=600.

### GraphSegments — temporal phases

Segments classify the conversational *mode* across the full turn range. Every turn belongs to exactly one segment, with no gaps.

| Field | Description |
|---|---|
| `id` | Format: `seg_<number>` |
| `type` | Phase classification (see table below) |
| `turn_start` | First turn in the segment (inclusive) |
| `turn_end` | Last turn in the segment (inclusive) |
| `label` | Plain-language description of what was happening, up to 60 chars |

| Segment type | Meaning |
|---|---|
| `exploring` | Open-ended discovery, following tangents, no clear destination |
| `learning` | User receiving explanation or absorbing information asymmetrically |
| `deciding` | Weighing options, converging toward a choice |
| `building` | Constructing something concrete — architecture, code, a plan |
| `drafting` | Iterating on linguistic content — documents, emails, narratives |
| `debugging` | Diagnosing something broken, narrowing toward a fix |
| `critiquing` | Stress-testing a position, reviewing work |
| `synthesising` | Thinking out loud, reflecting, using the model as a sounding board |

Segments are **only used by the Timeline lens**. The main canvas does not render them.

---

## The Graph Object

Everything above is assembled into a single `Graph` object, persisted to the `graphs.graph_json` column in PostgreSQL:

```
Graph {
  nodes:    GraphNode[]     — all typed, labelled nodes
  edges:    GraphEdge[]     — all relationships between nodes
  clusters: GraphCluster[]  — thematic spatial groups
  segments: GraphSegment[]  — temporal conversational phases
  raw_turns: RawTurn[]      — original transcript, unchanged
}
```

---

## Rendering: Canvas View

The canvas view converts the `Graph` into a ReactFlow scene.

**Layout (deterministic):**
1. Clusters tile left-to-right, with nodes in each cluster arranged in a ≤3-column grid
2. Orphan nodes (not in any cluster) placed in a row below at y=600
3. Node dimensions: 220×110px, 60px horizontal gap, 80px vertical gap, 40px cluster padding

**Nodes** → ReactFlow nodes, each rendered as a typed card by `GraphNodeComponent`

**Edges** → ReactFlow edges, styled by relation:
- `spawned` — animated, indigo (`#818cf8`)
- `elaborates` — solid, green (`#34d399`)
- `contradicts` — solid, red (`#f87171`)
- `resolves` — solid, yellow (`#fbbf24`)
- `revisits` — dashed (`6 3`), slate (`#64748b`), slightly thinner stroke — visually reads as connective tissue rather than a primary logical relation

**Node detail sidebar:** clicking a node opens a right panel showing the full label, summary, all tags, the source turn metadata, the full turn text from `raw_turns[]`, and the extracted span text highlighted within it.

---

## Rendering: Alternative Lenses

All lenses operate on the same `Graph` object — no re-fetching, just different rendering logic.

| Lens | What it shows |
|---|---|
| **Graph canvas** | Full ReactFlow canvas, cluster-based spatial layout |
| **Built & Decided** | Filtered list of `decision`, `action`, `insight` nodes only, grouped by cluster |
| **Timeline** | Segments as chronological colored bands; `decision` and `insight` nodes anchored to their segment; `revisits` edges shown as `↩ revisits earlier [type]: [label]` beneath the later node |
| **Reentry Brief** | Summary-style read-out for returning to the conversation |
| **Risks & Open** | Nodes with `open` status and edges flagged `risk: true` |
| **Share** | Export-oriented view |

**Timeline and revisits:** the Timeline lens is where the temporal value of `revisits` is most visible. When a key node (decision or insight) has a `revisits` edge, a small indicator appears beneath it showing what earlier concept it returned to and what type that earlier concept was. This lets a reader trace an idea's full arc — from first emergence through re-emergence to eventual resolution (or continued open state) — without leaving the timeline view.

---

## Full Relationship Chain

```
RawTurn  ──── source of quoted text in node detail sidebar
   │
   │  Pass 1 extracts 0–3 Spans per turn
   ▼
 Span    ──── embedded in its GraphNode for quick access
   │
   │  Pass 2 classifies exactly 1 Node per Span
   ▼
GraphNode ── rendered as a card on the canvas
   │
   ├── grouped by ──► GraphCluster  → drives canvas spatial layout
   │
   ├── linked by ───► GraphEdge     → arrows on canvas
   │                   ├── spawned / elaborates / contradicts / resolves  (logical)
   │                   └── revisits  (temporal — later node → earlier node)
   │
   └── phased by ───► GraphSegment  → colored bands in Timeline lens only
```
