import { getStoredToken } from "./commands/login.js";

export interface ResolvedContext {
  endpoint: string;
  token: string | undefined;
}

export function resolveContext(globalOpts: {
  token?: string;
  endpoint?: string;
}): ResolvedContext {
  const endpoint =
    globalOpts.endpoint ||
    process.env.OPENARTI_ENDPOINT ||
    "https://api.openarti.dev";

  // Priority: --token flag > env var > stored credentials
  const token = globalOpts.token || process.env.OPENARTI_TOKEN || getStoredToken();

  return { endpoint, token };
}

export async function apiRequest<T>(
  ctx: ResolvedContext,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (ctx.token) {
    headers["Authorization"] = `Bearer ${ctx.token}`;
  }

  const res = await fetch(`${ctx.endpoint}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized. Set OPENARTI_TOKEN or pass --token.");
    }
    const errMsg =
      (json as { error?: { message?: string } }).error?.message ||
      `HTTP ${res.status}`;
    throw new Error(errMsg);
  }

  return json as T;
}
