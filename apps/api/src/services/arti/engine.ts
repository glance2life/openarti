import path from "node:path";
import { and, eq } from "drizzle-orm";
import { AppError, ErrorCode } from "@openarti/shared";
import type { LsEntry, GrepMatch, LogCommit, BlameLine } from "@openarti/shared";
import { db, schema } from "../../db/index.js";
import type { StorageEngine } from "../storage.js";
import { getOpcodes } from "./weave.js";
import {
  applyUpdate,
  currentLines,
  deserializeWeave,
  emptyWeave,
  serializeWeave,
} from "./weave-ops.js";
import {
  advisoryLock,
  getHead,
  genCommitId,
  getInsertAttributions,
  insertCommit,
  insertWeaveOps,
  listCommits,
  listLiveFiles,
  listLivePaths,
  loadSnapshot,
  tombstoneSnapshot,
  upsertRef,
  upsertSnapshot,
} from "./db-ops.js";

const DEFAULT_AUTHOR = "openarti <bot@openarti.dev>";

// ---- Helpers ----

function validatePath(filePath: string): void {
  if (path.isAbsolute(filePath)) {
    throw new AppError(ErrorCode.BAD_REQUEST, "Absolute paths are not allowed");
  }
  if (filePath.split("/").some((s) => s === "..")) {
    throw new AppError(ErrorCode.BAD_REQUEST, "Path traversal is not allowed");
  }
}

function splitLines(content: string): string[] {
  const lines = content.split("\n");
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function joinLines(lines: string[]): string {
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

function globToRegex(pattern: string): RegExp {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*";
        i++;
        if (pattern[i + 1] === "/") i++; // consume trailing slash of **/
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (".+^${}()|[]\\".includes(c)) {
      re += "\\" + c;
    } else {
      re += c;
    }
  }
  re += "$";
  return new RegExp(re);
}

function formatReadResult(
  raw: string,
  commit: string,
  opts?: { offset?: number; limit?: number }
): { content: string; lines: number; commit: string } {
  const allLines = splitLines(raw);
  const totalLines = allLines.length;

  if (opts?.offset || opts?.limit) {
    const start = (opts.offset ?? 1) - 1;
    const end = opts.limit ? start + opts.limit : allLines.length;
    const sliced = allLines.slice(start, end);
    const formatted = sliced
      .map((line, i) => `${String(start + i + 1).padStart(6)}\t${line}`)
      .join("\n");
    return { content: formatted, lines: totalLines, commit };
  }

  const formatted = allLines
    .map((line, i) => `${String(i + 1).padStart(6)}\t${line}`)
    .join("\n");
  return { content: formatted, lines: totalLines, commit };
}

// Unified-diff-like output from two line arrays, using existing opcode logic.
function computeUnifiedDiff(
  oldLines: string[],
  newLines: string[],
  filePath: string,
  action: "create" | "update" | "delete"
): { text: string; added: number; removed: number } {
  if (action === "create") {
    const body: string[] = [];
    body.push(`--- /dev/null`, `+++ b/${filePath}`);
    body.push(`@@ -0,0 +1,${newLines.length} @@`);
    for (const l of newLines) body.push(`+${l}`);
    return { text: body.join("\n"), added: newLines.length, removed: 0 };
  }
  if (action === "delete") {
    const body: string[] = [];
    body.push(`--- a/${filePath}`, `+++ /dev/null`);
    body.push(`@@ -1,${oldLines.length} +0,0 @@`);
    for (const l of oldLines) body.push(`-${l}`);
    return { text: body.join("\n"), added: 0, removed: oldLines.length };
  }

  const ops = getOpcodes(oldLines, newLines);
  const body: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];
  body.push(`@@ -1,${oldLines.length} +1,${newLines.length} @@`);
  let added = 0;
  let removed = 0;
  for (const [tag, aBegin, aEnd, bBegin, bEnd] of ops) {
    if (tag === "equal") {
      for (let i = aBegin; i < aEnd; i++) body.push(` ${oldLines[i]}`);
    } else if (tag === "delete") {
      for (let i = aBegin; i < aEnd; i++) {
        body.push(`-${oldLines[i]}`);
        removed++;
      }
    } else if (tag === "insert") {
      for (let i = bBegin; i < bEnd; i++) {
        body.push(`+${newLines[i]}`);
        added++;
      }
    } else {
      // replace
      for (let i = aBegin; i < aEnd; i++) {
        body.push(`-${oldLines[i]}`);
        removed++;
      }
      for (let i = bBegin; i < bEnd; i++) {
        body.push(`+${newLines[i]}`);
        added++;
      }
    }
  }
  return { text: body.join("\n"), added, removed };
}

async function recordCommitFile(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  commitId: string,
  collectionId: string,
  filePath: string,
  action: "create" | "update" | "delete",
  oldLines: string[],
  newLines: string[]
): Promise<void> {
  const diff = computeUnifiedDiff(oldLines, newLines, filePath, action);
  await tx.insert(schema.artiCommitFiles).values({
    commitId,
    collectionId,
    path: filePath,
    action,
    diffText: diff.text,
    addedLines: diff.added,
    removedLines: diff.removed,
  });
}

// ---- ArtiEngine ----

export const artiEngine: StorageEngine = {
  async init(_collectionId) {
    // No-op: the collections row in the DB is the only initialization needed.
  },

  async readFile(collectionId, filePath, opts) {
    validatePath(filePath);
    if (opts?.ref) {
      throw new AppError(
        ErrorCode.BAD_REQUEST,
        "Reading at ref is not yet supported"
      );
    }
    const snap = await loadSnapshot(db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0], collectionId, filePath);
    if (!snap || snap.deletedAt !== null) {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }
    return formatReadResult(snap.content, snap.lastCommitId, opts);
  },

  async writeFile(collectionId, filePath, content, opts) {
    validatePath(filePath);
    const newLines = splitLines(content);

    return db.transaction(async (tx) => {
      await advisoryLock(tx, `${collectionId}:${filePath}`);

      const snap = await loadSnapshot(tx, collectionId, filePath);
      const existed = snap !== null && snap.deletedAt === null;
      const current = snap ? deserializeWeave(snap.weaveState) : emptyWeave();
      const oldLines = snap ? splitLines(snap.content) : [];

      const { next, ops } = applyUpdate(current, newLines);
      const nextAliveLines = currentLines(next);
      const nextContent = joinLines(nextAliveLines);

      const parentId = await getHead(tx, collectionId);
      const commit = await insertCommit(
        tx,
        {
          collectionId,
          author: opts?.author ?? DEFAULT_AUTHOR,
          message: opts?.message ?? `write ${filePath}`,
          files: [], // inserted below via recordCommitFile to include diff
        },
        parentId
      );
      await recordCommitFile(
        tx,
        commit.id,
        collectionId,
        filePath,
        existed ? "update" : "create",
        oldLines,
        nextAliveLines
      );
      await insertWeaveOps(tx, collectionId, filePath, commit.id, ops);
      await upsertSnapshot(
        tx,
        collectionId,
        filePath,
        nextContent,
        serializeWeave(next),
        nextAliveLines.length,
        commit.id
      );
      await upsertRef(tx, collectionId, "HEAD", commit.id);

      return { commit: commit.id, created: !existed };
    });
  },

  async editFile(collectionId, filePath, edits, opts) {
    validatePath(filePath);

    return db.transaction(async (tx) => {
      await advisoryLock(tx, `${collectionId}:${filePath}`);

      const snap = await loadSnapshot(tx, collectionId, filePath);
      if (!snap || snap.deletedAt !== null) {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

      let content = snap.content;
      let totalReplaced = 0;
      for (const edit of edits) {
        const count = content.split(edit.old_string).length - 1;
        if (count === 0) {
          throw new AppError(
            ErrorCode.NOT_FOUND,
            `old_string not found in '${filePath}'`
          );
        }
        if (count > 1 && !opts?.replaceAll) {
          throw new AppError(
            ErrorCode.CONFLICT,
            `old_string matched ${count} times in '${filePath}'. Use replace_all to replace all occurrences.`
          );
        }
        if (opts?.replaceAll) {
          content = content.split(edit.old_string).join(edit.new_string);
          totalReplaced += count;
        } else {
          const idx = content.indexOf(edit.old_string);
          content =
            content.slice(0, idx) +
            edit.new_string +
            content.slice(idx + edit.old_string.length);
          totalReplaced += 1;
        }
      }

      const newLines = splitLines(content);
      const oldLines = splitLines(snap.content);
      const current = deserializeWeave(snap.weaveState);
      const { next, ops } = applyUpdate(current, newLines);
      const nextAliveLines = currentLines(next);
      const nextContent = joinLines(nextAliveLines);

      const parentId = await getHead(tx, collectionId);
      const commit = await insertCommit(
        tx,
        {
          collectionId,
          author: opts?.author ?? DEFAULT_AUTHOR,
          message: opts?.message ?? `edit ${filePath}`,
          files: [],
        },
        parentId
      );
      await recordCommitFile(
        tx,
        commit.id,
        collectionId,
        filePath,
        "update",
        oldLines,
        nextAliveLines
      );
      await insertWeaveOps(tx, collectionId, filePath, commit.id, ops);
      await upsertSnapshot(
        tx,
        collectionId,
        filePath,
        nextContent,
        serializeWeave(next),
        nextAliveLines.length,
        commit.id
      );
      await upsertRef(tx, collectionId, "HEAD", commit.id);

      return { commit: commit.id, replaced: totalReplaced };
    });
  },

  async removeFile(collectionId, filePath, opts) {
    validatePath(filePath);

    return db.transaction(async (tx) => {
      await advisoryLock(tx, `${collectionId}:${filePath}`);

      const snap = await loadSnapshot(tx, collectionId, filePath);
      if (!snap || snap.deletedAt !== null) {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

      const oldLines = splitLines(snap.content);
      const parentId = await getHead(tx, collectionId);
      const commit = await insertCommit(
        tx,
        {
          collectionId,
          author: opts?.author ?? DEFAULT_AUTHOR,
          message: opts?.message ?? `delete ${filePath}`,
          files: [],
        },
        parentId
      );
      await recordCommitFile(
        tx,
        commit.id,
        collectionId,
        filePath,
        "delete",
        oldLines,
        []
      );
      await tombstoneSnapshot(tx, collectionId, filePath, commit.id);
      await upsertRef(tx, collectionId, "HEAD", commit.id);

      return { commit: commit.id };
    });
  },

  async listFiles(collectionId, dirPath) {
    const paths = await listLivePaths(collectionId);
    const prefix =
      !dirPath || dirPath === "." || dirPath === "" ? "" : dirPath.replace(/\/$/, "") + "/";

    const names = new Map<string, boolean>(); // name -> isDir
    for (const p of paths) {
      if (!p.startsWith(prefix)) continue;
      const rest = p.slice(prefix.length);
      if (rest.length === 0) continue;
      const slashIdx = rest.indexOf("/");
      if (slashIdx === -1) {
        names.set(rest, false);
      } else {
        const dir = rest.slice(0, slashIdx);
        if (!names.has(dir)) names.set(dir, true);
      }
    }

    return [...names.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, isDir]) => ({
        name,
        type: (isDir ? "dir" : "file") as "file" | "dir",
      }));
  },

  async grepFiles(collectionId, pattern, opts) {
    const files = await listLiveFiles(collectionId);
    const globRe = opts?.glob ? globToRegex(opts.glob) : null;
    const regex = new RegExp(pattern, opts?.ignoreCase ? "gi" : "g");
    const matches: GrepMatch[] = [];
    let totalMatches = 0;

    for (const file of files) {
      if (globRe && !globRe.test(file.path)) continue;
      const lines = splitLines(file.content);
      const matchingLineIndices = new Set<number>();
      const actualMatchLines = new Set<number>();

      lines.forEach((text, i) => {
        regex.lastIndex = 0;
        if (regex.test(text)) {
          actualMatchLines.add(i);
          totalMatches++;
          const ctx = opts?.context ?? 0;
          const start = Math.max(0, i - ctx);
          const end = Math.min(lines.length - 1, i + ctx);
          for (let j = start; j <= end; j++) matchingLineIndices.add(j);
        }
      });

      if (matchingLineIndices.size > 0) {
        const sortedIndices = [...matchingLineIndices].sort((a, b) => a - b);
        matches.push({
          path: file.path,
          lines: sortedIndices.map((idx) => ({
            line: idx + 1,
            text: lines[idx],
            match: actualMatchLines.has(idx),
          })),
        });
      }
    }

    return { matches, totalMatches };
  },

  async globFiles(collectionId, pattern) {
    const paths = await listLivePaths(collectionId);
    const re = globToRegex(pattern);
    return paths.filter((p) => re.test(p)).map((p) => ({ path: p }));
  },

  async getLog(collectionId, opts) {
    const rows = await listCommits(collectionId, {
      limit: opts?.limit ?? 20,
      offset: opts?.offset,
      path: opts?.path,
    });
    return rows.map<LogCommit>((r) => ({
      hash: r.id,
      message: r.message,
      author: r.author,
      timestamp: r.timestamp.toISOString(),
      files: r.files,
      fileDetails: r.fileDetails,
    }));
  },

  async getDiff(collectionId, opts) {
    const head = await getHead(
      db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0],
      collectionId
    );
    if (!head) {
      throw new AppError(ErrorCode.NOT_FOUND, "Collection is empty");
    }

    const toId = opts?.to ?? head;

    const fileRows = await db
      .select({
        path: schema.artiCommitFiles.path,
        diffText: schema.artiCommitFiles.diffText,
        addedLines: schema.artiCommitFiles.addedLines,
        removedLines: schema.artiCommitFiles.removedLines,
      })
      .from(schema.artiCommitFiles)
      .where(eq(schema.artiCommitFiles.commitId, toId));

    const filtered = opts?.path
      ? fileRows.filter((r) => r.path === opts.path)
      : fileRows;

    let additions = 0;
    let deletions = 0;
    const parts: string[] = [];
    for (const r of filtered) {
      additions += r.addedLines;
      deletions += r.removedLines;
      if (r.diffText) parts.push(r.diffText);
    }

    return { diff: parts.join("\n"), stats: { additions, deletions } };
  },

  async getBlame(collectionId, filePath) {
    validatePath(filePath);
    const snap = await loadSnapshot(
      db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0],
      collectionId,
      filePath
    );
    if (!snap || snap.deletedAt !== null) {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }

    const weave = deserializeWeave(snap.weaveState);
    const alive = weave.filter((l) => l.count % 2 === 1);
    const aliveIds = alive.map((l) => l.lineId);
    const attribMap = await getInsertAttributions(collectionId, filePath, aliveIds);

    return alive.map<BlameLine>((l, i) => {
      const a = attribMap.get(l.lineId);
      return {
        line: i + 1,
        text: l.text,
        author: a?.author ?? "unknown",
        commit: a?.commitId ?? "",
        timestamp: a?.timestamp?.toISOString() ?? new Date().toISOString(),
      };
    });
  },

  async restoreFile(collectionId, filePath, opts) {
    validatePath(filePath);

    const snap = await loadSnapshot(
      db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0],
      collectionId,
      filePath
    );
    if (!snap) {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' has no history to restore`);
    }
    if (snap.deletedAt === null) {
      throw new AppError(ErrorCode.CONFLICT, `File '${filePath}' is not deleted`);
    }

    const result = await this.writeFile(collectionId, filePath, snap.content, {
      message: opts?.message ?? `restore ${filePath}`,
      author: opts?.author ?? DEFAULT_AUTHOR,
    });
    return { commit: result.commit };
  },

  async fileExists(collectionId, filePath) {
    validatePath(filePath);
    const snap = await loadSnapshot(
      db as unknown as Parameters<Parameters<typeof db.transaction>[0]>[0],
      collectionId,
      filePath
    );
    return snap !== null && snap.deletedAt === null;
  },
};
