import type { ErrorHandler } from "hono";
import { AppError } from "@openarti/shared";

// Mirror the CORS headers set by the app-level cors() middleware.
// Hono's cors middleware post-processing does NOT run when a route throws —
// the error unwinds past it into onError — so error responses would otherwise
// go back without Access-Control-Allow-Origin and the browser reports them
// as generic "CORS error" instead of the real status + body.
function applyCorsHeaders(req: Request, res: Response): Response {
  const origin = req.headers.get("origin");
  const allowed = process.env.WEB_ORIGIN || "http://localhost:3000";
  if (origin && origin === allowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.append("Vary", "Origin");
  }
  return res;
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    const res = c.json(
      { error: { code: err.code, message: err.message } },
      err.statusCode as 400
    );
    return applyCorsHeaders(c.req.raw, res);
  }

  console.error("Unhandled error:", err);
  const res = c.json(
    { error: { code: "internal_error", message: "Internal server error" } },
    500
  );
  return applyCorsHeaders(c.req.raw, res);
};
