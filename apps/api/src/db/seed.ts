import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "./index.js";
import { auth } from "../auth.js";

async function seed() {
  console.log("Seeding database...");

  const email = process.env.ADMIN_EMAIL || "admin@openarti.dev";
  const password =
    process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
  const username = process.env.ADMIN_USERNAME || "admin";

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
    body: { name: "admin", email, password, username },
  });

  // Set role to admin
  await db
    .update(schema.users)
    .set({ role: "admin" })
    .where(eq(schema.users.id, user.id));

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
  console.log(`Username: ${username}`);
  console.log(`Role:     admin`);
  console.log(`API Key:  ${rawKey}`);
  console.log("Save these credentials — they cannot be retrieved again.\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
