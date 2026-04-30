import type { Span, GraphNode, GraphEdge, GraphCluster, GraphSegment } from "@threadgraph/shared";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validatePass1(spans: Span[]): ValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const span of spans) {
    if (ids.has(span.id)) {
      errors.push(`Duplicate span id: ${span.id}`);
    }
    ids.add(span.id);
  }

  // Warn (but don't fail) on non-sequential IDs
  const nums = [...ids]
    .map((id) => parseInt(id.replace("s_", ""), 10))
    .sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      // Non-sequential — log but continue
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validatePass2(spans: Span[], nodes: GraphNode[]): ValidationResult {
  const errors: string[] = [];
  const spanIds = new Set(spans.map((s) => s.id));

  if (nodes.length !== spans.length) {
    errors.push(`Conservation violation: ${nodes.length} nodes for ${spans.length} spans`);
  }

  for (const node of nodes) {
    if (!spanIds.has(node.span_id)) {
      errors.push(`Reference integrity: node ${node.id} references unknown span ${node.span_id}`);
    }
    if (node.id !== `n_${node.span_id}`) {
      errors.push(`Naming integrity: node.id ${node.id} should be n_${node.span_id}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validatePass3(
  nodes: GraphNode[],
  edges: GraphEdge[],
  clusters: GraphCluster[],
  segments: GraphSegment[],
  turnCount: number
): ValidationResult {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const clusterMembership = new Map<string, string>();

  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) errors.push(`Edge integrity: unknown node ${edge.from}`);
    if (!nodeIds.has(edge.to)) errors.push(`Edge integrity: unknown node ${edge.to}`);
  }

  for (const cluster of clusters) {
    for (const nodeId of cluster.node_ids) {
      if (!nodeIds.has(nodeId)) {
        errors.push(`Cluster integrity: unknown node ${nodeId} in cluster ${cluster.id}`);
      }
      if (clusterMembership.has(nodeId)) {
        errors.push(
          `Cluster exclusivity: node ${nodeId} appears in both ${clusterMembership.get(nodeId)} and ${cluster.id}`
        );
      }
      clusterMembership.set(nodeId, cluster.id);
    }
  }

  const covered = new Array<boolean>(turnCount).fill(false);
  for (const seg of segments) {
    if (seg.turn_end < seg.turn_start) {
      errors.push(`Segment ${seg.id}: turn_end (${seg.turn_end}) < turn_start (${seg.turn_start})`);
      continue;
    }
    for (let t = seg.turn_start; t <= seg.turn_end; t++) {
      if (t >= turnCount) {
        errors.push(`Segment ${seg.id}: turn ${t} out of range (turnCount=${turnCount})`);
      } else if (covered[t]) {
        errors.push(`Segment coverage: turn ${t} covered by multiple segments`);
      } else {
        covered[t] = true;
      }
    }
  }
  for (let t = 0; t < turnCount; t++) {
    if (!covered[t]) errors.push(`Segment coverage: turn ${t} not covered by any segment`);
  }

  return { ok: errors.length === 0, errors };
}

// Deduplicate spans in the overlap region by label similarity (Levenshtein > 0.85)
export function deduplicateSpans(spans: Span[]): Span[] {
  const result: Span[] = [];

  for (const span of spans) {
    const isDuplicate = result.some((existing) => {
      const sim = levenshteinSimilarity(existing.text, span.text);
      return sim > 0.85 && existing.source_turn <= span.source_turn;
    });

    if (!isDuplicate) result.push(span);
  }

  return result;
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a.slice(0, 100), b.slice(0, 100));
  return 1 - dist / Math.max(a.slice(0, 100).length, b.slice(0, 100).length);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
