"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsNavProps {
  team: string;
}

const ITEMS = [
  { href: "profile", label: "Profile" },
  { href: "api-keys", label: "API Keys" },
  { href: "members", label: "Members" },
];

export function SettingsNav({ team }: SettingsNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex w-[200px] min-w-[200px] flex-col gap-1 py-8 pl-8">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Settings</h1>

      {ITEMS.map((item) => {
        const href = `/${team}/settings/${item.href}`;
        const isActive = pathname === href;
        return (
          <Link
            key={item.href}
            href={href}
            className={`block py-1.5 text-sm transition-colors ${
              isActive
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
