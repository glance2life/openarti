import { Hono } from "hono";
import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { auth } from "../auth.js";

const BASE_URL = process.env.BETTER_AUTH_URL || "http://localhost:3001";
const WEB_ORIGIN = (process.env.WEB_ORIGIN || "http://localhost:3000").split(",")[0].trim();

export const oauth = new Hono();

// ---- OAuth 2.0 Authorization Server Metadata (RFC 8414) ----

oauth.get("/.well-known/oauth-authorization-server", (c) => {
  return c.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/oauth/authorize`,
    token_endpoint: `${BASE_URL}/oauth/token`,
    registration_endpoint: `${BASE_URL}/oauth/register`,
    revocation_endpoint: `${BASE_URL}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["openapi:read", "openapi:write"],
  });
});

// ---- OAuth Protected Resource Metadata (RFC 9728) ----

oauth.get("/.well-known/oauth-protected-resource", (c) => {
  return c.json({
    resource: `${BASE_URL}/mcp`,
    authorization_servers: [BASE_URL],
    scopes_supported: ["openapi:read", "openapi:write"],
    bearer_methods_supported: ["header"],
    resource_name: "OpenArti MCP Server",
  });
});

// ---- Dynamic Client Registration (RFC 7591) ----

oauth.post("/oauth/register", async (c) => {
  const body = await c.req.json();
  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomBytes(32).toString("hex");

  await db.insert(schema.oauthClients).values({
    clientId,
    clientSecret,
    clientName: body.client_name || null,
    redirectUris: JSON.stringify(body.redirect_uris || []),
    grantTypes: JSON.stringify(body.grant_types || ["authorization_code"]),
    responseTypes: JSON.stringify(body.response_types || ["code"]),
    clientUri: body.client_uri || null,
    logoUri: body.logo_uri || null,
    scope: body.scope || null,
  });

  return c.json(
    {
      client_id: clientId,
      client_secret: clientSecret,
      client_name: body.client_name,
      redirect_uris: body.redirect_uris || [],
      grant_types: body.grant_types || ["authorization_code"],
      response_types: body.response_types || ["code"],
      client_uri: body.client_uri,
      logo_uri: body.logo_uri,
      scope: body.scope,
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    201
  );
});

// ---- Authorization Endpoint ----
// GET /oauth/authorize — redirect to web app consent page

oauth.get("/oauth/authorize", async (c) => {
  const clientId = c.req.query("client_id") || "";
  const redirectUri = c.req.query("redirect_uri") || "";
  const state = c.req.query("state") || "";
  const codeChallenge = c.req.query("code_challenge") || "";
  const scope = c.req.query("scope") || "";

  // Redirect to web app consent page with all params
  const consentUrl = new URL(`${WEB_ORIGIN}/oauth/authorize`);
  consentUrl.searchParams.set("client_id", clientId);
  consentUrl.searchParams.set("redirect_uri", redirectUri);
  consentUrl.searchParams.set("state", state);
  consentUrl.searchParams.set("code_challenge", codeChallenge);
  consentUrl.searchParams.set("scope", scope);

  return c.redirect(consentUrl.toString());
});

// POST /oauth/authorize — called by the web consent page to approve

oauth.post("/oauth/authorize", async (c) => {
  // Authenticate via session cookie
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "unauthorized", error_description: "Not logged in" }, 401);
  }

  const body = await c.req.json();
  const { client_id, redirect_uri, state, code_challenge, scope } = body;

  // Validate client exists
  const [client] = await db
    .select()
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.clientId, client_id))
    .limit(1);

  if (!client) {
    return c.json({ error: "invalid_client", error_description: "Unknown client" }, 400);
  }

  // Validate redirect_uri (allow any localhost port per RFC 8252 for native apps)
  const allowedUris: string[] = JSON.parse(client.redirectUris);
  const redirectUrl = new URL(redirect_uri);
  const isLocalhostRedirect =
    redirectUrl.hostname === "localhost" || redirectUrl.hostname === "127.0.0.1";
  const hasLocalhostRegistered = allowedUris.some((u) => {
    try {
      const parsed = new URL(u);
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  });
  if (!allowedUris.includes(redirect_uri) && !(isLocalhostRedirect && hasLocalhostRegistered)) {
    return c.json({ error: "invalid_request", error_description: "Invalid redirect_uri" }, 400);
  }

  // Generate authorization code
  const code = crypto.randomBytes(32).toString("hex");
  await db.insert(schema.oauthCodes).values({
    code,
    clientId: client_id,
    userId: session.user.id,
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    scope: scope || null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });

  // Build redirect URL with code
  const callbackUrl = new URL(redirect_uri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return c.json({ redirect_uri: callbackUrl.toString() });
});

// ---- Token Endpoint ----

oauth.post("/oauth/token", async (c) => {
  const body = await c.req.parseBody();
  const grantType = body.grant_type as string;

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  const code = body.code as string;
  const codeVerifier = body.code_verifier as string;
  const redirectUri = body.redirect_uri as string;

  // Look up auth code
  const [authCode] = await db
    .select()
    .from(schema.oauthCodes)
    .where(and(eq(schema.oauthCodes.code, code), eq(schema.oauthCodes.used, false)))
    .limit(1);

  if (!authCode || authCode.expiresAt < new Date()) {
    return c.json({ error: "invalid_grant", error_description: "Code expired or invalid" }, 400);
  }

  if (authCode.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "Redirect URI mismatch" }, 400);
  }

  // Verify PKCE code_verifier against stored code_challenge (S256)
  const expectedChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  if (expectedChallenge !== authCode.codeChallenge) {
    return c.json({ error: "invalid_grant", error_description: "Code verifier mismatch" }, 400);
  }

  // Mark code as used
  await db
    .update(schema.oauthCodes)
    .set({ used: true })
    .where(eq(schema.oauthCodes.code, code));

  // Fetch client name for the label
  const [client] = await db
    .select({ clientName: schema.oauthClients.clientName })
    .from(schema.oauthClients)
    .where(eq(schema.oauthClients.clientId, authCode.clientId))
    .limit(1);

  // Create an API key as the access token
  const rawKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const hexPart = rawKey.slice(3);
  const keyHint = `sk_${hexPart.slice(0, 3)}...${hexPart.slice(-3)}`;
  const label = `MCP - ${client?.clientName || authCode.clientId}`;

  await db.insert(schema.apiKeys).values({
    userId: authCode.userId,
    keyHash,
    keyHint,
    label,
  });

  return c.json({
    access_token: rawKey,
    token_type: "Bearer",
    scope: authCode.scope || "",
  });
});

// ---- Token Revocation ----

oauth.post("/oauth/revoke", async (c) => {
  const body = await c.req.parseBody();
  const token = body.token as string;
  if (!token) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const keyHash = crypto.createHash("sha256").update(token).digest("hex");
  await db
    .delete(schema.apiKeys)
    .where(eq(schema.apiKeys.keyHash, keyHash));

  return c.body(null, 200);
});
