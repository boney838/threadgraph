import { Context } from "hono";
import { db } from "./db.js";

export const DEV_USER_ID = "dev-bypass-user";

async function ensureDevUser() {
  await db.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: "dev@localhost",
      password_hash: "disabled",
    },
  });
}

export async function getSession(c: Context) {
  if (process.env.DISABLE_AUTH === "true") {
    await ensureDevUser();
    return {
      id: "dev-session",
      user_id: DEV_USER_ID,
      token: "dev-token",
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
      created_at: new Date(),
      user: { id: DEV_USER_ID, email: "dev@localhost", password_hash: "disabled", anthropic_key_encrypted: null, anthropic_key_iv: null, created_at: new Date(), updated_at: new Date() },
    };
  }

  const token =
    c.req.header("Authorization")?.replace("Bearer ", "") ??
    getCookie(c, "tg.session_token");

  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expires_at < new Date()) return null;
  return session;
}

function getCookie(c: Context, name: string): string | undefined {
  const cookieHeader = c.req.header("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === name) return v;
  }
  return undefined;
}
