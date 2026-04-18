import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export async function pickUsername(email: string): Promise<string> {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "user";

  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base}-${randomSuffix()}`;
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${randomSuffix()}-${randomSuffix()}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
