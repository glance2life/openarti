const API_URL = process.env.OPENARTI_API_URL || "http://localhost:3001";

export async function apiFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const msg =
      (json as { error?: { message?: string } } | null)?.error?.message ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}
