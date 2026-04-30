import { Hono } from "hono";
import { z } from "zod";
import { db } from "../lib/db.js";
import { encryptApiKey } from "../lib/crypto.js";
import { getSession } from "../lib/session.js";

const app = new Hono();

const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!;

app.get("/api-key", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const user = await db.user.findUnique({ where: { id: session.user_id } });
  return c.json({ configured: !!user?.anthropic_key_encrypted });
});

app.put("/api-key", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ apiKey: z.string().min(1) }).safeParse(body);
  if (!parsed.success)
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid body", details: parsed.error.flatten() } }, 400);

  const { apiKey } = parsed.data;
  if (!apiKey.startsWith("sk-ant-"))
    return c.json({ error: { code: "VALIDATION_ERROR", message: "API key must start with sk-ant-" } }, 400);

  const { encrypted, iv } = encryptApiKey(apiKey, ENCRYPTION_SECRET);

  await db.user.update({
    where: { id: session.user_id },
    data: { anthropic_key_encrypted: encrypted, anthropic_key_iv: iv },
  });

  return c.json({ ok: true });
});

app.delete("/api-key", async (c) => {
  const session = await getSession(c);
  if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, 401);

  await db.user.update({
    where: { id: session.user_id },
    data: { anthropic_key_encrypted: null, anthropic_key_iv: null },
  });

  return c.body(null, 204);
});

export default app;
