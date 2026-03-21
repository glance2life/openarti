import crypto from "node:crypto";
import { db, schema } from "./index.js";

async function seed() {
  console.log("Seeding database...");

  // Create default user
  const [user] = await db
    .insert(schema.users)
    .values({
      email: "admin@openarti.dev",
      name: "admin",
    })
    .onConflictDoNothing()
    .returning();

  if (!user) {
    console.log("User already exists, skipping seed.");
    process.exit(0);
  }

  // Create default team
  const [team] = await db
    .insert(schema.teams)
    .values({ name: "nestor" })
    .returning();

  // Add user as team owner
  await db.insert(schema.teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: "owner",
  });

  // Generate API key
  const rawKey = `oai_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  await db.insert(schema.apiKeys).values({
    userId: user.id,
    keyHash,
    label: "default",
  });

  console.log("\n--- Seed Complete ---");
  console.log(`User:    ${user.email}`);
  console.log(`Team:    ${team.name}`);
  console.log(`API Key: ${rawKey}`);
  console.log("Save this key — it cannot be retrieved again.\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
