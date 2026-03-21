import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { gitService } from "./git.js";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
let repoPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openarti-git-test-"));
  repoPath = path.join(tmpDir, "test.git");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("gitService", () => {
  it("should init a bare repo", async () => {
    await gitService.initRepo(repoPath);
    const stat = await fs.stat(path.join(repoPath, "HEAD"));
    expect(stat.isFile()).toBe(true);
  });

  it("should write to an empty repo and read back", async () => {
    await gitService.initRepo(repoPath);
    const result = await gitService.writeFile(repoPath, "hello.md", "# Hello\n\nWorld\n");
    expect(result.created).toBe(true);
    expect(result.commit).toBeTruthy();

    const read = await gitService.readFile(repoPath, "hello.md");
    expect(read.content).toContain("# Hello");
    expect(read.lines).toBe(3);
    expect(read.commit).toBe(result.commit);
  });

  it("should read with line numbers", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "test.txt", "line1\nline2\nline3\n");

    const read = await gitService.readFile(repoPath, "test.txt");
    expect(read.content).toContain("     1\tline1");
    expect(read.content).toContain("     2\tline2");
    expect(read.content).toContain("     3\tline3");
  });

  it("should read with offset and limit", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(
      repoPath,
      "long.txt",
      "a\nb\nc\nd\ne\n"
    );

    const read = await gitService.readFile(repoPath, "long.txt", {
      offset: 2,
      limit: 2,
    });
    expect(read.content).toContain("     2\tb");
    expect(read.content).toContain("     3\tc");
    expect(read.content).not.toContain("     1\ta");
    expect(read.content).not.toContain("     4\td");
    expect(read.lines).toBe(5);
  });

  it("should overwrite an existing file", async () => {
    await gitService.initRepo(repoPath);
    const first = await gitService.writeFile(repoPath, "doc.md", "v1\n");
    expect(first.created).toBe(true);

    const second = await gitService.writeFile(repoPath, "doc.md", "v2\n");
    expect(second.created).toBe(false);
    expect(second.commit).not.toBe(first.commit);

    const read = await gitService.readFile(repoPath, "doc.md");
    expect(read.content).toContain("v2");
  });

  it("should edit a file (single replacement)", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "spec.md", "# Spec\n\nUse cookies\n");

    const result = await gitService.editFile(
      repoPath,
      "spec.md",
      [{ old_string: "Use cookies", new_string: "Use JWT" }],
    );
    expect(result.replaced).toBe(1);

    const read = await gitService.readFile(repoPath, "spec.md");
    expect(read.content).toContain("Use JWT");
    expect(read.content).not.toContain("Use cookies");
  });

  it("should edit with batch edits", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "config.txt", "host=old\nport=8080\n");

    const result = await gitService.editFile(repoPath, "config.txt", [
      { old_string: "host=old", new_string: "host=new" },
      { old_string: "port=8080", new_string: "port=3000" },
    ]);
    expect(result.replaced).toBe(2);

    const read = await gitService.readFile(repoPath, "config.txt");
    expect(read.content).toContain("host=new");
    expect(read.content).toContain("port=3000");
  });

  it("should error when old_string not found", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "a.txt", "hello\n");

    await expect(
      gitService.editFile(repoPath, "a.txt", [
        { old_string: "nonexistent", new_string: "replacement" },
      ])
    ).rejects.toThrow("old_string not found");
  });

  it("should error on multiple matches without replace_all", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "b.txt", "foo bar foo\n");

    await expect(
      gitService.editFile(repoPath, "b.txt", [
        { old_string: "foo", new_string: "baz" },
      ])
    ).rejects.toThrow("matched 2 times");
  });

  it("should replace all with replaceAll flag", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "c.txt", "foo bar foo\n");

    const result = await gitService.editFile(
      repoPath,
      "c.txt",
      [{ old_string: "foo", new_string: "baz" }],
      { replaceAll: true }
    );
    expect(result.replaced).toBe(2);

    const read = await gitService.readFile(repoPath, "c.txt");
    expect(read.content).toContain("baz bar baz");
  });

  it("should list files", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "a.md", "a\n");
    await gitService.writeFile(repoPath, "b.txt", "b\n");

    const entries = await gitService.listFiles(repoPath);
    const names = entries.map((e) => e.name);
    expect(names).toContain("a.md");
    expect(names).toContain("b.txt");
  });

  it("should check file existence", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "exists.txt", "yes\n");

    expect(await gitService.fileExists(repoPath, "exists.txt")).toBe(true);
    expect(await gitService.fileExists(repoPath, "nope.txt")).toBe(false);
  });

  it("should reject path traversal", async () => {
    await gitService.initRepo(repoPath);
    await expect(
      gitService.writeFile(repoPath, "../escape.txt", "evil\n")
    ).rejects.toThrow("Path traversal");
  });

  it("should reject absolute paths", async () => {
    await gitService.initRepo(repoPath);
    await expect(
      gitService.readFile(repoPath, "/etc/passwd")
    ).rejects.toThrow("Absolute paths");
  });

  it("should handle concurrent writes to different files", async () => {
    await gitService.initRepo(repoPath);
    // Write first file to init the repo
    await gitService.writeFile(repoPath, "init.txt", "init\n");

    // Concurrent writes
    const results = await Promise.all([
      gitService.writeFile(repoPath, "file1.txt", "content1\n"),
      gitService.writeFile(repoPath, "file2.txt", "content2\n"),
    ]);

    expect(results[0].commit).toBeTruthy();
    expect(results[1].commit).toBeTruthy();

    // Both files should exist
    const read1 = await gitService.readFile(repoPath, "file1.txt");
    const read2 = await gitService.readFile(repoPath, "file2.txt");
    expect(read1.content).toContain("content1");
    expect(read2.content).toContain("content2");
  });

  // ---------- removeFile ----------

  it("should remove a file and verify it no longer exists", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "to-delete.txt", "temporary\n");
    expect(await gitService.fileExists(repoPath, "to-delete.txt")).toBe(true);

    const result = await gitService.removeFile(repoPath, "to-delete.txt");
    expect(result.commit).toBeTruthy();

    expect(await gitService.fileExists(repoPath, "to-delete.txt")).toBe(false);
  });

  it("should error when removing a nonexistent file", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "keep.txt", "stay\n");

    await expect(
      gitService.removeFile(repoPath, "ghost.txt")
    ).rejects.toThrow("not found");
  });

  // ---------- grepFiles ----------

  it("should grep for a pattern and return matches", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "notes.txt", "hello world\ngoodbye world\nhello again\n");

    const result = await gitService.grepFiles(repoPath, "hello");
    expect(result.totalMatches).toBe(2);
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].path).toBe("notes.txt");

    const matchedLines = result.matches[0].lines.filter((l) => l.match);
    expect(matchedLines.length).toBe(2);
    expect(matchedLines[0].text).toContain("hello world");
    expect(matchedLines[1].text).toContain("hello again");
  });

  it("should grep with ignore_case", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "mixed.txt", "Hello World\nhello world\nHELLO WORLD\n");

    const caseSensitive = await gitService.grepFiles(repoPath, "Hello");
    expect(caseSensitive.totalMatches).toBe(1);

    const caseInsensitive = await gitService.grepFiles(repoPath, "Hello", { ignoreCase: true });
    expect(caseInsensitive.totalMatches).toBe(3);
  });

  it("should grep with glob filter", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "readme.md", "hello from markdown\n");
    await gitService.writeFile(repoPath, "code.ts", "hello from typescript\n");

    const mdOnly = await gitService.grepFiles(repoPath, "hello", { glob: "*.md" });
    expect(mdOnly.totalMatches).toBe(1);
    expect(mdOnly.matches[0].path).toBe("readme.md");
  });

  it("should return no matches when pattern is absent", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "data.txt", "alpha beta gamma\n");

    const result = await gitService.grepFiles(repoPath, "zzzznotfound");
    expect(result.totalMatches).toBe(0);
    expect(result.matches.length).toBe(0);
  });

  // ---------- globFiles ----------

  it("should match files by glob pattern *.md", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "readme.md", "# Readme\n");
    await gitService.writeFile(repoPath, "notes.md", "# Notes\n");
    await gitService.writeFile(repoPath, "script.ts", "console.log('hi')\n");

    const matched = await gitService.globFiles(repoPath, "*.md");
    const paths = matched.map((m) => m.path);
    expect(paths).toContain("readme.md");
    expect(paths).toContain("notes.md");
    expect(paths).not.toContain("script.ts");
  });

  it("should return empty array when no files match glob", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "file.txt", "content\n");

    const matched = await gitService.globFiles(repoPath, "*.py");
    expect(matched.length).toBe(0);
  });

  // ---------- getLog ----------

  it("should return log entries with hashes, authors, and messages", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "first.txt", "1\n", {
      message: "add first",
      author: "Alice <alice@test.com>",
    });
    await gitService.writeFile(repoPath, "second.txt", "2\n", {
      message: "add second",
      author: "Bob <bob@test.com>",
    });

    const log = await gitService.getLog(repoPath);
    expect(log.length).toBe(2);

    // Most recent commit comes first
    expect(log[0].message).toBe("add second");
    expect(log[0].author).toBe("Bob");
    expect(log[0].hash).toMatch(/^[0-9a-f]{40}$/);
    expect(log[0].files).toContain("second.txt");

    expect(log[1].message).toBe("add first");
    expect(log[1].author).toBe("Alice");
    expect(log[1].hash).toMatch(/^[0-9a-f]{40}$/);
    expect(log[1].files).toContain("first.txt");
  });

  it("should return empty log for empty repo", async () => {
    await gitService.initRepo(repoPath);
    const log = await gitService.getLog(repoPath);
    expect(log.length).toBe(0);
  });

  // ---------- getDiff ----------

  it("should show diff when a file is edited", async () => {
    await gitService.initRepo(repoPath);
    const first = await gitService.writeFile(repoPath, "doc.md", "line1\nline2\nline3\n");
    const second = await gitService.writeFile(repoPath, "doc.md", "line1\nmodified\nline3\n");

    const result = await gitService.getDiff(repoPath, {
      from: first.commit,
      to: second.commit,
    });

    expect(result.diff).toContain("-line2");
    expect(result.diff).toContain("+modified");
    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(1);
  });

  it("should diff against parent when from is omitted", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "x.txt", "original\n");
    await gitService.writeFile(repoPath, "x.txt", "changed\n");

    const result = await gitService.getDiff(repoPath);
    expect(result.diff).toContain("-original");
    expect(result.diff).toContain("+changed");
    expect(result.stats.additions).toBeGreaterThanOrEqual(1);
    expect(result.stats.deletions).toBeGreaterThanOrEqual(1);
  });

  it("should error on diff for empty repo", async () => {
    await gitService.initRepo(repoPath);

    await expect(gitService.getDiff(repoPath)).rejects.toThrow("empty");
  });

  // ---------- getBlame ----------

  it("should return blame with author and line content", async () => {
    await gitService.initRepo(repoPath);
    const writeResult = await gitService.writeFile(
      repoPath,
      "blame-target.txt",
      "alpha\nbeta\ngamma\n",
      { author: "Carol <carol@test.com>" }
    );

    const blame = await gitService.getBlame(repoPath, "blame-target.txt");
    expect(blame.length).toBe(3);

    expect(blame[0].line).toBe(1);
    expect(blame[0].text).toBe("alpha");
    expect(blame[0].author).toBe("Carol");
    expect(blame[0].commit).toBe(writeResult.commit);
    expect(blame[0].timestamp).toBeTruthy();

    expect(blame[1].line).toBe(2);
    expect(blame[1].text).toBe("beta");

    expect(blame[2].line).toBe(3);
    expect(blame[2].text).toBe("gamma");
  });

  it("should error on blame for nonexistent file", async () => {
    await gitService.initRepo(repoPath);
    await gitService.writeFile(repoPath, "exists.txt", "yes\n");

    await expect(
      gitService.getBlame(repoPath, "nope.txt")
    ).rejects.toThrow("not found");
  });
});
