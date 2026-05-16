// SQL-level helpers for the arti storage engine. Isolating DB access
// here keeps engine.ts focused on business logic.

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import type { WeaveOp } from "./weave-ops.js";

// Tuple type from postgres-js transaction callback
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function genCommitId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function advisoryLock(tx: Tx, key: string): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${key}))`);
}

export async function getHead(tx: Tx, collectionId: string): Promise<string | null> {
  const [row] = await tx
    .select({ commitId: schema.artiRefs.commitId })
    .from(schema.artiRefs)
    .where(and(eq(schema.artiRefs.collectionId, collectionId), eq(schema.artiRefs.name, "HEAD")))
    .limit(1);
  return row?.commitId ?? null;
}

export interface SnapshotRow {
  content: string;
  weaveState: string;
  lineCount: number;
  lastCommitId: string;
  deletedAt: Date | null;
}

export async function loadSnapshot(
  tx: Tx,
  collectionId: string,
  path: string
): Promise<SnapshotRow | null> {
  const [row] = await tx
    .select({
      content: schema.artiFileSnapshot.content,
      weaveState: schema.artiFileSnapshot.weaveState,
      lineCount: schema.artiFileSnapshot.lineCount,
      lastCommitId: schema.artiFileSnapshot.lastCommitId,
      deletedAt: schema.artiFileSnapshot.deletedAt,
    })
    .from(schema.artiFileSnapshot)
    .where(
      and(
        eq(schema.artiFileSnapshot.collectionId, collectionId),
        eq(schema.artiFileSnapshot.path, path)
      )
    )
    .limit(1);
  return row ?? null;
}

export interface CommitSpec {
  collectionId: string;
  author: string;
  message: string;
  files: { path: string; action: "create" | "update" | "delete" }[];
}

export async function insertCommit(
  tx: Tx,
  spec: CommitSpec,
  parentId: string | null
): Promise<{ id: string; timestamp: Date }> {
  const id = genCommitId();
  const [row] = await tx
    .insert(schema.artiCommits)
    .values({
      id,
      collectionId: spec.collectionId,
      parentId,
      author: spec.author,
      message: spec.message,
    })
    .returning({ id: schema.artiCommits.id, timestamp: schema.artiCommits.timestamp });

  if (spec.files.length > 0) {
    await tx.insert(schema.artiCommitFiles).values(
      spec.files.map((f) => ({
        commitId: id,
        collectionId: spec.collectionId,
        path: f.path,
        action: f.action,
      }))
    );
  }

  return row;
}

export async function insertWeaveOps(
  tx: Tx,
  collectionId: string,
  path: string,
  commitId: string,
  ops: WeaveOp[]
): Promise<void> {
  if (ops.length === 0) return;
  await tx.insert(schema.artiWeaveOps).values(
    ops.map((op) => ({
      lineId: op.lineId,
      commitId,
      collectionId,
      path,
      opType: op.type,
      text: op.type === "insert" ? op.text : null,
      depth: op.type === "insert" ? op.depth : null,
      anchoredRight: op.type === "insert" ? op.anchoredRight : null,
      insertSeq: op.type === "insert" ? op.insertSeq : null,
    }))
  );
}

export async function upsertSnapshot(
  tx: Tx,
  collectionId: string,
  path: string,
  content: string,
  weaveState: string,
  lineCount: number,
  lastCommitId: string
): Promise<void> {
  await tx
    .insert(schema.artiFileSnapshot)
    .values({
      collectionId,
      path,
      content,
      weaveState,
      lineCount,
      lastCommitId,
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: [schema.artiFileSnapshot.collectionId, schema.artiFileSnapshot.path],
      set: {
        content,
        weaveState,
        lineCount,
        lastCommitId,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
}

export async function tombstoneSnapshot(
  tx: Tx,
  collectionId: string,
  path: string,
  lastCommitId: string
): Promise<void> {
  await tx
    .update(schema.artiFileSnapshot)
    .set({ deletedAt: new Date(), lastCommitId, updatedAt: new Date() })
    .where(
      and(
        eq(schema.artiFileSnapshot.collectionId, collectionId),
        eq(schema.artiFileSnapshot.path, path)
      )
    );
}

export async function upsertRef(
  tx: Tx,
  collectionId: string,
  name: string,
  commitId: string
): Promise<void> {
  await tx
    .insert(schema.artiRefs)
    .values({ collectionId, name, commitId })
    .onConflictDoUpdate({
      target: [schema.artiRefs.collectionId, schema.artiRefs.name],
      set: { commitId, updatedAt: new Date() },
    });
}

export interface LogRow {
  id: string;
  author: string;
  message: string;
  timestamp: Date;
  files: string[];
  fileDetails: { path: string; action: string }[];
}

export async function listCommits(
  collectionId: string,
  opts: { limit: number; offset?: number; path?: string }
): Promise<LogRow[]> {
  const rows = opts.path
    ? await db
        .select({
          id: schema.artiCommits.id,
          author: schema.artiCommits.author,
          message: schema.artiCommits.message,
          timestamp: schema.artiCommits.timestamp,
          seq: schema.artiCommits.seq,
        })
        .from(schema.artiCommits)
        .innerJoin(
          schema.artiCommitFiles,
          and(
            eq(schema.artiCommitFiles.commitId, schema.artiCommits.id),
            eq(schema.artiCommitFiles.path, opts.path)
          )
        )
        .where(eq(schema.artiCommits.collectionId, collectionId))
        .orderBy(desc(schema.artiCommits.seq))
        .limit(opts.limit)
        .offset(opts.offset ?? 0)
    : await db
        .select({
          id: schema.artiCommits.id,
          author: schema.artiCommits.author,
          message: schema.artiCommits.message,
          timestamp: schema.artiCommits.timestamp,
          seq: schema.artiCommits.seq,
        })
        .from(schema.artiCommits)
        .where(eq(schema.artiCommits.collectionId, collectionId))
        .orderBy(desc(schema.artiCommits.seq))
        .limit(opts.limit)
        .offset(opts.offset ?? 0);

  if (rows.length === 0) return [];
  const commitIds = rows.map((r) => r.id);
  const fileRows = await db
    .select({
      commitId: schema.artiCommitFiles.commitId,
      path: schema.artiCommitFiles.path,
      action: schema.artiCommitFiles.action,
    })
    .from(schema.artiCommitFiles)
    .where(inArray(schema.artiCommitFiles.commitId, commitIds));

  const filesByCommit = new Map<string, { path: string; action: string }[]>();
  for (const f of fileRows) {
    const arr = filesByCommit.get(f.commitId) ?? [];
    arr.push({ path: f.path, action: f.action });
    filesByCommit.set(f.commitId, arr);
  }

  return rows.map((r) => ({
    id: r.id,
    author: r.author,
    message: r.message,
    timestamp: r.timestamp,
    files: (filesByCommit.get(r.id) ?? []).map((f) => f.path),
    fileDetails: filesByCommit.get(r.id) ?? [],
  }));
}

export interface InsertOpAttribution {
  lineId: string;
  commitId: string;
  author: string;
  timestamp: Date;
}

export async function getInsertAttributions(
  collectionId: string,
  path: string,
  lineIds: string[]
): Promise<Map<string, InsertOpAttribution>> {
  if (lineIds.length === 0) return new Map();
  const rows = await db
    .select({
      lineId: schema.artiWeaveOps.lineId,
      commitId: schema.artiWeaveOps.commitId,
      author: schema.artiCommits.author,
      timestamp: schema.artiCommits.timestamp,
    })
    .from(schema.artiWeaveOps)
    .innerJoin(schema.artiCommits, eq(schema.artiCommits.id, schema.artiWeaveOps.commitId))
    .where(
      and(
        eq(schema.artiWeaveOps.collectionId, collectionId),
        eq(schema.artiWeaveOps.path, path),
        eq(schema.artiWeaveOps.opType, "insert"),
        inArray(schema.artiWeaveOps.lineId, lineIds)
      )
    );

  const map = new Map<string, InsertOpAttribution>();
  for (const r of rows) {
    map.set(r.lineId, {
      lineId: r.lineId,
      commitId: r.commitId,
      author: r.author,
      timestamp: r.timestamp,
    });
  }
  return map;
}

export interface LiveFileRow {
  path: string;
  content: string;
  weaveState: string;
  lastCommitId: string;
}

export async function listLiveFiles(collectionId: string): Promise<LiveFileRow[]> {
  return db
    .select({
      path: schema.artiFileSnapshot.path,
      content: schema.artiFileSnapshot.content,
      weaveState: schema.artiFileSnapshot.weaveState,
      lastCommitId: schema.artiFileSnapshot.lastCommitId,
    })
    .from(schema.artiFileSnapshot)
    .where(
      and(
        eq(schema.artiFileSnapshot.collectionId, collectionId),
        sql`${schema.artiFileSnapshot.deletedAt} IS NULL`
      )
    );
}

export async function listLivePaths(collectionId: string): Promise<string[]> {
  const rows = await db
    .select({ path: schema.artiFileSnapshot.path })
    .from(schema.artiFileSnapshot)
    .where(
      and(
        eq(schema.artiFileSnapshot.collectionId, collectionId),
        sql`${schema.artiFileSnapshot.deletedAt} IS NULL`
      )
    );
  return rows.map((r) => r.path);
}
