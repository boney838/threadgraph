import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { auth } from "./lib/auth.js";
import { logger } from "./lib/logger.js";
import accountRoutes from "./routes/account.js";
import graphRoutes from "./routes/graphs.js";
import jobRoutes from "./routes/jobs.js";

// ── Startup validation ────────────────────────────────────────────────────────
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;
if (!ENCRYPTION_SECRET || ENCRYPTION_SECRET.length < 64) {
  logger.fatal("ENCRYPTION_SECRET must be at least 64 hex chars (32 bytes). Refusing to start.");
  process.exit(1);
}

if (!process.env.SESSION_SECRET) {
  logger.fatal("SESSION_SECRET is required. Refusing to start.");
  process.exit(1);
}

const app = new Hono();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  "*",
  cors({
    origin: [
      process.env.WEB_URL ?? "http://localhost:5173",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use("*", honoLogger());

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ── Better Auth handler ───────────────────────────────────────────────────────
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ── Application routes ────────────────────────────────────────────────────────
app.route("/api/v1/account", accountRoutes);
app.route("/api/v1/graphs", graphRoutes);
app.route("/api/v1/jobs", jobRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

// ── Start ─────────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3001);
logger.info(`ThreadGraph API starting on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
