import { Hono } from "hono";
import { cors } from "hono/cors";
import { eq } from "drizzle-orm";
import { auth } from "./auth.js";
import { db, schema } from "./db/index.js";
import { tools } from "./routes/tools.js";
import { collections } from "./routes/collections.js";
import { apikeys } from "./routes/apikeys.js";
import { admin } from "./routes/admin.js";
import { invitations } from "./routes/invitations.js";
import { bootstrap } from "./routes/bootstrap.js";
import { user } from "./routes/user.js";
import { pins } from "./routes/pins.js";
import { join } from "./routes/join.js";
import { oauth } from "./mcp/oauth.js";
import { mcp } from "./mcp/transport.js";
import { errorHandler } from "./middleware/error.js";

const app = new Hono();

// WEB_ORIGIN is comma-separated so the API can serve multiple frontends
// (e.g. apex + www). Strip whitespace and trailing slashes so minor
// misconfigurations don't silently drop Access-Control-Allow-Origin.
const allowedOrigins = (process.env.WEB_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const matchAllowedOrigin = (origin: string | undefined) =>
  origin && allowedOrigins.includes(origin) ? origin : null;

// MCP and OAuth endpoints need permissive CORS (MCP clients are not browsers)
app.use(
  "/mcp/*",
  cors({ origin: "*" })
);
app.use(
  "/mcp",
  cors({ origin: "*" })
);
app.use(
  "/oauth/*",
  cors({
    origin: matchAllowedOrigin,
    credentials: true,
  })
);
app.use(
  "/.well-known/*",
  cors({ origin: "*" })
);

app.use(
  "*",
  cors({
    origin: matchAllowedOrigin,
    credentials: true,
  })
);
app.onError(errorHandler);

// Root + health — respond explicitly so the Vercel function never falls
// through to Hono's notFound on "/" (which was surfacing as
// FUNCTION_INVOCATION_FAILED on api.openarti.com).
app.get("/", (c) => c.json({ name: "openarti-api", status: "ok" }));
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth config (public — tells web UI what's available)
app.get("/api/auth/config", async (c) => {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let adminBootstrap = false;
  if (adminEmail) {
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, adminEmail))
      .limit(1);
    adminBootstrap = !existing;
  }
  return c.json({
    allowRegistration: process.env.ALLOW_REGISTRATION === "true",
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    oidc: !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
    oidcLabel: process.env.OIDC_LABEL || "SSO",
    adminBootstrap,
  });
});

// better-auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// MCP + OAuth routes
app.route("/mcp", mcp);
app.route("/", oauth);

// Mount routes
app.route("/collections", tools);
app.route("/collections", collections);
app.route("/api-keys", apikeys);
app.route("/admin", admin);
app.route("/invitations", invitations);
app.route("/bootstrap", bootstrap);
app.route("/user", user);
app.route("/pins", pins);
app.route("/join", join);

export { app };
