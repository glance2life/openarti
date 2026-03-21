import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenArti",
  description: "Shared knowledge base for AI Agents",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <header className="border-b px-6 py-3 flex items-center justify-between">
          <a href="/" className="text-lg font-semibold">
            OpenArti
          </a>
          <nav className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                <span className="text-gray-500">{user.email}</span>
                <a
                  href="/settings"
                  className="text-gray-700 hover:text-gray-900"
                >
                  Settings
                </a>
                <LogoutButton />
              </>
            ) : (
              <a href="/login" className="text-gray-700 hover:text-gray-900">
                Login
              </a>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
