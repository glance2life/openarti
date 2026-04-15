import { describe, it, expect, beforeAll, afterEach } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db/index.js";
import { artiEngine as engine } from "./engine.js";

const TEST_USER_EMAIL = "engine-test@openarti.dev";
const TEST_USERNAME = "engtest";
let userId: string;

async function createCollection(name: string): Promise<string> {
  const [row] = await db
    .insert(schema.collections)
    .values({ ownerId: userId, name })
    .returning({ id: schema.collections.id });
  return row.id;
}

beforeAll(async () => {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, TEST_USER_EMAIL))
    .limit(1);

  if (existing) {
    userId = existing.id;
    return;
  }

  const [user] = await db
    .insert(schema.users)
    .values({
      id: crypto.randomUUID(),
      email: TEST_USER_EMAIL,
      name: "engine-test",
      username: TEST_USERNAME,
      emailVerified: false,
      updatedAt: new Date(),
    })
    .returning({ id: schema.users.id });
  userId = user.id;
});

afterEach(async () => {
  await db.delete(schema.collections).where(eq(schema.collections.ownerId, userId));
});

describe("arti engine (Postgres-backed)", () => {
  it("writeFile creates a commit, snapshot, ref, and ops", async () => {
    const cid = await createCollection("c1");
    const res = await engine.writeFile(cid, "hello.md", "# Hello\n\nWorld\n");
    expect(res.created).toBe(true);
    expect(res.commit).toBeTruthy();

    const snap = await db
      .select()
      .from(schema.artiFileSnapshot)
      .where(eq(schema.artiFileSnapshot.collectionId, cid));
    expect(snap.length).toBe(1);
    expect(snap[0].path).toBe("hello.md");
    expect(snap[0].lineCount).toBe(3);

    const refs = await db
      .select()
      .from(schema.artiRefs)
      .where(eq(schema.artiRefs.collectionId, cid));
    expect(refs.length).toBe(1);
    expect(refs[0].name).toBe("HEAD");
    expect(refs[0].commitId).toBe(res.commit);

    const ops = await db
      .select()
      .from(schema.artiWeaveOps)
      .where(eq(schema.artiWeaveOps.collectionId, cid));
    expect(ops.length).toBe(3);
    expect(ops.every((o) => o.opType === "insert")).toBe(true);
  });

  it("readFile returns formatted content", async () => {
    const cid = await createCollection("c-read");
    await engine.writeFile(cid, "a.md", "line1\nline2\n");
    const res = await engine.readFile(cid, "a.md");
    expect(res.lines).toBe(2);
    expect(res.content).toContain("line1");
    expect(res.content).toContain("line2");
  });

  it("editFile replaces content and records a new commit", async () => {
    const cid = await createCollection("c-edit");
    await engine.writeFile(cid, "doc.md", "hello world\n");
    const edit = await engine.editFile(cid, "doc.md", [
      { old_string: "world", new_string: "OpenArti" },
    ]);
    expect(edit.replaced).toBe(1);

    const read = await engine.readFile(cid, "doc.md");
    expect(read.content).toContain("OpenArti");

    const log = await engine.getLog(cid, { limit: 10 });
    expect(log.length).toBe(2);
  });

  it("removeFile tombstones but preserves ops and diff", async () => {
    const cid = await createCollection("c-rm");
    await engine.writeFile(cid, "x.md", "gone soon\n");
    const rm = await engine.removeFile(cid, "x.md");
    expect(rm.commit).toBeTruthy();

    await expect(engine.readFile(cid, "x.md")).rejects.toThrow();

    const files = await engine.listFiles(cid);
    expect(files.find((f) => f.name === "x.md")).toBeUndefined();

    const diff = await engine.getDiff(cid);
    expect(diff.diff).toContain("-gone soon");
  });

  it("re-writing after delete reports create=true and reuses preserved weave", async () => {
    const cid = await createCollection("c-res");
    const c1 = await engine.writeFile(cid, "z.md", "one\n");
    await engine.removeFile(cid, "z.md");
    const again = await engine.writeFile(cid, "z.md", "one\n");
    // From the user's POV the file didn't exist, so create=true.
    expect(again.created).toBe(true);

    const read = await engine.readFile(cid, "z.md");
    expect(read.content).toContain("one");

    // Weave continuity: blame for the resurrected "one" still points at the
    // original insert commit, not at the resurrection commit.
    const blame = await engine.getBlame(cid, "z.md");
    expect(blame[0].commit).toBe(c1.commit);
  });

  it("listFiles rolls up subdirectories", async () => {
    const cid = await createCollection("c-ls");
    await engine.writeFile(cid, "a.md", "a\n");
    await engine.writeFile(cid, "guides/intro.md", "intro\n");
    await engine.writeFile(cid, "guides/deep/next.md", "next\n");

    const root = await engine.listFiles(cid);
    const names = root.map((e) => `${e.name}:${e.type}`).sort();
    expect(names).toEqual(["a.md:file", "guides:dir"]);

    const guides = await engine.listFiles(cid, "guides");
    const gnames = guides.map((e) => `${e.name}:${e.type}`).sort();
    expect(gnames).toEqual(["deep:dir", "intro.md:file"]);
  });

  it("grepFiles finds pattern and respects glob filter", async () => {
    const cid = await createCollection("c-grep");
    await engine.writeFile(cid, "hello.md", "Hello World\nfoo\n");
    await engine.writeFile(cid, "notes.txt", "nothing matches here\n");

    const all = await engine.grepFiles(cid, "Hello");
    expect(all.matches.map((m) => m.path)).toContain("hello.md");

    const md = await engine.grepFiles(cid, "Hello", { glob: "*.md" });
    expect(md.matches.length).toBe(1);
  });

  it("globFiles matches with * and **", async () => {
    const cid = await createCollection("c-glob");
    await engine.writeFile(cid, "a.md", "x\n");
    await engine.writeFile(cid, "nested/b.md", "x\n");

    const star = await engine.globFiles(cid, "*.md");
    expect(star.map((f) => f.path)).toEqual(["a.md"]);

    const deep = await engine.globFiles(cid, "**/*.md");
    const paths = deep.map((f) => f.path).sort();
    expect(paths).toEqual(["a.md", "nested/b.md"]);
  });

  it("getLog returns commits newest-first with path filter", async () => {
    const cid = await createCollection("c-log");
    await engine.writeFile(cid, "a.md", "one\n");
    await engine.writeFile(cid, "b.md", "two\n");
    await engine.writeFile(cid, "a.md", "one\ntwo\n");

    const all = await engine.getLog(cid, { limit: 10 });
    expect(all.length).toBe(3);

    const aOnly = await engine.getLog(cid, { path: "a.md", limit: 10 });
    expect(aOnly.length).toBe(2);
  });

  it("getDiff returns unified diff of the latest commit", async () => {
    const cid = await createCollection("c-diff");
    await engine.writeFile(cid, "doc.md", "alpha\nbeta\n");
    await engine.writeFile(cid, "doc.md", "alpha\ngamma\n");

    const d = await engine.getDiff(cid);
    expect(d.diff).toContain("-beta");
    expect(d.diff).toContain("+gamma");
    expect(d.stats.additions).toBe(1);
    expect(d.stats.deletions).toBe(1);
  });

  it("getBlame attributes each line to the inserting commit", async () => {
    const cid = await createCollection("c-blame");
    const c1 = await engine.writeFile(cid, "f.md", "line1\nline2\n");
    const c2 = await engine.writeFile(cid, "f.md", "line1\nline1.5\nline2\n");

    const blame = await engine.getBlame(cid, "f.md");
    expect(blame.length).toBe(3);
    expect(blame[0].commit).toBe(c1.commit);
    expect(blame[1].commit).toBe(c2.commit); // inserted in second write
    expect(blame[2].commit).toBe(c1.commit);
  });

  it("rejects absolute paths and traversal", async () => {
    const cid = await createCollection("c-validate");
    await expect(engine.writeFile(cid, "/abs.md", "x\n")).rejects.toThrow();
    await expect(engine.writeFile(cid, "../escape.md", "x\n")).rejects.toThrow();
  });
});
