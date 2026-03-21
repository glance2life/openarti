import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./index.js";
import { auth } from "../auth.js";

async function seed() {
  console.log("Seeding database...");

  const email = process.env.ADMIN_EMAIL || "admin@openarti.dev";
  const password =
    process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");

  // Check if user already exists
  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing) {
    console.log("Admin user already exists, skipping seed.");
    process.exit(0);
  }

  // Create admin user via better-auth
  const { user } = await auth.api.signUpEmail({
    body: { name: "admin", email, password },
  });

  // Set role to admin
  await db
    .update(schema.users)
    .set({ role: "admin" })
    .where(eq(schema.users.id, user.id));

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
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Role:     admin`);
  console.log(`Team:     ${team.name}`);
  console.log(`API Key:  ${rawKey}`);
  console.log("Save these credentials — they cannot be retrieved again.\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
