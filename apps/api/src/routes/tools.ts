import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { gitService } from "../services/git.js";
import { resolveRepo, checkAccess } from "../services/repo.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import type { AuthUser } from "../middleware/auth.js";
import { AppError, ErrorCode } from "@openarti/shared";

const tools = new Hono();

const readSchema = z.object({
  path: z.string().min(1),
  offset: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  ref: z.string().optional(),
});

const writeSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  message: z.string().optional(),
});

const editSchema = z.object({
  path: z.string().min(1),
  old_string: z.string().optional(),
  new_string: z.string().optional(),
  replace_all: z.boolean().optional(),
  edits: z
    .array(
      z.object({
        old_string: z.string(),
        new_string: z.string(),
      })
    )
    .optional(),
  message: z.string().optional(),
});

const rmSchema = z.object({
  path: z.string().min(1),
  message: z.string().optional(),
});

const grepSchema = z.object({
  pattern: z.string().min(1),
  glob: z.string().optional(),
  context: z.number().int().nonnegative().optional(),
  ignore_case: z.boolean().optional(),
});

const globSchema = z.object({
  pattern: z.string().min(1),
});

const logSchema = z.object({
  path: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

const diffSchema = z.object({
  path: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const blameSchema = z.object({
  path: z.string().min(1),
});

const lsSchema = z.object({
  path: z.string().optional(),
});

// read — conditional auth (public repos don't need auth)
tools.post(
  "/:owner/:repo/tools/read",
  optionalAuthMiddleware,
  zValidator("json", readSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const result = await gitService.readFile(resolved.gitPath, body.path, {
      ref: body.ref,
      offset: body.offset,
      limit: body.limit,
    });

    return c.json({
      path: body.path,
      content: result.content,
      lines: result.lines,
      commit: result.commit,
    });
  }
);

// write — requires auth
tools.post(
  "/:owner/:repo/tools/write",
  authMiddleware,
  zValidator("json", writeSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const user = c.get("user");
    const resolved = await resolveRepo(owner, repoName);
    await checkAccess(user.id, resolved.teamId);

    const result = await gitService.writeFile(resolved.gitPath, body.path, body.content, {
      message: body.message,
      author: `${user.name} <${user.email}>`,
    });

    return c.json({
      path: body.path,
      commit: result.commit,
      created: result.created,
    });
  }
);

// edit — requires auth
tools.post(
  "/:owner/:repo/tools/edit",
  authMiddleware,
  zValidator("json", editSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const user = c.get("user");
    const resolved = await resolveRepo(owner, repoName);
    await checkAccess(user.id, resolved.teamId);

    // Build edits array from either singular or batch form
    let edits: { old_string: string; new_string: string }[];
    if (body.edits && body.edits.length > 0) {
      edits = body.edits;
    } else if (body.old_string !== undefined && body.new_string !== undefined) {
      edits = [{ old_string: body.old_string, new_string: body.new_string }];
    } else {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "Either old_string/new_string or edits array is required"
      );
    }

    const result = await gitService.editFile(resolved.gitPath, body.path, edits, {
      replaceAll: body.replace_all,
      message: body.message,
      author: `${user.name} <${user.email}>`,
    });

    return c.json({
      path: body.path,
      commit: result.commit,
      replaced: result.replaced,
    });
  }
);

// ls — conditional auth
tools.post(
  "/:owner/:repo/tools/ls",
  optionalAuthMiddleware,
  zValidator("json", lsSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const entries = await gitService.listFiles(resolved.gitPath, body.path);
    return c.json({ entries });
  }
);

// rm — requires auth
tools.post(
  "/:owner/:repo/tools/rm",
  authMiddleware,
  zValidator("json", rmSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const user = c.get("user");
    const resolved = await resolveRepo(owner, repoName);
    await checkAccess(user.id, resolved.teamId);

    const result = await gitService.removeFile(resolved.gitPath, body.path, {
      message: body.message,
      author: `${user.name} <${user.email}>`,
    });

    return c.json({ path: body.path, commit: result.commit });
  }
);

// grep — conditional auth
tools.post(
  "/:owner/:repo/tools/grep",
  optionalAuthMiddleware,
  zValidator("json", grepSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const result = await gitService.grepFiles(resolved.gitPath, body.pattern, {
      glob: body.glob,
      context: body.context,
      ignoreCase: body.ignore_case,
    });

    return c.json({ matches: result.matches, total_matches: result.totalMatches });
  }
);

// glob — conditional auth
tools.post(
  "/:owner/:repo/tools/glob",
  optionalAuthMiddleware,
  zValidator("json", globSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const files = await gitService.globFiles(resolved.gitPath, body.pattern);
    return c.json({ files });
  }
);

// log — conditional auth
tools.post(
  "/:owner/:repo/tools/log",
  optionalAuthMiddleware,
  zValidator("json", logSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const commits = await gitService.getLog(resolved.gitPath, {
      path: body.path,
      limit: body.limit,
    });
    return c.json({ commits });
  }
);

// diff — conditional auth
tools.post(
  "/:owner/:repo/tools/diff",
  optionalAuthMiddleware,
  zValidator("json", diffSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const result = await gitService.getDiff(resolved.gitPath, {
      path: body.path,
      from: body.from,
      to: body.to,
    });

    return c.json({
      path: body.path,
      diff: result.diff,
      stats: result.stats,
    });
  }
);

// blame — conditional auth
tools.post(
  "/:owner/:repo/tools/blame",
  optionalAuthMiddleware,
  zValidator("json", blameSchema),
  async (c) => {
    const { owner, repo: repoName } = c.req.param();
    const body = c.req.valid("json");
    const resolved = await resolveRepo(owner, repoName);
    const user = c.get("user") as AuthUser | undefined;

    if (resolved.visibility === "private") {
      if (!user) {
        throw new AppError(ErrorCode.UNAUTHORIZED, "Authentication required for private repos");
      }
      await checkAccess(user.id, resolved.teamId);
    }

    const lines = await gitService.getBlame(resolved.gitPath, body.path);
    return c.json({ path: body.path, lines });
  }
);

export { tools };
