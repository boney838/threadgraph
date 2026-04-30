import Anthropic from "@anthropic-ai/sdk";
import {
  Pass1OutputSchema,
  Pass2OutputSchema,
  Pass3OutputSchema,
  type Span,
  type GraphNode,
  type RawTurn,
} from "@threadgraph/shared";
import { pass1User, PASS1_SYSTEM, pass2User, PASS2_SYSTEM, pass3User, PASS3_SYSTEM } from "./prompts.js";
import { calculateSpanBudget, chunkTurns } from "./budget.js";
import { validatePass1, validatePass2, validatePass3, deduplicateSpans } from "./validation.js";
import { turnsToTranscriptString } from "./transcript.js";
import { logger } from "../logger.js";

const PIPELINE_VERSION = "2.1.0";

// Pricing for claude-sonnet-4-6 in USD per token
const PRICE_INPUT_PER_TOKEN = 3.0 / 1_000_000;
const PRICE_OUTPUT_PER_TOKEN = 15.0 / 1_000_000;

export interface PassUsage {
  pass: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface PipelineUsage {
  passes: PassUsage[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
}

function computeCost(inputTokens: number, outputTokens: number): number {
  return inputTokens * PRICE_INPUT_PER_TOKEN + outputTokens * PRICE_OUTPUT_PER_TOKEN;
}

export { PIPELINE_VERSION };

interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

async function callLLM(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<LLMResult> {
  const delays = [5000, 10000, 20000];

  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = msg.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") throw new Error("No text block in LLM response");

      // Strip any accidental markdown fences
      const text = block.text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      return { text, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Anthropic.RateLimitError ||
        (err instanceof Error && err.message.includes("429"));

      if (isRateLimit && attempt < 2) {
        logger.warn(`Rate limited; backoff ${delays[attempt]}ms (attempt ${attempt + 1})`);
        await sleep(delays[attempt]);
        continue;
      }
      throw err;
    }
  }

  throw new Error("LLM call failed after rate-limit retries");
}

function sanitizeSpans(raw: unknown[]): unknown[] {
  return raw.map((s: any) => ({
    ...s,
    text: typeof s.text === "string" ? s.text.slice(0, 800) : s.text,
  }));
}

function sanitizeNodes(raw: unknown[]): unknown[] {
  return raw.map((n: any) => ({
    ...n,
    label: typeof n.label === "string" ? n.label.slice(0, 120) : n.label,
    summary: typeof n.summary === "string" ? n.summary.slice(0, 600) : n.summary,
    tags: Array.isArray(n.tags) ? n.tags.slice(0, 8) : n.tags,
    span: n.span ? { ...n.span, text: typeof n.span?.text === "string" ? n.span.text.slice(0, 800) : n.span?.text } : n.span,
  }));
}

function sanitizeEdges(raw: unknown[]): unknown[] {
  return raw.map((e: any) => ({
    ...e,
    // Normalize common alternative field names the LLM uses instead of from/to
    from: e.from ?? e.source ?? e.source_id ?? e.from_id,
    to: e.to ?? e.target ?? e.target_id ?? e.to_id,
  }));
}

function sanitizeClusters(raw: unknown[]): unknown[] {
  return raw.map((c: any) => ({
    ...c,
    label: typeof c.label === "string" ? c.label.slice(0, 60) : c.label,
    summary: typeof c.summary === "string" ? c.summary.slice(0, 600) : c.summary,
  }));
}

function sanitizeSegments(raw: unknown[]): unknown[] {
  return raw.map((s: any) => ({
    ...s,
    label: typeof s.label === "string" ? s.label.slice(0, 60) : s.label,
  }));
}

async function runPass1(
  client: Anthropic,
  turns: RawTurn[]
): Promise<{ spans: Span[]; inputTokens: number; outputTokens: number }> {
  const budget = calculateSpanBudget(turns.length);
  const transcript = turnsToTranscriptString(turns);
  const userPrompt = pass1User(transcript, budget, turns.length);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, inputTokens, outputTokens } = await callLLM(client, PASS1_SYSTEM, userPrompt, 4096);
      const json = JSON.parse(text);
      if (Array.isArray(json.spans)) json.spans = sanitizeSpans(json.spans);
      const result = Pass1OutputSchema.parse(json);
      const check = validatePass1(result.spans);
      if (!check.ok) throw new Error(`Pass 1 validation: ${check.errors.join("; ")}`);
      return { spans: result.spans, inputTokens, outputTokens };
    } catch (err) {
      if (attempt === 0) {
        logger.warn({ err }, "Pass 1 failed, retrying once");
        continue;
      }
      throw err;
    }
  }

  throw new Error("Pass 1 failed after retry");
}

async function runPass2(
  client: Anthropic,
  spans: Span[]
): Promise<{ nodes: GraphNode[]; inputTokens: number; outputTokens: number }> {
  const userPrompt = pass2User(spans);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, inputTokens, outputTokens } = await callLLM(client, PASS2_SYSTEM, userPrompt, 16000);
      const json = JSON.parse(text);
      // Reattach span objects (not asked from LLM to halve output size)
      const spanMap = new Map(spans.map((s) => [s.id, s]));
      if (Array.isArray(json.nodes)) {
        json.nodes = json.nodes.map((n: any) => ({ ...n, span: spanMap.get(n.span_id) }));
        json.nodes = sanitizeNodes(json.nodes);
      }
      const result = Pass2OutputSchema.parse(json);
      const check = validatePass2(spans, result.nodes);
      if (!check.ok) throw new Error(`Pass 2 validation: ${check.errors.join("; ")}`);

      // Log status distribution
      const dist = result.nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.status] = (acc[n.status] ?? 0) + 1;
        return acc;
      }, {});
      logger.info({ statusDist: dist, total: result.nodes.length }, "Pass 2 status distribution");

      return { nodes: result.nodes, inputTokens, outputTokens };
    } catch (err) {
      if (attempt === 0) {
        logger.warn({ err }, "Pass 2 failed, retrying once");
        continue;
      }
      throw err;
    }
  }

  throw new Error("Pass 2 failed after retry");
}

function nodesForPass3(nodes: GraphNode[]): object[] {
  return nodes.map(({ span: _span, span_id: _spanId, source_segment_order: _sso, source_segments: _ss, ...rest }) => rest);
}

async function runPass3(
  client: Anthropic,
  nodes: GraphNode[],
  turnCount: number
): Promise<{ edges: unknown[]; clusters: unknown[]; segments: unknown[]; inputTokens: number; outputTokens: number }> {
  const strippedNodes = nodesForPass3(nodes);
  const userPrompt = pass3User(strippedNodes, turnCount);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, inputTokens, outputTokens } = await callLLM(client, PASS3_SYSTEM, userPrompt, 4096);
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        logger.error({ text }, "Pass 3 JSON parse failed — raw LLM output above");
        throw new Error("Pass 3 returned invalid JSON");
      }
      logger.debug({ edgeSample: json.edges?.slice(0, 2) }, "Pass 3 raw edge sample");
      if (Array.isArray(json.edges)) json.edges = sanitizeEdges(json.edges);
      if (Array.isArray(json.clusters)) json.clusters = sanitizeClusters(json.clusters);
      if (Array.isArray(json.segments)) json.segments = sanitizeSegments(json.segments);
      const result = Pass3OutputSchema.parse(json);
      const check = validatePass3(nodes, result.edges, result.clusters, result.segments, turnCount);

      if (!check.ok) throw new Error(`Pass 3 validation: ${check.errors.join("; ")}`);

      const orphanCount = nodes.filter(
        (n) => !result.clusters.some((c) => c.node_ids.includes(n.id))
      ).length;
      if (orphanCount > 0) logger.info({ orphanCount }, "Pass 3: orphan nodes detected");

      return { ...result, inputTokens, outputTokens };
    } catch (err) {
      if (attempt === 0) {
        logger.warn({ err }, "Pass 3 failed, retrying once");
        continue;
      }
      throw err;
    }
  }

  throw new Error("Pass 3 failed after retry");
}

export async function runPipeline(
  apiKey: string,
  rawTurns: RawTurn[]
): Promise<{ nodes: GraphNode[]; edges: unknown[]; clusters: unknown[]; segments: unknown[]; usage: PipelineUsage }> {
  const client = new Anthropic({ apiKey });

  let allSpans: Span[];
  let pass1InputTokens = 0;
  let pass1OutputTokens = 0;

  if (rawTurns.length > 80) {
    // Chunked Pass 1
    logger.info({ turnCount: rawTurns.length }, "Long thread — chunking before Pass 1");
    const chunks = chunkTurns(rawTurns);
    const chunkResults = await Promise.all(chunks.map((chunk) => runPass1(client, chunk)));

    for (const r of chunkResults) {
      pass1InputTokens += r.inputTokens;
      pass1OutputTokens += r.outputTokens;
    }

    // Re-index source_turn to global offsets and merge
    const merged: Span[] = [];
    let chunkStart = 0;
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const spans = chunkResults[ci].spans.map((s: Span) => ({
        ...s,
        source_turn: s.source_turn + chunkStart,
        additional_turns: s.additional_turns.map((t: number) => t + chunkStart),
      }));
      merged.push(...spans);
      chunkStart += chunk.length - (ci < chunks.length - 1 ? 10 : 0);
    }

    allSpans = deduplicateSpans(merged);
    allSpans = allSpans.map((s, i) => ({ ...s, id: `s_${i + 1}` }));
  } else {
    const r = await runPass1(client, rawTurns);
    allSpans = r.spans;
    pass1InputTokens = r.inputTokens;
    pass1OutputTokens = r.outputTokens;
  }

  logger.info({ spanCount: allSpans.length }, "Pass 1 complete");

  const pass2 = await runPass2(client, allSpans);
  logger.info({ nodeCount: pass2.nodes.length }, "Pass 2 complete");

  const pass3 = await runPass3(client, pass2.nodes, rawTurns.length);
  logger.info({ edgeCount: (pass3.edges as unknown[]).length, clusterCount: (pass3.clusters as unknown[]).length, segmentCount: (pass3.segments as unknown[]).length }, "Pass 3 complete");

  const passes: PassUsage[] = [
    { pass: "pass1", inputTokens: pass1InputTokens, outputTokens: pass1OutputTokens, costUsd: computeCost(pass1InputTokens, pass1OutputTokens) },
    { pass: "pass2", inputTokens: pass2.inputTokens, outputTokens: pass2.outputTokens, costUsd: computeCost(pass2.inputTokens, pass2.outputTokens) },
    { pass: "pass3", inputTokens: pass3.inputTokens, outputTokens: pass3.outputTokens, costUsd: computeCost(pass3.inputTokens, pass3.outputTokens) },
  ];

  const totalInputTokens = passes.reduce((sum, p) => sum + p.inputTokens, 0);
  const totalOutputTokens = passes.reduce((sum, p) => sum + p.outputTokens, 0);
  const usage: PipelineUsage = {
    passes,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd: passes.reduce((sum, p) => sum + p.costUsd, 0),
  };

  logger.info({ usage }, "Pipeline usage summary");

  return { nodes: pass2.nodes, edges: pass3.edges, clusters: pass3.clusters, segments: pass3.segments, usage };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
