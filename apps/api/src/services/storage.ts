import type { LsEntry, GrepMatch, LogCommit, BlameLine } from "@openarti/shared";

export interface StorageEngine {
  init(collectionId: string): Promise<void>;

  readFile(
    collectionId: string,
    filePath: string,
    opts?: { ref?: string; offset?: number; limit?: number }
  ): Promise<{ content: string; lines: number; commit: string }>;

  writeFile(
    collectionId: string,
    filePath: string,
    content: string,
    opts?: { message?: string; author?: string }
  ): Promise<{ commit: string; created: boolean }>;

  editFile(
    collectionId: string,
    filePath: string,
    edits: { old_string: string; new_string: string }[],
    opts?: { replaceAll?: boolean; message?: string; author?: string }
  ): Promise<{ commit: string; replaced: number }>;

  removeFile(
    collectionId: string,
    filePath: string,
    opts?: { message?: string; author?: string }
  ): Promise<{ commit: string }>;

  restoreFile(
    collectionId: string,
    filePath: string,
    opts?: { message?: string; author?: string }
  ): Promise<{ commit: string }>;

  listFiles(collectionId: string, dirPath?: string): Promise<LsEntry[]>;

  grepFiles(
    collectionId: string,
    pattern: string,
    opts?: { glob?: string; context?: number; ignoreCase?: boolean }
  ): Promise<{ matches: GrepMatch[]; totalMatches: number }>;

  globFiles(collectionId: string, pattern: string): Promise<{ path: string }[]>;

  getLog(
    collectionId: string,
    opts?: { path?: string; limit?: number }
  ): Promise<LogCommit[]>;

  getDiff(
    collectionId: string,
    opts?: { path?: string; from?: string; to?: string }
  ): Promise<{ diff: string; stats: { additions: number; deletions: number } }>;

  getBlame(collectionId: string, filePath: string): Promise<BlameLine[]>;

  fileExists(collectionId: string, filePath: string, ref?: string): Promise<boolean>;
}

export { artiEngine as engine } from "./arti/engine.js";
