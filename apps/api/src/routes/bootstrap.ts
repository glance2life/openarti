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
    const t0 = Date.now();
    const step = (label: string) =>
      console.log(`[bootstrap/admin] ${label} ${Date.now() - t0}ms`);

    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      throw new AppError(ErrorCode.FORBIDDEN, "Admin bootstrap is not configured");
    }
    step("config-loaded");

    const { email, name, password } = c.req.valid("json");
    if (email.trim().toLowerCase() !== adminEmail) {
      throw new AppError(ErrorCode.FORBIDDEN, "Email does not match ADMIN_EMAIL");
    }

    if (await adminUserExists(adminEmail)) {
      throw new AppError(ErrorCode.FORBIDDEN, "Admin account already exists");
    }
    step("exists-checked");

    const username = await pickUsername(adminEmail);
    step("username-picked");

    const res = await auth.api.signUpEmail({
      body: { email: adminEmail, name, password, username },
      asResponse: true,
    });
    step(`signup-done ok=${res.ok} status=${res.status}`);

    // Promote to admin AFTER better-auth's transaction commits. Doing this
    // inside the user.create.after hook deadlocks: the hook fires while the
    // INSERT transaction still holds a row lock, and our UPDATE (on the
    // global pool) waits on that lock while the transaction waits on the
    // hook — Vercel kills the function after 30s.
    if (res.ok) {
      try {
        await db
          .update(schema.users)
          .set({ role: "admin" })
          .where(eq(schema.users.email, adminEmail));
        step("promoted");
      } catch (err) {
        console.error("Failed to promote admin user:", adminEmail, err);
      }
    }

    return res;
  }
);
