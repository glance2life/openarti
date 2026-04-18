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
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  const url = `${proto}://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const vv of v) headers.append(k, vv);
    else headers.set(k, String(v));
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
}
