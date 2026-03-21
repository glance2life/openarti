import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { AppError, ErrorCode } from "@openarti/shared";

export interface ResolvedRepo {
  repoId: string;
  teamId: string;
  teamName: string;
  repoName: string;
  visibility: "private" | "public";
  gitPath: string;
}

export async function resolveRepo(
  owner: string,
  repo: string
): Promise<ResolvedRepo> {
  const [row] = await db
    .select({
      repoId: schema.repos.id,
      teamId: schema.teams.id,
      teamName: schema.teams.name,
      repoName: schema.repos.name,
      visibility: schema.repos.visibility,
      gitPath: schema.repos.gitPath,
    })
    .from(schema.repos)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.repos.teamId))
    .where(and(eq(schema.teams.name, owner), eq(schema.repos.name, repo)))
    .limit(1);

  if (!row) {
    throw new AppError(
      ErrorCode.NOT_FOUND,
      `Repo '${owner}/${repo}' not found`
    );
  }

  return row;
}

export async function checkAccess(
  userId: string,
  teamId: string
): Promise<void> {
  const [member] = await db
    .select()
    .from(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.teamId, teamId),
        eq(schema.teamMembers.userId, userId)
      )
    )
    .limit(1);

  if (!member) {
    throw new AppError(ErrorCode.FORBIDDEN, "Not a member of this team");
  }
}
