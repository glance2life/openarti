import { headers } from "next/headers";

const API_URL = process.env.OPENARTI_API_URL || "http://localhost:3001";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const reqHeaders = await headers();
    const cookie = reqHeaders.get("cookie");
    if (!cookie) return null;

    const res = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.user) return null;

    return {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name,
      role: data.user.role ?? "member",
    };
  } catch {
    return null;
  }
}
