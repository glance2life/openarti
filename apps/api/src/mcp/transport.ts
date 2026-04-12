import { Hono } from "hono";
import crypto from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./server.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

export const mcp = new Hono();

// Map of sessionId → transport
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

async function resolveApiKey(rawKey: string) {
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const [row] = await db
    .select({
      userId: schema.apiKeys.userId,
      keyId: schema.apiKeys.id,
      enabled: schema.apiKeys.enabled,
      expiresAt: schema.apiKeys.expiresAt,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
    })
    .from(schema.apiKeys)
    .innerJoin(schema.users, eq(schema.users.id, schema.apiKeys.userId))
    .where(eq(schema.apiKeys.keyHash, keyHash))
    .limit(1);

  if (!row || !row.enabled) return null;
  if (row.expiresAt && row.expiresAt < new Date()) return null;

  // Fire-and-forget usage tracking
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date(), usageCount: sql`${schema.apiKeys.usageCount} + 1` })
    .where(eq(schema.apiKeys.id, row.keyId))
    .execute()
    .catch(() => {});

  return { id: row.userId, email: row.email, name: row.name, role: row.role ?? "member" };
}

function extractAuthInfo(req: Request): AuthInfo | undefined {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  const token = authHeader.slice(7);
  return {
    token,
    clientId: "mcp",
    scopes: [],
  };
}

async function resolveAuthInfo(req: Request): Promise<{ authInfo?: AuthInfo }> {
  const info = extractAuthInfo(req);
  if (!info) return {};

  const user = await resolveApiKey(info.token);
  if (!user) return {};

  return {
    authInfo: {
      ...info,
      extra: { user },
    },
  };
}

// POST /mcp — JSON-RPC messages
mcp.post("/", async (c) => {
  const { authInfo } = await resolveAuthInfo(c.req.raw);

  // Check if this is an initialization request (no session ID yet)
  const sessionId = c.req.header("mcp-session-id");

  if (!sessionId) {
    // New session — create transport and server
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
      onsessionclosed: (id) => {
        transports.delete(id);
      },
    });

    const server = createMcpServer();
    await server.connect(transport);

    return transport.handleRequest(c.req.raw, { authInfo });
  }

  // Existing session
  const transport = transports.get(sessionId);
  if (!transport) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Session not found" } },
      404
    );
  }

  return transport.handleRequest(c.req.raw, { authInfo });
});

// GET /mcp — SSE stream
mcp.get("/", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (!sessionId) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Session ID required" } },
      400
    );
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Session not found" } },
      404
    );
  }

  const { authInfo } = await resolveAuthInfo(c.req.raw);
  return transport.handleRequest(c.req.raw, { authInfo });
});

// DELETE /mcp — close session
mcp.delete("/", async (c) => {
  const sessionId = c.req.header("mcp-session-id");
  if (!sessionId) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Session ID required" } },
      400
    );
  }

  const transport = transports.get(sessionId);
  if (!transport) {
    return c.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Session not found" } },
      404
    );
  }

  return transport.handleRequest(c.req.raw);
});
