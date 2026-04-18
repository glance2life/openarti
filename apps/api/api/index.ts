import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../dist/app.js";

// Vercel's @vercel/node@3 runtime parses JSON bodies into `req.body` before
// invoking this handler, draining the raw IncomingMessage stream in the
// process. @hono/node-server/vercel's `handle()` then tries
// `Readable.toWeb(incoming)` for POST/PUT bodies and hangs forever because
// the stream has already been consumed. We reconstruct the body from
// `req.body` (or `req.rawBody` when present) and dispatch into Hono directly.
type VercelRequest = IncomingMessage & {
  body?: unknown;
  rawBody?: Buffer | string;
};

export default async function handler(
  req: VercelRequest,
  res: ServerResponse
) {
  try {
    const proto = (req.headers["x-forwarded-proto"] as string) || "https";
    const host =
      (req.headers["x-forwarded-host"] as string) ||
      req.headers.host ||
      "localhost";
    const url = `${proto}://${host}${req.url ?? "/"}`;

    // HTTP/2 pseudo-headers (":authority", ":path", ...) and anything else
    // that fails Headers' strict name validation would otherwise crash the
    // function before Hono's onError ever runs. Skip them silently.
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v === undefined) continue;
      if (k.startsWith(":")) continue;
      try {
        if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
        else headers.set(k, String(v));
      } catch {
        // Ignore malformed header names.
      }
    }

    const method = req.method ?? "GET";
    let body: BodyInit | null = null;
    if (!["GET", "HEAD"].includes(method)) {
      if (req.rawBody !== undefined && req.rawBody !== null) {
        body = req.rawBody as BodyInit;
      } else if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
          body = req.body as BodyInit;
        } else {
          body = JSON.stringify(req.body);
          if (!headers.has("content-type")) {
            headers.set("content-type", "application/json");
          }
        }
      }
    }

    const request = new Request(url, { method, headers, body });
    const response = await app.fetch(request);

    res.statusCode = response.status;
    response.headers.forEach((v, k) => res.setHeader(k, v));
    const arrayBuf = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
  } catch (err) {
    // Log with stack so the real cause shows up in Vercel runtime logs
    // instead of a bare FUNCTION_INVOCATION_FAILED.
    console.error("[api/handler] uncaught", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
    }
    res.end(
      JSON.stringify({
        error: {
          code: "dispatch_failed",
          message: (err as Error)?.message ?? "unknown",
        },
      })
    );
  }
}
