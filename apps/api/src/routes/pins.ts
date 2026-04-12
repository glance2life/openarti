import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, max } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, type AuthUser } from "../middleware/auth.js";
import { AppError, ErrorCode } from "@openarti/shared";

export const pins = new Hono<{ Variables: { user: AuthUser } }>();

pins.use("*", authMiddleware);

// List all pins for the current user
pins.get("/", async (c) => {
  const user = c.get("user");

  const rows = await db
    .select({
      id: schema.pins.id,
      targetType: schema.pins.targetType,
      targetPath: schema.pins.targetPath,
      displayOrder: schema.pins.displayOrder,
      createdAt: schema.pins.createdAt,
    })
    .from(schema.pins)
    .where(eq(schema.pins.userId, user.id))
    .orderBy(schema.pins.displayOrder);

  return c.json({ pins: rows });
});

// Create a pin
pins.post(
  "/",
  zValidator(
    "json",
    z.object({
      targetType: z.enum(["collection", "file", "dir"]),
      targetPath: z.string().min(1).max(500),
    })
  ),
  async (c) => {
    const user = c.get("user");
    const { targetType, targetPath } = c.req.valid("json");

    // Compute next displayOrder
    const [result] = await db
      .select({ maxOrder: max(schema.pins.displayOrder) })
      .from(schema.pins)
      .where(eq(schema.pins.userId, user.id));

    const nextOrder = (result?.maxOrder ?? -1) + 1;

    const [pin] = await db
      .insert(schema.pins)
      .values({
        userId: user.id,
        targetType,
        targetPath,
        displayOrder: nextOrder,
      })
      .returning({
        id: schema.pins.id,
        targetType: schema.pins.targetType,
        targetPath: schema.pins.targetPath,
        displayOrder: schema.pins.displayOrder,
        createdAt: schema.pins.createdAt,
      });

    return c.json({ pin }, 201);
  }
);

// Delete a pin
pins.delete("/:pinId", async (c) => {
  const user = c.get("user");
  const pinId = c.req.param("pinId");

  const [deleted] = await db
    .delete(schema.pins)
    .where(and(eq(schema.pins.id, pinId), eq(schema.pins.userId, user.id)))
    .returning();

  if (!deleted) {
    throw new AppError(ErrorCode.NOT_FOUND, "Pin not found");
  }

  return c.json({ ok: true });
});
