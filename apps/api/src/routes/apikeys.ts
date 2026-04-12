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
      keyHint: schema.apiKeys.keyHint,
      enabled: schema.apiKeys.enabled,
      usageCount: schema.apiKeys.usageCount,
      expiresAt: schema.apiKeys.expiresAt,
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
  zValidator(
    "json",
    z.object({
      label: z.string().max(100).default(""),
      expiresAt: z.string().datetime().optional(),
    })
  ),
  async (c) => {
    const user = c.get("user");
    const { label, expiresAt } = c.req.valid("json");

    const rawKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const hexPart = rawKey.slice(3);
    const keyHint = `sk_${hexPart.slice(0, 3)}...${hexPart.slice(-3)}`;

    const [key] = await db
      .insert(schema.apiKeys)
      .values({
        userId: user.id,
        keyHash,
        keyHint,
        label,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning({
        id: schema.apiKeys.id,
        label: schema.apiKeys.label,
        keyHint: schema.apiKeys.keyHint,
        expiresAt: schema.apiKeys.expiresAt,
        createdAt: schema.apiKeys.createdAt,
      });

    return c.json({ key: rawKey, ...key }, 201);
  }
);

// Toggle API key enabled/disabled
apikeys.patch(
  "/:id",
  zValidator("json", z.object({ enabled: z.boolean() })),
  async (c) => {
    const user = c.get("user");
    const keyId = c.req.param("id");
    const { enabled } = c.req.valid("json");

    const [updated] = await db
      .update(schema.apiKeys)
      .set({ enabled })
      .where(and(eq(schema.apiKeys.id, keyId), eq(schema.apiKeys.userId, user.id)))
      .returning({ id: schema.apiKeys.id, enabled: schema.apiKeys.enabled });

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "API key not found");
    }

    return c.json(updated);
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
