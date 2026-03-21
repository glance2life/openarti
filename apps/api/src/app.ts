import { Hono } from "hono";
import { cors } from "hono/cors";
import { tools } from "./routes/tools.js";
import { repos } from "./routes/repos.js";
import { errorHandler } from "./middleware/error.js";

const app = new Hono();

app.use("*", cors());
app.onError(errorHandler);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Mount routes
app.route("/repos", tools);
app.route("/repos", repos);

export { app };
