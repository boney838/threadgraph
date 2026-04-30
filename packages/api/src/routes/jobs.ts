import { Hono } from "hono";
import { z } from "zod";
import { db } from "../lib/db.js";
import { parseQueue } from "../lib/queue.js";
import { getSession } from "../lib/session.js";

const app = new Hono();

const CreateJobSchema = z.object({
  transcript: z.string().min(1),
  source_platform: z.enum(["claude", "chatgpt"]),
  source_url: z.string().url().optional(),
  title: z.string().min(1).max(200).optional(),
});

app.post("/", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = CreateJobSchema.safeParse(body);
  if (!parsed.success)
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body", details: parsed.error.flatten() } }, 400);

  // Check API key is configured (skipped when auth is disabled — worker reads from ANTHROPIC_API_KEY env)
  if (process.env.DISABLE_AUTH !== "true") {
    const user = await db.user.findUnique({ where: { id: session.user_id } });
    if (!user?.anthropic_key_encrypted)
      return c.json({ error: { code: "KEY_NOT_CONFIGURED", message: "No Anthropic API key configured. Please add one in Settings." } }, 422);
  }

  const { transcript, source_platform, source_url, title } = parsed.data;

  // Create a placeholder graph record to attach to the job later
  // We store the transcript in the job payload (not the queue payload)
  const job = await db.job.create({
    data: {
      user_id: session.user_id,
      status: "queued",
      // Temporarily store transcript and metadata in error_message field until we
      // have a dedicated jobs_meta column. Instead, we store it in a temporary graph.
    },
  });

  // Store transcript in a "pending" graph row that the worker will populate
  const pendingGraph = await db.graph.create({
    data: {
      user_id: session.user_id,
      title: title ?? source_url ?? new Date().toISOString(),
      source_platform,
      source_url: source_url ?? null,
      raw_turns: [],
      graph_json: {},
      pipeline_version: "pending",
    },
  });

  // Update job with graph reference and store transcript metadata
  await db.job.update({
    where: { id: job.id },
    data: {
      graph_id: pendingGraph.id,
      // Store transcript + meta encoded in error_message temporarily
      // (used by worker to fetch; will be cleared on success)
      error_message: JSON.stringify({ transcript, source_platform, source_url, title }),
    },
  });

  // Push only jobId + userId to the queue
  await parseQueue.add("parse-thread", { jobId: job.id, userId: session.user_id });

  return c.json({ jobId: job.id }, 201);
});

app.get("/:id", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const job = await db.job.findFirst({
    where: { id: c.req.param("id"), user_id: session.user_id },
  });

  if (!job)
    return c.json({ error: { code: "JOB_NOT_FOUND", message: "Job not found" } }, 404);

  return c.json({
    status: job.status,
    graphId: job.graph_id ?? undefined,
    error: job.status === "failed" ? job.error_message ?? undefined : undefined,
  });
});

export default app;
