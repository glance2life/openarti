import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authMiddleware, type AuthUser } from "../middleware/auth.js";

export const user = new Hono<{ Variables: { user: AuthUser } }>();

user.use("*", authMiddleware);

// List teams for the authenticated user
user.get("/teams", async (c) => {
  const currentUser = c.get("user");

  const rows = await db
    .select({
      id: schema.teams.id,
      name: schema.teams.name,
      description: schema.teams.description,
      role: schema.teamMembers.role,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.teamId))
    .where(eq(schema.teamMembers.userId, currentUser.id));

  return c.json({ teams: rows });
});
