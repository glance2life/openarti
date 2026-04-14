import { createAuthClient } from "better-auth/react";
import type { genericOAuth } from "better-auth/plugins/generic-oauth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  plugins: [
    {
      id: "generic-oauth-client",
      $InferServerPlugin: {} as ReturnType<typeof genericOAuth>,
    },
  ],
});
