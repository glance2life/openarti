import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { createGettingStartedCollection } from "./services/template.js";

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
        after: async (user) => {
          try {
            // Look up username from the users table (better-auth may not include it in the hook payload)
            const [dbUser] = await db
              .select({ username: schema.users.username })
              .from(schema.users)
              .where(eq(schema.users.id, user.id))
              .limit(1);

            const username = dbUser?.username || user.id.slice(0, 8);

            const gitPath = await createGettingStartedCollection(username);
            if (gitPath) {
              await db.insert(schema.collections).values({
                ownerId: user.id,
                name: "getting-started",
                description: "Examples and playground for OpenArti",
                gitPath,
              });
            }
          } catch (err) {
            console.error("Failed to create getting-started collection for user:", user.id, err);
          }
        },
      },
    },
  },
});
