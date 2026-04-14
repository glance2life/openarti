import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { AppError, ErrorCode } from "@openarti/shared";

export interface ResolvedCollection {
  collectionId: string;
  ownerId: string;
  ownerUsername: string;
  collectionName: string;
  visibility: "private" | "public";
  storagePath: string;
}

export async function resolveCollection(
  owner: string,
  collection: string
): Promise<ResolvedCollection> {
  const [row] = await db
    .select({
      collectionId: schema.collections.id,
      ownerId: schema.users.id,
      ownerUsername: schema.users.username,
      collectionName: schema.collections.name,
      visibility: schema.collections.visibility,
      storagePath: schema.collections.storagePath,
    })
    .from(schema.collections)
    .innerJoin(schema.users, eq(schema.users.id, schema.collections.ownerId))
    .where(and(eq(schema.users.username, owner), eq(schema.collections.name, collection)))
    .limit(1);

  if (!row) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Collection '${owner}/${collection}' not found`
    );
  }

  return row;
}

/**
 * Check if a user has access to a collection at the required level.
 * Owner always has full access. Otherwise checks collectionAccess table.
 */
export async function checkCollectionAccess(
  userId: string,
  collectionId: string,
  ownerId: string,
  requiredLevel: "read" | "edit"
): Promise<void> {
  // Owner has full access
  if (userId === ownerId) return;

  const [access] = await db
    .select({ level: schema.collectionAccess.level })
    .from(schema.collectionAccess)
    .where(
      and(
        eq(schema.collectionAccess.collectionId, collectionId),
        eq(schema.collectionAccess.userId, userId)
      )
    )
    .limit(1);

  if (!access) {
    throw new AppError(ErrorCode.FORBIDDEN, "No access to this collection");
  }

  if (requiredLevel === "edit" && access.level === "read") {
    throw new AppError(ErrorCode.FORBIDDEN, "Read-only access to this collection");
  }
}

/**
 * Check if a user is the owner of a collection.
 */
export function checkOwner(userId: string, ownerId: string): void {
  if (userId !== ownerId) {
    throw new AppError(ErrorCode.FORBIDDEN, "Must be collection owner");
  }
}
