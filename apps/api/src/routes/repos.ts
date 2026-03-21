import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import path from "node:path";
import { db, schema } from "../db/index.js";
import { gitService } from "../services/git.js";
import { authMiddleware } from "../middleware/auth.js";
import { checkAccess } from "../services/repo.js";
import { AppError, ErrorCode } from "@openarti/shared";

const GIT_DATA_DIR = process.env.GIT_DATA_DIR || "./data/repos";

const repos = new Hono();

const createRepoSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  description: z.string().optional(),
  visibility: z.enum(["private", "public"]).optional(),
});

// Create repo under a team
repos.post(
  "/:team",
  authMiddleware,
  zValidator("json", createRepoSchema),
  async (c) => {
    const teamName = c.req.param("team");
    const body = c.req.valid("json");
    const user = c.get("user");

    // Find team
    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.name, teamName))
      .limit(1);

    if (!team) {
      throw new AppError(ErrorCode.NOT_FOUND, `Team '${teamName}' not found`);
    }

    await checkAccess(user.id, team.id);

    // Check duplicate
    const [existing] = await db
      .select()
      .from(schema.repos)
      .where(
        and(eq(schema.repos.teamId, team.id), eq(schema.repos.name, body.name))
      )
      .limit(1);

    if (existing) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Repo '${teamName}/${body.name}' already exists`
      );
    }

    const gitPath = path.resolve(GIT_DATA_DIR, teamName, `${body.name}.git`);

    // Init bare repo
    await gitService.initRepo(gitPath);

    // Insert into DB
    const [repo] = await db
      .insert(schema.repos)
      .values({
        teamId: team.id,
        name: body.name,
        description: body.description ?? "",
        visibility: body.visibility ?? "private",
        gitPath,
      })
      .returning();

    return c.json(
      {
        id: repo.id,
        name: repo.name,
        owner: teamName,
        description: repo.description,
        visibility: repo.visibility,
        created_at: repo.createdAt.toISOString(),
      },
      201
    );
  }
);

// List repos for a team
repos.get("/:team", async (c) => {
  const teamName = c.req.param("team");

  const [team] = await db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.name, teamName))
    .limit(1);

  if (!team) {
    throw new AppError(ErrorCode.NOT_FOUND, `Team '${teamName}' not found`);
  }

  const repoList = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.teamId, team.id));

  return c.json(
    repoList.map((r) => ({
      id: r.id,
      name: r.name,
      owner: teamName,
      description: r.description,
      visibility: r.visibility,
      created_at: r.createdAt.toISOString(),
    }))
  );
});

// Repo detail
repos.get("/:team/:repo", async (c) => {
  const teamName = c.req.param("team");
  const repoName = c.req.param("repo");

  const [row] = await db
    .select({
      id: schema.repos.id,
      name: schema.repos.name,
      description: schema.repos.description,
      visibility: schema.repos.visibility,
      createdAt: schema.repos.createdAt,
    })
    .from(schema.repos)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.repos.teamId))
    .where(and(eq(schema.teams.name, teamName), eq(schema.repos.name, repoName)))
    .limit(1);

  if (!row) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Repo '${teamName}/${repoName}' not found`
    );
  }

  return c.json({
    id: row.id,
    name: row.name,
    owner: teamName,
    description: row.description,
    visibility: row.visibility,
    created_at: row.createdAt.toISOString(),
  });
});

export { repos };
