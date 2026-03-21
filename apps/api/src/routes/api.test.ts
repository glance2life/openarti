import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { app } from "../app.js";
import { db, schema } from "../db/index.js";
import { eq } from "drizzle-orm";

const TEST_TEAM = "test-team";
const TEST_REPO = "test-repo";
const TEST_USER_EMAIL = "test@openarti.dev";

let apiKey: string;

async function req(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return app.request(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  // Create test user
  const [user] = await db
    .insert(schema.users)
    .values({ email: TEST_USER_EMAIL, name: "test" })
    .onConflictDoNothing()
    .returning();

  const userId = user
    ? user.id
    : (
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, TEST_USER_EMAIL))
          .limit(1)
      )[0].id;

  // Create test team
  const [team] = await db
    .insert(schema.teams)
    .values({ name: TEST_TEAM })
    .onConflictDoNothing()
    .returning();

  const teamId = team
    ? team.id
    : (
        await db
          .select()
          .from(schema.teams)
          .where(eq(schema.teams.name, TEST_TEAM))
          .limit(1)
      )[0].id;

  // Add user as team owner
  await db
    .insert(schema.teamMembers)
    .values({ teamId, userId, role: "owner" })
    .onConflictDoNothing();

  // Generate API key
  apiKey = `oai_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
  await db
    .insert(schema.apiKeys)
    .values({ userId, keyHash, label: "test" })
    .onConflictDoNothing();
});

afterAll(async () => {
  // Clean up: delete team (cascades to members, repos)
  await db.delete(schema.teams).where(eq(schema.teams.name, TEST_TEAM));
  await db.delete(schema.users).where(eq(schema.users.email, TEST_USER_EMAIL));

  // Clean up git data
  const gitDataDir = process.env.GIT_DATA_DIR || "./data/test-repos";
  await fs.rm(`${gitDataDir}/${TEST_TEAM}`, { recursive: true, force: true });
});

describe("API", () => {
  // ── Health ──

  it("GET /health", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  // ── Auth ──

  it("rejects requests without auth", async () => {
    const res = await app.request("/repos/test-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "no-auth-repo" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects requests with invalid auth", async () => {
    const res = await app.request("/repos/test-team", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer oai_invalid",
      },
      body: JSON.stringify({ name: "bad-auth-repo" }),
    });
    expect(res.status).toBe(401);
  });

  // ── Repos ──

  it("POST /repos/:team — create repo", async () => {
    const res = await req("POST", "/repos/test-team", {
      name: TEST_REPO,
      visibility: "public",
      description: "test repo",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe(TEST_REPO);
    expect(body.owner).toBe(TEST_TEAM);
    expect(body.visibility).toBe("public");
  });

  it("POST /repos/:team — duplicate repo returns 409", async () => {
    const res = await req("POST", "/repos/test-team", {
      name: TEST_REPO,
    });
    expect(res.status).toBe(409);
  });

  it("GET /repos/:team — list repos", async () => {
    const res = await req("GET", "/repos/test-team");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body.some((r: { name: string }) => r.name === TEST_REPO)).toBe(true);
  });

  it("GET /repos/:team/:repo — repo detail", async () => {
    const res = await req("GET", `/repos/test-team/${TEST_REPO}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe(TEST_REPO);
  });

  it("GET /repos/:team/:repo — not found", async () => {
    const res = await req("GET", "/repos/test-team/nonexistent");
    expect(res.status).toBe(404);
  });

  // ── Tools: write → read → edit → read → ls ──

  it("write — create a file", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/write`, {
      path: "hello.md",
      content: "# Hello\n\nWorld\n",
      message: "create hello.md",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe("hello.md");
    expect(body.created).toBe(true);
    expect(body.commit).toBeTruthy();
  });

  it("read — read the file back", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/read`, {
      path: "hello.md",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toContain("# Hello");
    expect(body.lines).toBe(3);
  });

  it("read — file not found", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/read`, {
      path: "nonexistent.md",
    });
    expect(res.status).toBe(404);
  });

  it("edit — replace string", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/edit`, {
      path: "hello.md",
      old_string: "World",
      new_string: "OpenArti",
      message: "update greeting",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.replaced).toBe(1);
  });

  it("read — verify edit", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/read`, {
      path: "hello.md",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toContain("OpenArti");
    expect(body.content).not.toContain("World");
  });

  it("edit — old_string not found returns error", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/edit`, {
      path: "hello.md",
      old_string: "nonexistent text",
      new_string: "replacement",
    });
    expect(res.status).toBe(404);
  });

  it("write — create a second file", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/write`, {
      path: "notes.txt",
      content: "some notes\n",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(true);
  });

  it("ls — list files", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/ls`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.entries.map((e: { name: string }) => e.name);
    expect(names).toContain("hello.md");
    expect(names).toContain("notes.txt");
  });

  // ── Tools: grep, glob, log, diff, blame, rm ──

  it("grep — search for pattern with matches", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/grep`, {
      pattern: "Hello",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const files = body.matches.map((m: { path: string }) => m.path);
    expect(files).toContain("hello.md");
  });

  it("grep — search for nonexistent pattern", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/grep`, {
      pattern: "zzz_no_match_zzz",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.matches).toHaveLength(0);
  });

  it("glob — find *.md files", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/glob`, {
      pattern: "*.md",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const paths = body.files.map((f: { path: string }) => f.path);
    expect(paths).toContain("hello.md");
  });

  it("glob — no results for *.xyz", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/glob`, {
      pattern: "*.xyz",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(0);
  });

  it("log — get commit history", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/log`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.commits.length).toBeGreaterThanOrEqual(3);
  });

  it("diff — get diff of latest commit", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/diff`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.diff).toBe("string");
    expect(body.diff.length).toBeGreaterThan(0);
    expect(body.stats).toBeTruthy();
  });

  it("blame — get blame for hello.md", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/blame`, {
      path: "hello.md",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe("hello.md");
    expect(body.lines.length).toBeGreaterThan(0);
    expect(body.lines[0]).toHaveProperty("author");
  });

  it("rm — delete notes.txt", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/rm`, {
      path: "notes.txt",
      message: "remove notes.txt",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe("notes.txt");
    expect(body.commit).toBeTruthy();
  });

  it("ls — verify notes.txt is gone after rm", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/ls`, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.entries.map((e: { name: string }) => e.name);
    expect(names).toContain("hello.md");
    expect(names).not.toContain("notes.txt");
  });

  it("rm — delete nonexistent file returns 404", async () => {
    const res = await req("POST", `/repos/test-team/${TEST_REPO}/tools/rm`, {
      path: "nonexistent.txt",
    });
    expect(res.status).toBe(404);
  });
});
