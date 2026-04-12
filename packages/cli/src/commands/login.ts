import { Command } from "commander";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { resolveContext } from "../api-client.js";

const CREDENTIALS_DIR = path.join(os.homedir(), ".openarti");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

export function getStoredToken(): string | undefined {
  try {
    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    return data.token;
  } catch {
    return undefined;
  }
}

function saveToken(token: string, endpoint: string) {
  fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
  fs.writeFileSync(
    CREDENTIALS_FILE,
    JSON.stringify({ token, endpoint, updated_at: new Date().toISOString() }, null, 2),
    { mode: 0o600 }
  );
}

function removeToken() {
  try {
    fs.unlinkSync(CREDENTIALS_FILE);
  } catch {
    // ignore
  }
}

export function registerLogin(program: Command) {
  program
    .command("login")
    .description("Authenticate with OpenArti via browser")
    .action(async () => {
      const ctx = resolveContext(program.opts());
      const endpoint = ctx.endpoint;

      // 1. Dynamic client registration
      const clientId = await registerClient(endpoint);

      // 2. Generate PKCE
      const codeVerifier = crypto.randomBytes(32).toString("base64url");
      const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
      const state = crypto.randomBytes(16).toString("hex");

      // 3. Start local server for callback
      const { port, codePromise } = startCallbackServer(state);
      const redirectUri = `http://localhost:${port}/callback`;

      // 4. Open browser
      const authUrl = new URL(`${endpoint}/oauth/authorize`);
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("code_challenge_method", "S256");

      console.log("Opening browser to authenticate...");
      const openCmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";

      const { execFile } = await import("node:child_process");
      execFile(openCmd, [authUrl.toString()], (err) => {
        if (err) {
          console.log(`\nOpen this URL in your browser:\n${authUrl.toString()}\n`);
        }
      });

      console.log("Waiting for authorization...\n");

      // 5. Wait for callback
      const code = await codePromise;

      // 6. Exchange code for token
      const tokenRes = await fetch(`${endpoint}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
          client_id: clientId,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        throw new Error(
          `Token exchange failed: ${(err as { error_description?: string }).error_description || (err as { error?: string }).error || "unknown error"}`
        );
      }

      const tokenData = (await tokenRes.json()) as { access_token: string };
      saveToken(tokenData.access_token, endpoint);

      console.log("Authenticated successfully. Token saved to ~/.openarti/credentials.json");
    });

  program
    .command("logout")
    .description("Remove stored authentication credentials")
    .action(() => {
      removeToken();
      console.log("Logged out. Credentials removed.");
    });

  program
    .command("whoami")
    .description("Show the currently authenticated user")
    .action(async () => {
      const ctx = resolveContext(program.opts());
      const token = ctx.token;
      if (!token) {
        console.log("Not logged in. Run `arti login` to authenticate.");
        return;
      }

      try {
        const res = await fetch(`${ctx.endpoint}/user/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.log("Not logged in or token expired. Run `arti login` to authenticate.");
          return;
        }
        const user = (await res.json()) as { name: string; email: string };
        console.log(`Logged in as ${user.name} (${user.email})`);
      } catch {
        console.log("Could not reach server.");
      }
    });
}

async function registerClient(endpoint: string): Promise<string> {
  const res = await fetch(`${endpoint}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "OpenArti CLI",
      redirect_uris: ["http://localhost"],
      grant_types: ["authorization_code"],
      response_types: ["code"],
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to register OAuth client");
  }

  const data = (await res.json()) as { client_id: string };
  return data.client_id;
}

function startCallbackServer(expectedState: string): {
  port: number;
  codePromise: Promise<string>;
} {
  let resolveCode: (code: string) => void;
  let rejectCode: (err: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost`);

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authorization denied</h1><p>You can close this tab.</p>");
        rejectCode(new Error(`Authorization denied: ${error}`));
        server.close();
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Invalid state</h1>");
        rejectCode(new Error("State mismatch"));
        server.close();
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>Missing code</h1>");
        rejectCode(new Error("Missing authorization code"));
        server.close();
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        "<h1>Authenticated!</h1><p>You can close this tab and return to the terminal.</p>"
      );
      resolveCode(code);
      server.close();
    }
  });

  server.listen(0);
  const port = (server.address() as { port: number }).port;

  // Timeout after 2 minutes
  setTimeout(() => {
    rejectCode(new Error("Authentication timed out"));
    server.close();
  }, 120_000);

  return { port, codePromise };
}
