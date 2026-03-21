import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { AppError, ErrorCode } from "@openarti/shared";

const execFile = promisify(execFileCb);

const MAX_CAS_RETRIES = 5;

function validatePath(filePath: string): void {
  if (path.isAbsolute(filePath)) {
    throw new AppError(ErrorCode.BAD_REQUEST, "Absolute paths are not allowed");
  }
  const segments = filePath.split("/");
  if (segments.some((s) => s === "..")) {
    throw new AppError(ErrorCode.BAD_REQUEST, "Path traversal is not allowed");
  }
}

async function git(
  repoPath: string,
  args: string[],
  opts?: { env?: Record<string, string> }
): Promise<string> {
  const { stdout } = await execFile("git", args, {
    cwd: repoPath,
    env: { ...process.env, ...opts?.env },
    maxBuffer: 50 * 1024 * 1024,
  });
  return stdout;
}

async function gitWithStdin(
  repoPath: string,
  args: string[],
  stdin: string,
  opts?: { env?: Record<string, string> }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = execFileCb(
      "git",
      args,
      {
        cwd: repoPath,
        env: { ...process.env, ...opts?.env },
        maxBuffer: 50 * 1024 * 1024,
      },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      }
    );
    proc.stdin!.write(stdin);
    proc.stdin!.end();
  });
}

async function getHead(repoPath: string): Promise<string | null> {
  try {
    // Use --verify to ensure HEAD actually resolves to a valid object
    const result = await git(repoPath, ["rev-parse", "--verify", "HEAD"]);
    const trimmed = result.trim();
    // On empty repos, rev-parse may return "HEAD" literally — reject non-hash values
    if (!/^[0-9a-f]{40}$/.test(trimmed)) return null;
    return trimmed;
  } catch {
    return null; // empty repo
  }
}

export interface ReadFileResult {
  content: string;
  lines: number;
  commit: string;
}

export interface WriteFileResult {
  commit: string;
  created: boolean;
}

export interface EditFileResult {
  commit: string;
  replaced: number;
}

export interface LsEntry {
  name: string;
  type: "file" | "dir";
}

export interface EditOp {
  old_string: string;
  new_string: string;
}

export interface GrepMatch {
  path: string;
  lines: { line: number; text: string; match: boolean }[];
}

export interface LogEntry {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files: string[];
}

export interface DiffResult {
  diff: string;
  stats: { additions: number; deletions: number };
}

export interface BlameLine {
  line: number;
  text: string;
  author: string;
  commit: string;
  timestamp: string;
}

export const gitService = {
  async initRepo(repoPath: string): Promise<void> {
    await fs.mkdir(repoPath, { recursive: true });
    await git(repoPath, ["init", "--bare"]);
  },

  async readFile(
    repoPath: string,
    filePath: string,
    opts?: { ref?: string; offset?: number; limit?: number }
  ): Promise<ReadFileResult> {
    validatePath(filePath);
    const ref = opts?.ref ?? "HEAD";

    let commit: string;
    try {
      commit = (await git(repoPath, ["rev-parse", ref])).trim();
    } catch {
      throw new AppError(ErrorCode.NOT_FOUND, `Ref '${ref}' not found`);
    }

    let content: string;
    try {
      content = await git(repoPath, ["show", `${commit}:${filePath}`]);
    } catch {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        `File '${filePath}' not found at ref '${ref}'`
      );
    }

    const allLines = content.split("\n");
    // Remove trailing empty element from final newline
    if (allLines.length > 0 && allLines[allLines.length - 1] === "") {
      allLines.pop();
    }
    const totalLines = allLines.length;

    if (opts?.offset || opts?.limit) {
      const start = (opts.offset ?? 1) - 1; // 1-indexed to 0-indexed
      const end = opts.limit ? start + opts.limit : allLines.length;
      const sliced = allLines.slice(start, end);
      // Format with line numbers (cat -n style)
      const formatted = sliced
        .map((line, i) => {
          const lineNum = start + i + 1;
          return `${String(lineNum).padStart(6)}\t${line}`;
        })
        .join("\n");
      return { content: formatted, lines: totalLines, commit };
    }

    // Format with line numbers
    const formatted = allLines
      .map((line, i) => `${String(i + 1).padStart(6)}\t${line}`)
      .join("\n");

    return { content: formatted, lines: totalLines, commit };
  },

  async writeFile(
    repoPath: string,
    filePath: string,
    content: string,
    opts?: { message?: string; author?: string }
  ): Promise<WriteFileResult> {
    validatePath(filePath);
    const message = opts?.message ?? `write ${filePath}`;
    const author = opts?.author ?? "openarti <bot@openarti.dev>";

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      const oldHead = await getHead(repoPath);
      const tmpIndex = path.join(repoPath, `index-${randomUUID()}`);
      const env = { GIT_INDEX_FILE: tmpIndex };

      try {
        // Hash the content into a blob
        const blobHash = (
          await gitWithStdin(repoPath, ["hash-object", "-w", "--stdin"], content)
        ).trim();

        // Build index from current tree (if exists)
        if (oldHead) {
          await git(repoPath, ["read-tree", oldHead], { env });
        }

        // Check if file existed before
        let created = true;
        if (oldHead) {
          try {
            await git(repoPath, ["show", `${oldHead}:${filePath}`]);
            created = false;
          } catch {
            // file didn't exist
          }
        }

        // Update the index with our blob
        await git(
          repoPath,
          ["update-index", "--add", "--cacheinfo", `100644,${blobHash},${filePath}`],
          { env }
        );

        // Write the tree
        const treeHash = (await git(repoPath, ["write-tree"], { env })).trim();

        // Create commit
        const commitArgs = ["commit-tree", treeHash, "-m", message];
        if (oldHead) {
          commitArgs.push("-p", oldHead);
        }
        const newCommit = (
          await git(repoPath, commitArgs, {
            env: {
              ...env,
              GIT_AUTHOR_NAME: author.split(" <")[0],
              GIT_AUTHOR_EMAIL: author.includes("<")
                ? author.split("<")[1].replace(">", "")
                : "bot@openarti.dev",
              GIT_COMMITTER_NAME: author.split(" <")[0],
              GIT_COMMITTER_EMAIL: author.includes("<")
                ? author.split("<")[1].replace(">", "")
                : "bot@openarti.dev",
            },
          })
        ).trim();

        // CAS: update ref atomically
        if (oldHead) {
          await git(repoPath, [
            "update-ref",
            "refs/heads/main",
            newCommit,
            oldHead,
          ]);
        } else {
          // First commit — create the ref
          await git(repoPath, ["update-ref", "refs/heads/main", newCommit]);
          // Also set HEAD to point to main
          await git(repoPath, ["symbolic-ref", "HEAD", "refs/heads/main"]);
        }

        return { commit: newCommit, created };
      } catch (err: unknown) {
        // CAS failure — retry
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("update-ref") && attempt < MAX_CAS_RETRIES - 1) {
          continue;
        }
        throw err;
      } finally {
        // Cleanup temp index
        await fs.rm(tmpIndex, { force: true });
      }
    }

    throw new AppError(ErrorCode.CONFLICT, "Too many concurrent writes, please retry");
  },

  async editFile(
    repoPath: string,
    filePath: string,
    edits: EditOp[],
    opts?: { replaceAll?: boolean; message?: string; author?: string }
  ): Promise<EditFileResult> {
    validatePath(filePath);
    const message = opts?.message ?? `edit ${filePath}`;

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      // Read current content (raw, without line numbers)
      const head = await getHead(repoPath);
      if (!head) {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

      let content: string;
      try {
        content = await git(repoPath, ["show", `${head}:${filePath}`]);
      } catch {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

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
          // Replace first occurrence only
          const idx = content.indexOf(edit.old_string);
          content =
            content.slice(0, idx) +
            edit.new_string +
            content.slice(idx + edit.old_string.length);
          totalReplaced += 1;
        }
      }

      // Write the modified content using the write flow
      try {
        const result = await this.writeFile(repoPath, filePath, content, {
          message,
          author: opts?.author,
        });
        return { commit: result.commit, replaced: totalReplaced };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("concurrent") && attempt < MAX_CAS_RETRIES - 1) {
          continue; // Retry: re-read and re-apply edits
        }
        throw err;
      }
    }

    throw new AppError(ErrorCode.CONFLICT, "Too many concurrent edits, please retry");
  },

  async listFiles(repoPath: string, dirPath?: string): Promise<LsEntry[]> {
    const head = await getHead(repoPath);
    if (!head) return [];

    const prefix = dirPath ? `${dirPath}/` : "";
    const args = ["ls-tree", "--name-only", head];
    if (prefix) args.push(prefix);

    let output: string;
    try {
      output = await git(repoPath, args);
    } catch {
      return [];
    }

    const lines = output.trim().split("\n").filter(Boolean);

    // We need type info, so use full ls-tree output
    const fullOutput = await git(repoPath, [
      "ls-tree",
      head,
      ...(prefix ? [prefix] : []),
    ]);

    const entries: LsEntry[] = [];
    for (const line of fullOutput.trim().split("\n").filter(Boolean)) {
      // Format: <mode> <type> <hash>\t<name>
      const match = line.match(/^(\d+)\s+(blob|tree)\s+[0-9a-f]+\t(.+)$/);
      if (match) {
        const type = match[2] === "tree" ? "dir" : "file";
        let name = match[3];
        // Strip prefix for display
        if (prefix && name.startsWith(prefix)) {
          name = name.slice(prefix.length);
        }
        entries.push({ name, type: type as "file" | "dir" });
      }
    }

    return entries;
  },

  async removeFile(
    repoPath: string,
    filePath: string,
    opts?: { message?: string; author?: string }
  ): Promise<{ commit: string }> {
    validatePath(filePath);
    const message = opts?.message ?? `delete ${filePath}`;
    const author = opts?.author ?? "openarti <bot@openarti.dev>";

    for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
      const oldHead = await getHead(repoPath);
      if (!oldHead) {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

      // Verify file exists
      try {
        await git(repoPath, ["show", `${oldHead}:${filePath}`]);
      } catch {
        throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
      }

      const tmpIndex = path.join(repoPath, `index-${randomUUID()}`);
      const env = { GIT_INDEX_FILE: tmpIndex };

      try {
        // Rebuild index from current tree, excluding the target file
        const treeOutput = await git(repoPath, ["ls-tree", "-r", oldHead]);
        for (const line of treeOutput.trim().split("\n").filter(Boolean)) {
          const match = line.match(/^(\d+)\s+blob\s+([0-9a-f]+)\t(.+)$/);
          if (match && match[3] !== filePath) {
            await git(
              repoPath,
              ["update-index", "--add", "--cacheinfo", `${match[1]},${match[2]},${match[3]}`],
              { env }
            );
          }
        }
        const treeHash = (await git(repoPath, ["write-tree"], { env })).trim();

        const newCommit = (
          await git(repoPath, ["commit-tree", treeHash, "-p", oldHead, "-m", message], {
            env: {
              ...env,
              GIT_AUTHOR_NAME: author.split(" <")[0],
              GIT_AUTHOR_EMAIL: author.includes("<")
                ? author.split("<")[1].replace(">", "")
                : "bot@openarti.dev",
              GIT_COMMITTER_NAME: author.split(" <")[0],
              GIT_COMMITTER_EMAIL: author.includes("<")
                ? author.split("<")[1].replace(">", "")
                : "bot@openarti.dev",
            },
          })
        ).trim();

        await git(repoPath, ["update-ref", "refs/heads/main", newCommit, oldHead]);
        return { commit: newCommit };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("update-ref") && attempt < MAX_CAS_RETRIES - 1) {
          continue;
        }
        throw err;
      } finally {
        await fs.rm(tmpIndex, { force: true });
      }
    }

    throw new AppError(ErrorCode.CONFLICT, "Too many concurrent writes, please retry");
  },

  async grepFiles(
    repoPath: string,
    pattern: string,
    opts?: { glob?: string; context?: number; ignoreCase?: boolean }
  ): Promise<{ matches: GrepMatch[]; totalMatches: number }> {
    const head = await getHead(repoPath);
    if (!head) return { matches: [], totalMatches: 0 };

    const args = ["grep", "-n", "--heading"];
    if (opts?.ignoreCase) args.push("-i");
    if (opts?.context) args.push(`-C${opts.context}`);
    args.push(pattern, head);
    if (opts?.glob) args.push("--", opts.glob);

    let output: string;
    try {
      output = await git(repoPath, args);
    } catch {
      // git grep exits 1 when no matches
      return { matches: [], totalMatches: 0 };
    }

    const matches: GrepMatch[] = [];
    let current: GrepMatch | null = null;
    let totalMatches = 0;

    for (const line of output.split("\n")) {
      if (line === "") {
        if (current) {
          matches.push(current);
          current = null;
        }
        continue;
      }

      // Heading line: "<commit>:<path>"
      if (line.startsWith(`${head}:`)) {
        if (current) matches.push(current);
        const filePath = line.slice(head.length + 1);
        current = { path: filePath, lines: [] };
        continue;
      }

      if (!current) continue;

      // Match line: "<linenum>:<text>" or context line: "<linenum>-<text>"
      const matchLine = line.match(/^(\d+)([:-])(.*)$/);
      if (matchLine) {
        const isMatch = matchLine[2] === ":";
        current.lines.push({
          line: parseInt(matchLine[1], 10),
          text: matchLine[3],
          match: isMatch,
        });
        if (isMatch) totalMatches++;
      }
    }
    if (current) matches.push(current);

    return { matches, totalMatches };
  },

  async globFiles(
    repoPath: string,
    pattern: string
  ): Promise<{ path: string }[]> {
    const head = await getHead(repoPath);
    if (!head) return [];

    // List all files, then filter by pattern
    let output: string;
    try {
      output = await git(repoPath, ["ls-tree", "-r", "--name-only", head]);
    } catch {
      return [];
    }

    const files = output.trim().split("\n").filter(Boolean);

    // Convert glob pattern to regex
    const regexStr = pattern
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "{{GLOBSTAR}}")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
      .replace(/\{\{GLOBSTAR\}\}/g, ".*");
    const regex = new RegExp(`^${regexStr}$`);

    return files.filter((f) => regex.test(f)).map((p) => ({ path: p }));
  },

  async getLog(
    repoPath: string,
    opts?: { path?: string; limit?: number }
  ): Promise<LogEntry[]> {
    const head = await getHead(repoPath);
    if (!head) return [];

    const limit = opts?.limit ?? 20;
    // Use %x1e (record separator) to delimit commits, %x1f (unit separator) for fields
    const format = "%x1e%H%x1f%s%x1f%an%x1f%aI";
    const args = ["log", `--format=${format}`, `--max-count=${limit}`, "--name-only", head];
    if (opts?.path) {
      validatePath(opts.path);
      args.push("--", opts.path);
    }

    let output: string;
    try {
      output = await git(repoPath, args);
    } catch {
      return [];
    }

    const entries: LogEntry[] = [];
    const records = output.split("\x1e").filter(Boolean);

    for (const record of records) {
      const lines = record.trim().split("\n");
      const fields = lines[0].split("\x1f");
      if (fields.length < 4) continue;

      entries.push({
        hash: fields[0],
        message: fields[1],
        author: fields[2],
        timestamp: fields[3],
        files: lines.slice(1).filter(Boolean),
      });
    }

    return entries;
  },

  async getDiff(
    repoPath: string,
    opts?: { path?: string; from?: string; to?: string }
  ): Promise<DiffResult> {
    const head = await getHead(repoPath);
    if (!head) {
      throw new AppError(ErrorCode.NOT_FOUND, "Repository is empty");
    }

    const to = opts?.to ?? head;
    let from = opts?.from;

    // If no `from`, use parent of `to`
    if (!from) {
      try {
        from = (await git(repoPath, ["rev-parse", `${to}~1`])).trim();
      } catch {
        // First commit — diff against empty tree
        from = "4b825dc642cb6eb9a060e54bf899d15f7d7da85e";
      }
    }

    const args = ["diff", from, to];
    if (opts?.path) {
      validatePath(opts.path);
      args.push("--", opts.path);
    }

    const diff = await git(repoPath, args);

    // Parse stats
    let additions = 0;
    let deletions = 0;
    for (const line of diff.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }

    return { diff, stats: { additions, deletions } };
  },

  async getBlame(
    repoPath: string,
    filePath: string
  ): Promise<BlameLine[]> {
    validatePath(filePath);
    const head = await getHead(repoPath);
    if (!head) {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }

    let output: string;
    try {
      output = await git(repoPath, ["blame", "--porcelain", head, "--", filePath]);
    } catch {
      throw new AppError(ErrorCode.NOT_FOUND, `File '${filePath}' not found`);
    }

    const lines: BlameLine[] = [];
    const commits: Record<string, { author: string; timestamp: string }> = {};
    let currentCommit = "";
    let currentLine = 0;

    for (const line of output.split("\n")) {
      // Header line: "<hash> <orig-line> <final-line> [<num-lines>]"
      const headerMatch = line.match(/^([0-9a-f]{40})\s+\d+\s+(\d+)/);
      if (headerMatch) {
        currentCommit = headerMatch[1];
        currentLine = parseInt(headerMatch[2], 10);
        continue;
      }

      if (line.startsWith("author ")) {
        if (!commits[currentCommit]) {
          commits[currentCommit] = { author: "", timestamp: "" };
        }
        commits[currentCommit].author = line.slice(7);
      } else if (line.startsWith("author-time ")) {
        if (commits[currentCommit]) {
          const epoch = parseInt(line.slice(12), 10);
          commits[currentCommit].timestamp = new Date(epoch * 1000).toISOString();
        }
      } else if (line.startsWith("\t")) {
        // Content line
        const info = commits[currentCommit];
        if (info) {
          lines.push({
            line: currentLine,
            text: line.slice(1),
            author: info.author,
            commit: currentCommit,
            timestamp: info.timestamp,
          });
        }
      }
    }

    return lines;
  },

  async fileExists(
    repoPath: string,
    filePath: string,
    ref?: string
  ): Promise<boolean> {
    validatePath(filePath);
    const r = ref ?? "HEAD";
    try {
      await git(repoPath, ["show", `${r}:${filePath}`]);
      return true;
    } catch {
      return false;
    }
  },
};
