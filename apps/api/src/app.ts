import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth.js";
import { tools } from "./routes/tools.js";
import { repos } from "./routes/repos.js";
import { apikeys } from "./routes/apikeys.js";
import { admin } from "./routes/admin.js";
import { errorHandler } from "./middleware/error.js";

const app = new Hono();

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
  })
);

// better-auth handler
app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// Mount routes
app.route("/repos", tools);
app.route("/repos", repos);
app.route("/api-keys", apikeys);
app.route("/admin", admin);

export { app };
