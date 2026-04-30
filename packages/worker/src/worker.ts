import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { PrismaClient } from "@prisma/client";
import { decryptApiKey } from "./crypto.js";
import { parseTranscript } from "./pipeline/transcript.js";
import { runPipeline, PIPELINE_VERSION } from "./pipeline/runner.js";
import { logger } from "./logger.js";

// ── Startup validation ────────────────────────────────────────────────────────
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
if (!ENCRYPTION_SECRET || ENCRYPTION_SECRET.length < 64) {
  logger.fatal("ENCRYPTION_SECRET must be at least 64 hex chars. Refusing to start.");
  process.exit(1);
}

const db = new PrismaClient();
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

// ── Worker ────────────────────────────────────────────────────────────────────
const worker = new Worker(
  "parse-thread",
  async (job) => {
    const { jobId, userId } = job.data as { jobId: string; userId: string };
    logger.info({ jobId, userId }, "Processing job");

    // 1. Fetch & validate job
    const jobRecord = await db.job.findUnique({ where: { id: jobId } });
    if (!jobRecord || jobRecord.status !== "queued") {
      logger.warn({ jobId }, "Job not found or not queued — skipping");
      return;
    }

    await db.job.update({ where: { id: jobId }, data: { status: "processing" } });

    try {
      // 2. Resolve API key
      let apiKey: string;
      if (process.env.DISABLE_AUTH === "true") {
        const envKey = process.env.ANTHROPIC_API_KEY;
        if (!envKey) throw Object.assign(new Error("ANTHROPIC_API_KEY env var required when DISABLE_AUTH=true"), { code: "KEY_NOT_CONFIGURED" });
        apiKey = envKey;
      } else {
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user?.anthropic_key_encrypted || !user.anthropic_key_iv) {
          throw Object.assign(new Error("No API key configured"), { code: "KEY_NOT_CONFIGURED" });
        }
        apiKey = decryptApiKey(user.anthropic_key_encrypted, user.anthropic_key_iv, ENCRYPTION_SECRET!);
      }

      // 3. Retrieve transcript metadata stored in error_message (see jobs route)
      const meta = JSON.parse(jobRecord.error_message ?? "{}") as {
        transcript: string;
        source_platform: "claude" | "chatgpt";
        source_url?: string;
        title?: string;
      };

      // 4. Parse transcript into RawTurn[]
      const rawTurns = parseTranscript(meta.transcript, meta.source_platform);
      logger.info({ jobId, turnCount: rawTurns.length }, "Transcript parsed");

      // 5. Run 3-pass pipeline
      const { nodes, edges, clusters, segments, usage } = await runPipeline(apiKey, rawTurns);

      // 6. Assemble graph payload
      const graphJson = { nodes, edges, clusters, segments, raw_turns: rawTurns };

      // 7. Persist to graph record
      const title =
        meta.title ??
        meta.source_url ??
        `Thread ${new Date().toLocaleDateString()}`;

      await db.graph.update({
        where: { id: jobRecord.graph_id! },
        data: {
          title,
          source_platform: meta.source_platform,
          source_url: meta.source_url ?? null,
          raw_turns: rawTurns as never,
          graph_json: graphJson as never,
          usage_json: usage as never,
          pipeline_version: PIPELINE_VERSION,
        },
      });

      // 8. Mark job complete
      await db.job.update({
        where: { id: jobId },
        data: { status: "complete", error_message: null },
      });

      logger.info({ jobId, graphId: jobRecord.graph_id }, "Job complete");
    } catch (err: unknown) {
      const code =
        (err as { code?: string }).code === "KEY_NOT_CONFIGURED"
          ? "KEY_NOT_CONFIGURED"
          : "PARSE_FAILED";

      const message = err instanceof Error ? err.message : String(err);
      logger.error({ jobId, code, message }, "Job failed");

      await db.job.update({
        where: { id: jobId },
        data: { status: "failed", error_message: `${code}: ${message}` },
      });
    }
  },
  {
    connection: redis,
    concurrency: 2,
    lockDuration: 120_000,
  }
);

worker.on("completed", (job) => logger.info({ jobId: job.id }, "BullMQ job completed"));
worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "BullMQ job failed"));

logger.info("ThreadGraph worker started, listening on queue: parse-thread");

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — closing worker");
  await worker.close();
  await db.$disconnect();
  process.exit(0);
});
