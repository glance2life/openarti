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
    <html lang="en" className="font-sans">
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  );
}
