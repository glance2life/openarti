import { randomUUID } from "node:crypto";
import path from "node:path";
import { AppError, ErrorCode } from "@openarti/shared";
import type { LsEntry, GrepMatch, LogCommit, BlameLine } from "@openarti/shared";
import type { StorageEngine } from "../storage.js";
import { LocalFS } from "./collection-fs.js";
import type { CollectionFS } from "./collection-fs.js";
import { serialize, deserialize, initialState, currentLines, updateState } from "./weave.js";

// ---- Helpers ----

function validatePath(filePath: string): void {
  if (path.isAbsolute(filePath)) {
    throw new AppError(ErrorCode.BAD_REQUEST, "Absolute paths are not allowed");
  }
  if (filePath.split("/").some((s) => s === "..")) {
    throw new AppError(ErrorCode.BAD_REQUEST, "Path traversal is not allowed");
  }
}

function weavePath(filePath: string): string {
  return `.arti/weaves/${filePath}.weave`;
}

function formatReadResult(
  raw: string,
  commit: string,
  opts?: { offset?: number; limit?: number }
): { content: string; lines: number; commit: string } {
  const allLines = raw.split("\n");
  // Remove trailing empty element from final newline
  if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
    allLines.pop();
  }
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

interface CommitData {
  id: string;
  parent: string | null;
  author: string;
  message: string;
  timestamp: string;
  files: { path: string; action: string }[];
}

async function readHeadSafe(cfs: CollectionFS): Promise<string | null> {
  try {
    return (await cfs.readFile(".arti/refs/HEAD")).trim();
  } catch {
    return null;
  }
}

async function writeCommit(
  cfs: CollectionFS,
  data: { author?: string; message?: string; files: { path: string; action: string }[] }
): Promise<CommitData> {
  const head = await readHeadSafe(cfs);
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const commit: CommitData = {
    id,
    parent: head,
    author: data.author ?? "openarti <bot@openarti.dev>",
    message: data.message ?? "",
    timestamp: new Date().toISOString(),
    files: data.files,
  };
  await cfs.writeFile(`.arti/commits/${id}.json`, JSON.stringify(commit));
  await cfs.writeFile(".arti/refs/HEAD", id);
  return commit;
}

async function readCommit(cfs: CollectionFS, commitId: string): Promise<CommitData> {
  const raw = await cfs.readFile(`.arti/commits/${commitId}.json`);
  return JSON.parse(raw);
}

async function walkCommitChain(
  cfs: CollectionFS,
  limit: number,
  pathFilter?: string
): Promise<LogCommit[]> {
  const results: LogCommit[] = [];
  let commitId = await readHeadSafe(cfs);
  while (commitId && results.length < limit) {
    let commit: CommitData;
    try {
      commit = await readCommit(cfs, commitId);
    } catch {
      break;
    }
    if (!pathFilter || commit.files.some((f) => f.path === pathFilter)) {
      results.push({
        hash: commit.id,
        message: commit.message,
        author: commit.author,
        timestamp: commit.timestamp,
        files: commit.files.map((f) => f.path),
      });
    }
    commitId = commit.parent;
  }
  return results;
}

// ---- ArtiEngine ----

export const artiEngine: StorageEngine = {
  async init(collectionPath) {
    const cfs = new LocalFS(collectionPath);
    await cfs.mkdir(".arti/weaves");
    await cfs.mkdir(".arti/commits");
    await cfs.mkdir(".arti/refs");
  },

  async readFile(collectionPath, filePath, opts) {
    validatePath(filePath);
    const cfs = new LocalFS(collectionPath);

    if (opts?.ref) {
      // v1: ref not supported yet (needs extended weave)
      throw new AppError(ErrorCode.BAD_REQUEST, "Reading at ref is not yet supported for arti engine");
    }

    // Current version: read file directly
    let raw: string;
    try {
      raw = await cfs.readFile(filePath);
    } catch {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }

    const head = await readHeadSafe(cfs);
    return formatReadResult(raw, head ?? "", opts);
  },

  async writeFile(collectionPath, filePath, content, opts) {
    validatePath(filePath);
    const cfs = new LocalFS(collectionPath);
    const wp = weavePath(filePath);
    const existed = await cfs.exists(wp);
    const release = await cfs.lock(wp);
    try {
      const lines = content.split("\n");
      // Remove trailing empty from final newline (match git behavior)
      if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }

      let newState: string;
      if (existed) {
        const oldState = await cfs.readFile(wp);
        newState = updateState(oldState, lines);
      } else {
        newState = initialState(lines);
      }

      await cfs.writeFile(wp, newState);
      await cfs.writeFile(filePath, content);
      const commit = await writeCommit(cfs, {
        author: opts?.author,
        message: opts?.message ?? `write ${filePath}`,
        files: [{ path: filePath, action: existed ? "update" : "create" }],
      });

      return { commit: commit.id, created: !existed };
    } finally {
      await release();
    }
  },

  async editFile(collectionPath, filePath, edits, opts) {
    validatePath(filePath);
    const cfs = new LocalFS(collectionPath);
    const wp = weavePath(filePath);
    const release = await cfs.lock(wp);
    try {
      let content: string;
      try {
        content = await cfs.readFile(filePath);
      } catch {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

      let totalReplaced = 0;
      for (const edit of edits) {
        const count = content.split(edit.old_string).length - 1;
        if (count === 0) {
          throw new AppError(ErrorCode.NOT_FOUND, `old_string not found in '${filePath}'`);
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
          content = content.slice(0, idx) + edit.new_string + content.slice(idx + edit.old_string.length);
          totalReplaced += 1;
        }
      }

      // Update weave
      const lines = content.split("\n");
      if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      const oldState = await cfs.readFile(wp);
      const newState = updateState(oldState, lines);
      await cfs.writeFile(wp, newState);
      await cfs.writeFile(filePath, content);

      const commit = await writeCommit(cfs, {
        author: opts?.author,
        message: opts?.message ?? `edit ${filePath}`,
        files: [{ path: filePath, action: "update" }],
      });

      return { commit: commit.id, replaced: totalReplaced };
    } finally {
      await release();
    }
  },

  async removeFile(collectionPath, filePath, opts) {
    validatePath(filePath);
    const cfs = new LocalFS(collectionPath);

    // Check file exists
    if (!(await cfs.exists(filePath))) {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }

    await cfs.unlink(filePath);
    // Weave preserved for history

    const commit = await writeCommit(cfs, {
      author: opts?.author,
      message: opts?.message ?? `delete ${filePath}`,
      files: [{ path: filePath, action: "delete" }],
    });

    return { commit: commit.id };
  },

  async listFiles(collectionPath, dirPath) {
    const cfs = new LocalFS(collectionPath);
    let entries: { name: string; isDirectory: boolean }[];
    try {
      entries = await cfs.readdir(dirPath || ".");
    } catch {
      return [];
    }
    return entries
      .filter((e) => e.name !== ".arti")
      .map((e) => ({ name: e.name, type: (e.isDirectory ? "dir" : "file") as "file" | "dir" }));
  },

  async grepFiles(collectionPath, pattern, opts) {
    const cfs = new LocalFS(collectionPath);
    const files = opts?.glob ? await cfs.glob(opts.glob) : await cfs.glob("**/*");

    const regex = new RegExp(pattern, opts?.ignoreCase ? "gi" : "g");
    const matches: GrepMatch[] = [];
    let totalMatches = 0;

    for (const file of files) {
      const content = await cfs.readFile(file);
      const lines = content.split("\n");
      const matchingLineIndices: Set<number> = new Set();
      const actualMatchLines: Set<number> = new Set();

      lines.forEach((text, i) => {
        regex.lastIndex = 0;
        if (regex.test(text)) {
          actualMatchLines.add(i);
          totalMatches++;
          const ctx = opts?.context ?? 0;
          const start = Math.max(0, i - ctx);
          const end = Math.min(lines.length - 1, i + ctx);
          for (let j = start; j <= end; j++) {
            matchingLineIndices.add(j);
          }
        }
      });

      if (matchingLineIndices.size > 0) {
        const sortedIndices = [...matchingLineIndices].sort((a, b) => a - b);
        const grepLines = sortedIndices.map((idx) => ({
          line: idx + 1,
          text: lines[idx],
          match: actualMatchLines.has(idx),
        }));
        matches.push({ path: file, lines: grepLines });
      }
    }

    return { matches, totalMatches };
  },

  async globFiles(collectionPath, pattern) {
    const cfs = new LocalFS(collectionPath);
    const files = await cfs.glob(pattern);
    return files.map((p) => ({ path: p }));
  },

  async getLog(collectionPath, opts) {
    const cfs = new LocalFS(collectionPath);
    return walkCommitChain(cfs, opts?.limit ?? 20, opts?.path);
  },

  async getDiff(collectionPath, opts) {
    const cfs = new LocalFS(collectionPath);
    const head = await readHeadSafe(cfs);
    if (!head) {
      throw new AppError(ErrorCode.NOT_FOUND, "Collection is empty");
    }

    const toId = opts?.to ?? head;
    let fromId = opts?.from;

    if (!fromId) {
      try {
        const toCommit = await readCommit(cfs, toId);
        fromId = toCommit.parent ?? undefined;
      } catch {
        throw new AppError(ErrorCode.NOT_FOUND, `Commit '${toId}' not found`);
      }
    }

    // Get files changed in the target commit
    const toCommit = await readCommit(cfs, toId);
    const filesToDiff = opts?.path
      ? toCommit.files.filter((f) => f.path === opts.path)
      : toCommit.files;

    const diffLines: string[] = [];
    let additions = 0;
    let deletions = 0;

    for (const file of filesToDiff) {
      if (file.action === "create") {
        // New file: diff against empty
        let content: string;
        try {
          content = await cfs.readFile(file.path);
        } catch {
          continue;
        }
        const lines = content.split("\n");
        diffLines.push(`--- /dev/null`, `+++ b/${file.path}`);
        diffLines.push(`@@ -0,0 +1,${lines.length} @@`);
        for (const l of lines) {
          diffLines.push(`+${l}`);
          additions++;
        }
      } else if (file.action === "delete") {
        diffLines.push(`--- a/${file.path}`, `+++ /dev/null`);
        diffLines.push(`@@ deleted @@`);
        deletions++;
      } else {
        // Update: read current content and reconstruct old from weave
        // For v1, we show the current content as added (simplified diff)
        let content: string;
        try {
          content = await cfs.readFile(file.path);
        } catch {
          continue;
        }

        // Try to reconstruct previous content from weave history
        // For now, show a simplified diff based on the weave
        const wp = weavePath(file.path);
        try {
          const weaveState = await cfs.readFile(wp);
          const current = currentLines(weaveState);
          // The "old" content would require reading the weave at a previous commit
          // For v1, we just show the current content with a note
          diffLines.push(`--- a/${file.path}`, `+++ b/${file.path}`);
          const contentLines = content.split("\n");
          diffLines.push(`@@ -1,? +1,${contentLines.length} @@`);
          for (const l of contentLines) {
            diffLines.push(` ${l}`);
          }
        } catch {
          diffLines.push(`--- a/${file.path}`, `+++ b/${file.path}`);
          diffLines.push(`@@ modified @@`);
        }
      }
    }

    return { diff: diffLines.join("\n"), stats: { additions, deletions } };
  },

  async getBlame(collectionPath, filePath) {
    validatePath(filePath);
    const cfs = new LocalFS(collectionPath);

    // v1: simplified blame — attribute all lines to the most recent commit that touched this file
    let content: string;
    try {
      content = await cfs.readFile(filePath);
    } catch {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }

    // Walk commit chain to find commits that touched this file
    const commits = await walkCommitChain(cfs, 100, filePath);
    const lastCommit = commits[0];

    const lines = content.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") {
      lines.pop();
    }

    return lines.map((text, i) => ({
      line: i + 1,
      text,
      author: lastCommit?.author ?? "unknown",
      commit: lastCommit?.hash ?? "",
      timestamp: lastCommit?.timestamp ?? new Date().toISOString(),
    }));
  },

  async fileExists(collectionPath, filePath) {
    validatePath(filePath);
    const cfs = new LocalFS(collectionPath);
    return cfs.exists(filePath);
  },
};
