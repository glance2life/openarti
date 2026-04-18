import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { auth } from "../auth.js";
import { pickUsername } from "../services/username.js";
import { AppError, ErrorCode } from "@openarti/shared";

export const bootstrap = new Hono();

function getAdminEmail(): string | null {
  const raw = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : null;
}

async function adminUserExists(email: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  return !!existing;
}

bootstrap.get("/admin", async (c) => {
  const adminEmail = getAdminEmail();
  if (!adminEmail) return c.json({ available: false });
  const exists = await adminUserExists(adminEmail);
  return c.json({ available: !exists });
});

bootstrap.post(
  "/admin",
  zValidator(
    "json",
    z.object({
      email: z.string().email(),
      name: z.string().min(1).max(100),
      password: z.string().min(8).max(200),
    })
  ),
  async (c) => {
    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      throw new AppError(ErrorCode.FORBIDDEN, "Admin bootstrap is not configured");
    }

    const { email, name, password } = c.req.valid("json");
    if (email.trim().toLowerCase() !== adminEmail) {
      throw new AppError(ErrorCode.FORBIDDEN, "Email does not match ADMIN_EMAIL");
    }

    if (await adminUserExists(adminEmail)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Admin account already exists");
    }

    const username = await pickUsername(adminEmail);

    return auth.api.signUpEmail({
      body: { email: adminEmail, name, password, username },
      asResponse: true,
    });
  }
);
