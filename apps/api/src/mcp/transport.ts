import { Hono } from "hono";
import crypto from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "./server.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db/index.js";

const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3001";

export const mcp = new Hono();

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

// Stateless MCP — each POST spins up a fresh transport + server, returns JSON, no session.
// Works under any serverless runtime (Vercel Functions / Workers / Lambda).
mcp.post("/", async (c) => {
  const { authInfo } = await resolveAuthInfo(c.req.raw);

  if (!authInfo) {
    return c.json(
      { error: "unauthorized", error_description: "Valid API key required" },
      401,
      {
        "WWW-Authenticate": `Bearer realm="openarti", resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      },
    );
  }
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer();
  await server.connect(transport);

  try {
    return await transport.handleRequest(c.req.raw, { authInfo });
  } finally {
    // Best-effort cleanup; transport holds no long-lived state in stateless mode.
    transport.close().catch(() => {});
    server.close().catch(() => {});
  }
});

// Stateless mode: no server→client stream and no session lifecycle.
mcp.get("/", (c) =>
  c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Server-initiated streams are not supported in stateless mode",
      },
    },
    405,
  ),
);

mcp.delete("/", (c) =>
  c.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Session termination not applicable in stateless mode",
      },
    },
    405,
  ),
);
