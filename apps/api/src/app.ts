import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";
import { tools } from "./routes/tools.js";
import { collections } from "./routes/collections.js";
import { apikeys } from "./routes/apikeys.js";
import { admin } from "./routes/admin.js";
import { user } from "./routes/user.js";
import { pins } from "./routes/pins.js";
import { join } from "./routes/join.js";
import { oauth } from "./mcp/oauth.js";
import { mcp } from "./mcp/transport.js";
import { errorHandler } from "./middleware/error.js";

const app = new Hono();

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
    origin: [process.env.WEB_ORIGIN || "http://localhost:3000"],
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
    origin: process.env.WEB_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.onError(errorHandler);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Auth config (public — tells web UI what's available)
app.get("/api/auth/config", (c) =>
  c.json({
    allowRegistration: process.env.ALLOW_REGISTRATION === "true",
    googleOAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    oidc: !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET),
    oidcLabel: process.env.OIDC_LABEL || "SSO",
  })
);

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
app.route("/user", user);
app.route("/pins", pins);
app.route("/join", join);

export { app };
