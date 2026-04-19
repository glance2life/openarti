import { Hono } from "hono";
import { eq, and, isNull } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, type AuthUser } from "../middleware/auth.js";
import { AppError, ErrorCode } from "@openarti/shared";

export const join = new Hono<{ Variables: { user: AuthUser } }>();

join.use("*", authMiddleware);

// Get invite link info (for the join page preview)
join.get("/:token", async (c) => {
  const token = c.req.param("token");

  const [link] = await db
    .select()
    .from(schema.inviteLinks)
    .where(eq(schema.inviteLinks.token, token))
    .limit(1);

  if (!link) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invite link not found");
  }

  if (!link.enabled) {
    throw new AppError(ErrorCode.BAD_REQUEST, "This invite link has been disabled");
  }

  const user = c.get("user");

  const [collection] = await db
    .select({
      id: schema.collections.id,
      name: schema.collections.name,
      ownerUsername: schema.users.username,
    })
    .from(schema.collections)
    .innerJoin(schema.users, eq(schema.users.id, schema.collections.ownerId))
    .where(
      and(
        eq(schema.collections.id, link.collectionId),
        isNull(schema.collections.deletedAt)
      )
    )
    .limit(1);

  if (!collection) {
    throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
  }

  // Check if already has access
  const [existing] = await db
    .select()
    .from(schema.collectionAccess)
    .where(
      and(
        eq(schema.collectionAccess.collectionId, link.collectionId),
        eq(schema.collectionAccess.userId, user.id)
      )
    )
    .limit(1);

  // Also check if user is the owner
  const [ownerRow] = await db
    .select({ ownerId: schema.collections.ownerId })
    .from(schema.collections)
    .where(eq(schema.collections.id, link.collectionId))
    .limit(1);

  const alreadyMember = !!existing || ownerRow?.ownerId === user.id;

  return c.json({
    collection: {
      id: collection.id,
      name: collection.name,
      ownerUsername: collection.ownerUsername,
    },
    alreadyMember,
  });
});

// Accept invite link
join.post("/:token", async (c) => {
  const user = c.get("user");
  const token = c.req.param("token");

  const [link] = await db
    .select()
    .from(schema.inviteLinks)
    .where(eq(schema.inviteLinks.token, token))
    .limit(1);

  if (!link) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invite link not found");
  }

  if (!link.enabled) {
    throw new AppError(ErrorCode.BAD_REQUEST, "This invite link has been disabled");
  }

  // Check if owner (can't join own collection)
  const [collection] = await db
    .select({ ownerId: schema.collections.ownerId, name: schema.collections.name })
    .from(schema.collections)
    .where(
      and(
        eq(schema.collections.id, link.collectionId),
        isNull(schema.collections.deletedAt)
      )
    )
    .limit(1);

  if (!collection) {
    throw new AppError(ErrorCode.NOT_FOUND, "Collection not found");
  }

  if (collection.ownerId === user.id) {
    throw new AppError(ErrorCode.CONFLICT, "You are the owner of this collection");
  }

  // Check not already a collaborator
  const [existing] = await db
    .select()
    .from(schema.collectionAccess)
    .where(
      and(
        eq(schema.collectionAccess.collectionId, link.collectionId),
        eq(schema.collectionAccess.userId, user.id)
      )
    )
    .limit(1);

  if (existing) {
    throw new AppError(ErrorCode.CONFLICT, "You already have access to this collection");
  }

  // Grant read access by default
  await db.insert(schema.collectionAccess).values({
    collectionId: link.collectionId,
    userId: user.id,
    level: "read",
  });

  // Get owner username for redirect
  const [owner] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, collection.ownerId))
    .limit(1);

  return c.json({
    ok: true,
    collection: collection.name,
    ownerUsername: owner?.username,
  });
});
