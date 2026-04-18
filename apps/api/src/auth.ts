import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { populateGettingStartedCollection } from "./services/template.js";

const oidcEnabled = !!(
  process.env.OIDC_ISSUER &&
  process.env.OIDC_CLIENT_ID &&
  process.env.OIDC_CLIENT_SECRET
);

export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.WEB_ORIGIN || "http://localhost:3000"],
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
          const allowRegistration = process.env.ALLOW_REGISTRATION === "true";
          if (allowRegistration) return;

          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          const email = (user as { email?: string }).email?.toLowerCase();
          if (adminEmail && email === adminEmail) return;

          throw new APIError("FORBIDDEN", {
            message: "Registration is disabled",
          });
        },
        after: async (user) => {
          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          if (adminEmail && user.email?.toLowerCase() === adminEmail) {
            try {
              await db
                .update(schema.users)
                .set({ role: "admin" })
                .where(eq(schema.users.id, user.id));
            } catch (err) {
              console.error("Failed to promote admin user:", user.id, err);
            }
          }

          try {
            const [collection] = await db
              .insert(schema.collections)
              .values({
                ownerId: user.id,
                name: "getting-started",
                description: "Examples and playground for OpenArti",
              })
              .returning({ id: schema.collections.id });

            if (collection) {
              await populateGettingStartedCollection(collection.id);
            }
          } catch (err) {
            console.error("Failed to create getting-started collection for user:", user.id, err);
          }
        },
      },
    },
  },
});
