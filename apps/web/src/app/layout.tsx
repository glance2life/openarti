import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenArti",
  description: "Shared knowledge base for AI Agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900 antialiased">
        <header className="border-b px-6 py-3">
          <a href="/" className="text-lg font-semibold">
            OpenArti
          </a>
        </header>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
