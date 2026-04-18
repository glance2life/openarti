import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
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

// Diagnostic: times each pre-signup step and reports which one stalls.
// Accessible without auth on purpose — only meaningful during bootstrap.
bootstrap.get("/diag", async (c) => {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const mark = (label: string) => {
    timings[label] = Date.now() - t0;
  };
  const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
    Promise.race<T>([
      p,
      new Promise<T>((_, rej) =>
        setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);

  try {
    const adminEmail = getAdminEmail();
    mark("read_env");
    if (!adminEmail) {
      return c.json({ ok: true, adminEmailSet: false, timings });
    }

    // Bare DB ping.
    await withTimeout(db.execute(sql`select 1`), 5000, "select_1");
    mark("select_1");

    const exists = await withTimeout(
      adminUserExists(adminEmail),
      5000,
      "adminUserExists"
    );
    mark("adminUserExists");

    const username = await withTimeout(
      pickUsername(adminEmail),
      5000,
      "pickUsername"
    );
    mark("pickUsername");

    return c.json({
      ok: true,
      adminEmailSet: true,
      adminExists: exists,
      username,
      timings,
      totalMs: Date.now() - t0,
    });
  } catch (err) {
    return c.json({
      ok: false,
      error: (err as Error).message,
      stack: (err as Error).stack?.split("\n").slice(0, 5),
      timings,
      totalMs: Date.now() - t0,
    });
  }
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
      console.log(`[bootstrap] +${Date.now() - t0}ms ${label}`);

    step("entered handler");

    const adminEmail = getAdminEmail();
    if (!adminEmail) {
      throw new AppError(ErrorCode.FORBIDDEN, "Admin bootstrap is not configured");
    }

    const { email, name, password } = c.req.valid("json");
    if (email.trim().toLowerCase() !== adminEmail) {
      throw new AppError(ErrorCode.FORBIDDEN, "Email does not match ADMIN_EMAIL");
    }

    step("pre adminUserExists");
    const exists = await adminUserExists(adminEmail);
    step(`post adminUserExists (exists=${exists})`);
    if (exists) {
      throw new AppError(ErrorCode.FORBIDDEN, "Admin account already exists");
    }

    step("pre pickUsername");
    const username = await pickUsername(adminEmail);
    step(`post pickUsername (username=${username})`);

    step("pre signUpEmail");
    try {
      const res = await auth.api.signUpEmail({
        body: { email: adminEmail, name, password, username },
        asResponse: true,
      });
      step(`post signUpEmail (status=${res.status})`);
      return res;
    } catch (err) {
      step(`signUpEmail threw: ${(err as Error)?.message || err}`);
      throw err;
    }
  }
);
