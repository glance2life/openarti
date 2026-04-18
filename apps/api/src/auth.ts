import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "./db/index.js";

// Per-request flag: set by the invitation redeem flow to allow signup even
// when ALLOW_REGISTRATION is false.
export const inviteSignupContext = new AsyncLocalStorage<{ email: string }>();

const oidcEnabled = !!(
  process.env.OIDC_ISSUER &&
  process.env.OIDC_CLIENT_ID &&
  process.env.OIDC_CLIENT_SECRET
);

// WEB_ORIGIN is a comma-separated allowlist (apex + www + previews). Split
// it here too — passing the raw string into trustedOrigins made better-auth
// treat "a.com,b.com" as a single untrusted origin and return 403
// INVALID_ORIGIN on every sign-in/email from the web app.
const trustedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  plugins: [
    ...(oidcEnabled
      ? [
          genericOAuth({
            config: [
              {
                providerId: "oidc",
                discoveryUrl: `${process.env.OIDC_ISSUER}/.well-known/openid-configuration`,
                clientId: process.env.OIDC_CLIENT_ID!,
                clientSecret: process.env.OIDC_CLIENT_SECRET!,
                scopes: ["openid", "profile", "email"],
                pkce: true,
              },
            ],
          }),
        ]
      : []),
  ],
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: true,
        unique: true,
        input: true,
      },
      role: {
        type: "string",
        required: false,
        defaultValue: "member",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = (user as { email?: string }).email?.toLowerCase();

          const invite = inviteSignupContext.getStore();
          if (invite && invite.email.toLowerCase() === email) return;

          const allowRegistration = process.env.ALLOW_REGISTRATION === "true";
          if (allowRegistration) return;

          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          if (adminEmail && email === adminEmail) return;

          throw new APIError("FORBIDDEN", {
            message: "Registration is disabled",
          });
        },
        // Admin promotion used to run here, but better-auth's user.create
        // callback fires inside the same transaction as the INSERT. Running
        // a second UPDATE against the same row via the global `db` pool
        // deadlocked — the new connection waited on the row lock held by
        // the outer transaction, the transaction waited for this callback
        // to return. Promotion now happens in the /bootstrap/admin route
        // after signUpEmail resolves, when the transaction has committed.
      },
    },
  },
});
