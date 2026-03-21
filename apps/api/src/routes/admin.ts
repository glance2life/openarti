import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, adminMiddleware, type AuthUser } from "../middleware/auth.js";

export const admin = new Hono<{ Variables: { user: AuthUser } }>();

admin.use("*", authMiddleware, adminMiddleware);

// List users
admin.get("/users", async (c) => {
  const users = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);

  return c.json({ users });
});

// Create invitation
admin.post(
  "/invitations",
  zValidator("json", z.object({ email: z.string().email() })),
  async (c) => {
    const user = c.get("user");
    const { email } = c.req.valid("json");

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(schema.invitations)
      .values({ email, invitedBy: user.id, token, expiresAt })
      .returning();

    return c.json({ invitation: { ...invitation, token } }, 201);
  }
);

// List invitations
admin.get("/invitations", async (c) => {
  const invitations = await db
    .select({
      id: schema.invitations.id,
      email: schema.invitations.email,
      expiresAt: schema.invitations.expiresAt,
      acceptedAt: schema.invitations.acceptedAt,
      createdAt: schema.invitations.createdAt,
    })
    .from(schema.invitations);

  return c.json({ invitations });
});

// Revoke invitation
admin.delete("/invitations/:id", async (c) => {
  const id = c.req.param("id");

  await db
    .delete(schema.invitations)
    .where(eq(schema.invitations.id, id));

  return c.json({ ok: true });
});
