import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, type AuthUser } from "../middleware/auth.js";
import { AppError, ErrorCode } from "@openarti/shared";

export const apikeys = new Hono<{ Variables: { user: AuthUser } }>();

apikeys.use("*", authMiddleware);

// List API keys
apikeys.get("/", async (c) => {
  const user = c.get("user");
  const keys = await db
    .select({
      id: schema.apiKeys.id,
      label: schema.apiKeys.label,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, user.id));

  return c.json({ keys });
});

// Create API key
apikeys.post(
  "/",
  zValidator("json", z.object({ label: z.string().max(100).default("") })),
  async (c) => {
    const user = c.get("user");
    const { label } = c.req.valid("json");

    const rawKey = `oai_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

    const [key] = await db
      .insert(schema.apiKeys)
      .values({ userId: user.id, keyHash, label })
      .returning({
        id: schema.apiKeys.id,
        label: schema.apiKeys.label,
        createdAt: schema.apiKeys.createdAt,
      });

    return c.json({ key: rawKey, ...key }, 201);
  }
);

// Delete API key
apikeys.delete("/:id", async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");

  const [deleted] = await db
    .delete(schema.apiKeys)
    .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, user.id)))
    .returning();

  if (!deleted) {
    throw new AppError(ErrorCode.NOT_FOUND, "API key not found");
  }

  return c.json({ ok: true });
});
