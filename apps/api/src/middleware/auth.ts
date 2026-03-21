import { createMiddleware } from "hono/factory";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { auth } from "../auth.js";
import { AppError, ErrorCode } from "@openarti/shared";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

async function resolveApiKey(rawKey: string): Promise<AuthUser | null> {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const [row] = await db
    .select({
      userId: schema.apiKeys.userId,
      keyId: schema.apiKeys.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.apiKeys)
    .innerJoin(schema.users, eq(schema.users.id, schema.apiKeys.userId))
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row) return null;

  // Fire-and-forget: update last_used_at
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, row.keyId))
    .execute()
    .catch(() => {});

  return { id: row.userId, email: row.email, name: row.name, role: row.role ?? "member" };
}

async function resolveSession(headers: Headers): Promise<AuthUser | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as Record<string, unknown>).role as string ?? "member",
  };
}

export const authMiddleware = createMiddleware<{
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // 1. Try API key
  if (authHeader?.startsWith("Bearer ")) {
    const user = await resolveApiKey(authHeader.slice(7));
    if (user) {
      c.set("user", user);
      return next();
    }
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid API key");
  }

  // 2. Try session cookie
  const user = await resolveSession(c.req.raw.headers);
  if (user) {
    c.set("user", user);
    return next();
  }

  throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required");
});

export const optionalAuthMiddleware = createMiddleware<{
  Variables: { user?: AuthUser };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // 1. Try API key
  if (authHeader?.startsWith("Bearer ")) {
    const user = await resolveApiKey(authHeader.slice(7));
    if (user) {
      c.set("user", user);
    }
    return next();
  }

  // 2. Try session cookie
  const user = await resolveSession(c.req.raw.headers);
  if (user) {
    c.set("user", user);
  }

  return next();
});

export const adminMiddleware = createMiddleware<{
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const user = c.get("user");
  if (user?.role !== "admin") {
    throw new AppError(ErrorCode.FORBIDDEN, "Admin access required");
  }
  return next();
});
