"use client";

import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  }

  return (
    <button
      onClick={handleLogout}
      className="text-gray-500 hover:text-gray-900 transition-colors"
    >
      Logout
    </button>
  );
}
