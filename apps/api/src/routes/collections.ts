import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { engine } from "../services/storage.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import type { AuthUser } from "../middleware/auth.js";
import { resolveCollection, checkCollectionAccess, checkOwner } from "../services/collection.js";
import { AppError, ErrorCode } from "@openarti/shared";

const collections = new Hono();

const createSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

// Create collection for authenticated user
collections.post(
  "/",
  authMiddleware,
  zValidator("json", createSchema),
  async (c) => {
    const body = c.req.valid("json");
    const user = c.get("user");

    // Check duplicate
    const [existing] = await db
      .select()
      .from(schema.collections)
      .where(
        and(eq(schema.collections.ownerId, user.id), eq(schema.collections.name, body.name))
      )
      .limit(1);

    if (existing) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Collection '${user.username}/${body.name}' already exists`
      );
    }

    const [collection] = await db
      .insert(schema.collections)
      .values({
        ownerId: user.id,
        name: body.name,
        description: body.description ?? "",
        visibility: body.visibility ?? "private",
      })
      .returning();

    return c.json(
      {
        id: collection.id,
        name: collection.name,
        owner: user.username,
        description: collection.description,
        visibility: collection.visibility,
        created_at: collection.createdAt.toISOString(),
      },
      201
    );
  }
);

// Recent updates: deduplicated file list across all user's collections
collections.get(
  "/recent",
  authMiddleware,
  async (c) => {
    const user = c.get("user");

    const ownRows = await db
      .select({ id: schema.collections.id, name: schema.collections.name })
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, user.id));

    const sharedRows = await db
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
        ownerUsername: schema.users.username,
      })
      .from(schema.collectionAccess)
      .innerJoin(schema.collections, eq(schema.collections.id, schema.collectionAccess.collectionId))
      .innerJoin(schema.users, eq(schema.users.id, schema.collections.ownerId))
      .where(eq(schema.collectionAccess.userId, user.id));

    const allCollections = [
      ...ownRows.map((r) => ({ owner: user.username, name: r.name, id: r.id })),
      ...sharedRows.map((r) => ({ owner: r.ownerUsername, name: r.name, id: r.id })),
    ];

    const results = await Promise.allSettled(
      allCollections.map(async (col) => {
        const commits = await engine.getLog(col.id, { limit: 10 });
        const files: { owner: string; collection: string; path: string; timestamp: string }[] = [];
        for (const commit of commits) {
          for (const file of commit.files) {
            files.push({
              owner: col.owner,
              collection: col.name,
              path: file,
              timestamp: commit.timestamp,
            });
          }
        }
        return files;
      })
    );

    // Deduplicate by owner/collection/path, keep the most recent timestamp
    const seen = new Map<string, { owner: string; collection: string; path: string; timestamp: string }>();
    const allFiles = results
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
      .flatMap((r) => r.value);

    for (const f of allFiles) {
      const key = `${f.owner}/${f.collection}/${f.path}`;
      const existing = seen.get(key);
      if (!existing || new Date(f.timestamp) > new Date(existing.timestamp)) {
        seen.set(key, f);
      }
    }

    const files = [...seen.values()]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    return c.json({ files });
  }
);

// Search files across all accessible collections
collections.post(
  "/search",
  authMiddleware,
  zValidator("json", z.object({ pattern: z.string().min(1) })),
  async (c) => {
    const user = c.get("user");
    const { pattern } = c.req.valid("json");

    const ownRows = await db
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
      })
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, user.id));

    const sharedRows = await db
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
        ownerUsername: schema.users.username,
      })
      .from(schema.collectionAccess)
      .innerJoin(schema.collections, eq(schema.collections.id, schema.collectionAccess.collectionId))
      .innerJoin(schema.users, eq(schema.users.id, schema.collections.ownerId))
      .where(eq(schema.collectionAccess.userId, user.id));

    const allCollections = [
      ...ownRows.map((r) => ({ id: r.id, name: r.name, owner: user.username })),
      ...sharedRows.map((r) => ({ id: r.id, name: r.name, owner: r.ownerUsername })),
    ];

    const results = await Promise.allSettled(
      allCollections.map(async (col) => {
        const files = await engine.globFiles(col.id, pattern);
        return { collection: { id: col.id, name: col.name, owner: col.owner }, files };
      })
    );

    return c.json({
      results: results
        .filter(
          (r): r is PromiseFulfilledResult<{ collection: { id: string; name: string; owner: string }; files: { path: string }[] }> =>
            r.status === "fulfilled" && r.value.files.length > 0
        )
        .map((r) => r.value),
    });
  }
);

// List authenticated user's own + shared collections
collections.get(
  "/",
  authMiddleware,
  async (c) => {
    const user = c.get("user");

    const ownRows = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.ownerId, user.id));

    const sharedRows = await db
      .select({
        id: schema.collections.id,
        name: schema.collections.name,
        description: schema.collections.description,
        visibility: schema.collections.visibility,
        createdAt: schema.collections.createdAt,
        ownerUsername: schema.users.username,
        level: schema.collectionAccess.level,
      })
      .from(schema.collectionAccess)
      .innerJoin(schema.collections, eq(schema.collections.id, schema.collectionAccess.collectionId))
      .innerJoin(schema.users, eq(schema.users.id, schema.collections.ownerId))
      .where(eq(schema.collectionAccess.userId, user.id));

    return c.json({
      own: ownRows.map((r) => ({
        id: r.id,
        name: r.name,
        owner: user.username,
        description: r.description,
        visibility: r.visibility,
        created_at: r.createdAt.toISOString(),
      })),
      shared: sharedRows.map((r) => ({
        id: r.id,
        name: r.name,
        owner: r.ownerUsername,
        description: r.description,
        visibility: r.visibility,
        created_at: r.createdAt.toISOString(),
        level: r.level,
      })),
    });
  }
);

// List collections for a user (public only, unless self)
collections.get(
  "/:owner",
  optionalAuthMiddleware,
  async (c) => {
    const ownerUsername = c.req.param("owner");
    const currentUser = c.get("user") as AuthUser | undefined;

    const [owner] = await db
      .select({ id: schema.users.id, username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.username, ownerUsername))
      .limit(1);

    if (!owner) {
      throw new AppError(ErrorCode.NOT_FOUND, `User '${ownerUsername}' not found`);
    }

    const isSelf = currentUser?.id === owner.id;

    let rows;
    if (isSelf) {
      rows = await db
        .select()
        .from(schema.collections)
        .where(eq(schema.collections.ownerId, owner.id));
    } else {
      rows = await db
        .select()
        .from(schema.collections)
        .where(
          and(
            eq(schema.collections.ownerId, owner.id),
            eq(schema.collections.visibility, "public")
          )
        );
    }

    return c.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        owner: ownerUsername,
        description: r.description,
        visibility: r.visibility,
        created_at: r.createdAt.toISOString(),
      }))
    );
  }
);

// Collection detail
collections.get(
  "/:owner/:collection",
  optionalAuthMiddleware,
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const resolved = await resolveCollection(owner, collectionName);

    return c.json({
      id: resolved.collectionId,
      name: resolved.collectionName,
      owner: resolved.ownerUsername,
      visibility: resolved.visibility,
    });
  }
);

// Head — cheap change-detection endpoint for realtime polling.
// Without ?path: latest commitId on the collection.
// With ?path: lastCommitId + deleted flag for a specific file snapshot.
collections.get(
  "/:owner/:collection/head",
  optionalAuthMiddleware,
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const path = c.req.query("path");
    const resolved = await resolveCollection(owner, collectionName);

    if (resolved.visibility === "private") {
      const user = c.get("user") as AuthUser | undefined;
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private collections");
      }
      await checkCollectionAccess(user.id, resolved.collectionId, resolved.ownerId, "read");
    }

    if (path) {
      const [row] = await db
        .select({
          commitId: schema.artiFileSnapshot.lastCommitId,
          updatedAt: schema.artiFileSnapshot.updatedAt,
          deletedAt: schema.artiFileSnapshot.deletedAt,
        })
        .from(schema.artiFileSnapshot)
        .where(
          and(
            eq(schema.artiFileSnapshot.collectionId, resolved.collectionId),
            eq(schema.artiFileSnapshot.path, path)
          )
        )
        .limit(1);

      if (!row) {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${path}' not found`);
      }

      return c.json({
        commitId: row.commitId,
        updatedAt: row.updatedAt.toISOString(),
        deleted: row.deletedAt !== null,
      });
    }

    const [row] = await db
      .select({
        commitId: schema.artiCommits.id,
        timestamp: schema.artiCommits.timestamp,
      })
      .from(schema.artiCommits)
      .where(eq(schema.artiCommits.collectionId, resolved.collectionId))
      .orderBy(desc(schema.artiCommits.seq))
      .limit(1);

    return c.json({
      commitId: row?.commitId ?? null,
      updatedAt: row?.timestamp.toISOString() ?? null,
    });
  }
);

// Update collection settings (visibility, etc.)
const updateSchema = z.object({
  visibility: z.enum(["private", "public"]).optional(),
});

collections.patch(
  "/:owner/:collection",
  authMiddleware,
  zValidator("json", updateSchema),
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user") as AuthUser;
    const body = c.req.valid("json");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const updates: Record<string, unknown> = {};
    if (body.visibility) updates.visibility = body.visibility;

    if (Object.keys(updates).length > 0) {
      await db
        .update(schema.collections)
        .set(updates)
        .where(eq(schema.collections.id, resolved.collectionId));
    }

    const [updated] = await db
      .select()
      .from(schema.collections)
      .where(eq(schema.collections.id, resolved.collectionId))
      .limit(1);

    return c.json({
      id: updated.id,
      name: updated.name,
      owner: resolved.ownerUsername,
      visibility: updated.visibility,
    });
  }
);

// ---- Access management ----

// List collaborators
collections.get(
  "/:owner/:collection/access",
  authMiddleware,
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const rows = await db
      .select({
        userId: schema.collectionAccess.userId,
        level: schema.collectionAccess.level,
        createdAt: schema.collectionAccess.createdAt,
        userName: schema.users.name,
        userEmail: schema.users.email,
        userUsername: schema.users.username,
      })
      .from(schema.collectionAccess)
      .innerJoin(schema.users, eq(schema.users.id, schema.collectionAccess.userId))
      .where(eq(schema.collectionAccess.collectionId, resolved.collectionId));

    return c.json({ collaborators: rows });
  }
);

// Add collaborator
collections.post(
  "/:owner/:collection/access",
  authMiddleware,
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      level: z.enum(["read", "edit"]).optional(),
    })
  ),
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user");
    const body = c.req.valid("json");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, body.email))
      .limit(1);

    if (!targetUser) {
      throw new AppError(ErrorCode.NOT_FOUND, "User not found");
    }

    if (targetUser.id === resolved.ownerId) {
      throw new AppError(ErrorCode.BAD_REQUEST, "Cannot add owner as collaborator");
    }

    await db
      .insert(schema.collectionAccess)
      .values({
        collectionId: resolved.collectionId,
        userId: targetUser.id,
        level: body.level ?? "read",
      })
      .onConflictDoUpdate({
        target: [schema.collectionAccess.collectionId, schema.collectionAccess.userId],
        set: { level: body.level ?? "read" },
      });

    return c.json({ ok: true }, 201);
  }
);

// Update collaborator access level
collections.patch(
  "/:owner/:collection/access/:userId",
  authMiddleware,
  zValidator("json", z.object({ level: z.enum(["read", "edit"]) })),
  async (c) => {
    const { owner, collection: collectionName, userId: targetUserId } = c.req.param();
    const user = c.get("user");
    const body = c.req.valid("json");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const [updated] = await db
      .update(schema.collectionAccess)
      .set({ level: body.level })
      .where(
        and(
          eq(schema.collectionAccess.collectionId, resolved.collectionId),
          eq(schema.collectionAccess.userId, targetUserId)
        )
      )
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "Collaborator not found");
    }

    return c.json({ ok: true });
  }
);

// Remove collaborator
collections.delete(
  "/:owner/:collection/access/:userId",
  authMiddleware,
  async (c) => {
    const { owner, collection: collectionName, userId: targetUserId } = c.req.param();
    const user = c.get("user");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const [deleted] = await db
      .delete(schema.collectionAccess)
      .where(
        and(
          eq(schema.collectionAccess.collectionId, resolved.collectionId),
          eq(schema.collectionAccess.userId, targetUserId)
        )
      )
      .returning();

    if (!deleted) {
      throw new AppError(ErrorCode.NOT_FOUND, "Collaborator not found");
    }

    return c.json({ ok: true });
  }
);

// ---- Invite link management ----

// Get invite link
collections.get(
  "/:owner/:collection/invite-link",
  authMiddleware,
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const [link] = await db
      .select()
      .from(schema.inviteLinks)
      .where(eq(schema.inviteLinks.collectionId, resolved.collectionId))
      .limit(1);

    return c.json({ inviteLink: link ?? null });
  }
);

// Create/regenerate invite link
collections.post(
  "/:owner/:collection/invite-link",
  authMiddleware,
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    // Delete existing link if any
    await db
      .delete(schema.inviteLinks)
      .where(eq(schema.inviteLinks.collectionId, resolved.collectionId));

    const [link] = await db
      .insert(schema.inviteLinks)
      .values({
        collectionId: resolved.collectionId,
        createdBy: user.id,
      })
      .returning();

    return c.json({ inviteLink: link }, 201);
  }
);

// Toggle invite link enabled/disabled
collections.patch(
  "/:owner/:collection/invite-link",
  authMiddleware,
  zValidator("json", z.object({ enabled: z.boolean() })),
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user");
    const body = c.req.valid("json");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    const [updated] = await db
      .update(schema.inviteLinks)
      .set({ enabled: body.enabled })
      .where(eq(schema.inviteLinks.collectionId, resolved.collectionId))
      .returning();

    if (!updated) {
      throw new AppError(ErrorCode.NOT_FOUND, "No invite link found");
    }

    return c.json({ inviteLink: updated });
  }
);

// Delete invite link
collections.delete(
  "/:owner/:collection/invite-link",
  authMiddleware,
  async (c) => {
    const { owner, collection: collectionName } = c.req.param();
    const user = c.get("user");
    const resolved = await resolveCollection(owner, collectionName);
    checkOwner(user.id, resolved.ownerId);

    await db
      .delete(schema.inviteLinks)
      .where(eq(schema.inviteLinks.collectionId, resolved.collectionId));

    return c.json({ ok: true });
  }
);

export { collections };
