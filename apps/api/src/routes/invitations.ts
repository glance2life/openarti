import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { auth, inviteSignupContext } from "../auth.js";
import { AppError, ErrorCode } from "@openarti/shared";

export const invitations = new Hono();

// Public: preview an invitation by token.
// Returns the email it was issued to plus its status, so the register page
// can pre-fill / lock the email field and show a meaningful error.
invitations.get("/:token", async (c) => {
  const token = c.req.param("token");

  const [invite] = await db
    .select({
      email: schema.invitations.email,
      expiresAt: schema.invitations.expiresAt,
      acceptedAt: schema.invitations.acceptedAt,
    })
    .from(schema.invitations)
    .where(eq(schema.invitations.token, token))
    .limit(1);

  if (!invite) {
    throw new AppError(ErrorCode.NOT_FOUND, "Invitation not found");
  }

  return c.json({
    email: invite.email,
    expired: invite.expiresAt < new Date(),
    accepted: invite.acceptedAt !== null,
  });
});

// Public: redeem an invitation by creating the account.
// Bypasses ALLOW_REGISTRATION via inviteSignupContext, then marks the
// invitation as accepted. Returns the better-auth response so the browser
// receives the session cookie.
invitations.post(
  "/:token/redeem",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
      password: z.string().min(8).max(200),
    })
  ),
  async (c) => {
    const token = c.req.param("token");
    const { name, password } = c.req.valid("json");

    const [invite] = await db
      .select()
      .from(schema.invitations)
      .where(eq(schema.invitations.token, token))
      .limit(1);

    if (!invite) {
      throw new AppError(ErrorCode.NOT_FOUND, "Invitation not found");
    }
    if (invite.acceptedAt) {
      throw new AppError(ErrorCode.FORBIDDEN, "Invitation already used");
    }
    if (invite.expiresAt < new Date()) {
      throw new AppError(ErrorCode.FORBIDDEN, "Invitation has expired");
    }

    const username = await pickUsername(invite.email);

    const response = await inviteSignupContext.run(
      { email: invite.email },
      () =>
        auth.api.signUpEmail({
          body: { email: invite.email, name, password, username },
          asResponse: true,
        })
    );

    if (!response.ok) {
      // Forward better-auth's error body verbatim
      return new Response(response.body, {
        status: response.status,
        headers: response.headers,
      });
    }

    await db
      .update(schema.invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.invitations.id, invite.id));

    return response;
  }
);

async function pickUsername(email: string): Promise<string> {
  const base = email
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
