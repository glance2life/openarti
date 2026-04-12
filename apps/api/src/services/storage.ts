import type { LsEntry, GrepMatch, LogCommit, BlameLine } from "@openarti/shared";

export interface StorageEngine {
  init(collectionPath: string): Promise<void>;

  readFile(
    collectionPath: string,
    filePath: string,
    opts?: { ref?: string; offset?: number; limit?: number }
  ): Promise<{ content: string; lines: number; commit: string }>;

  writeFile(
    collectionPath: string,
    filePath: string,
    content: string,
    opts?: { message?: string; author?: string }
  ): Promise<{ commit: string; created: boolean }>;

  editFile(
    collectionPath: string,
    filePath: string,
    edits: { old_string: string; new_string: string }[],
    opts?: { replaceAll?: boolean; message?: string; author?: string }
  ): Promise<{ commit: string; replaced: number }>;

  removeFile(
    collectionPath: string,
    filePath: string,
    opts?: { message?: string; author?: string }
  ): Promise<{ commit: string }>;

  listFiles(collectionPath: string, dirPath?: string): Promise<LsEntry[]>;

  grepFiles(
    collectionPath: string,
    pattern: string,
    opts?: { glob?: string; context?: number; ignoreCase?: boolean }
  ): Promise<{ matches: GrepMatch[]; totalMatches: number }>;

  globFiles(collectionPath: string, pattern: string): Promise<{ path: string }[]>;

  getLog(
    collectionPath: string,
    opts?: { path?: string; limit?: number }
  ): Promise<LogCommit[]>;

  getDiff(
    collectionPath: string,
    opts?: { path?: string; from?: string; to?: string }
  ): Promise<{ diff: string; stats: { additions: number; deletions: number } }>;

  getBlame(collectionPath: string, filePath: string): Promise<BlameLine[]>;

  fileExists(collectionPath: string, filePath: string, ref?: string): Promise<boolean>;
}

export { artiEngine as engine } from "./arti/engine.js";
