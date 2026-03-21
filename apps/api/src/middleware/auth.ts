import { createMiddleware } from "hono/factory";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { AppError, ErrorCode } from "@openarti/shared";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export const authMiddleware = createMiddleware<{
  Variables: { user: AuthUser };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Missing or invalid Authorization header");
  }

  const rawKey = authHeader.slice(7);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const [row] = await db
    .select({
      userId: schema.apiKeys.userId,
      keyId: schema.apiKeys.id,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.apiKeys)
    .innerJoin(schema.users, eq(schema.users.id, schema.apiKeys.userId))
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid API key");
  }

  // Fire-and-forget: update last_used_at
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, row.keyId))
    .execute()
    .catch(() => {});

  c.set("user", { id: row.userId, email: row.email, name: row.name });
  await next();
});

export const optionalAuthMiddleware = createMiddleware<{
  Variables: { user?: AuthUser };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    await next();
    return;
  }

  const rawKey = authHeader.slice(7);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const [row] = await db
    .select({
      userId: schema.apiKeys.userId,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.apiKeys)
    .innerJoin(schema.users, eq(schema.users.id, schema.apiKeys.userId))
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1);

  if (row) {
    c.set("user", { id: row.userId, email: row.email, name: row.name });
  }

  await next();
});
