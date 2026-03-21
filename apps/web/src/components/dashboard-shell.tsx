"use client";

import { usePathname } from "next/navigation";
import { PinsProvider } from "@/hooks/pins-context";
import { AppSidebar } from "@/components/sidebar/app-sidebar";

interface Team {
  id: string;
  name: string;
  description: string;
  role: string;
}

interface DashboardShellProps {
  teams: Team[];
  children: React.ReactNode;
}

export function DashboardShell({ teams, children }: DashboardShellProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const activeTeam = segments[0] || teams[0]?.name || "";

  return (
    <PinsProvider activeTeam={activeTeam}>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar teams={teams} activeTeam={activeTeam} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-8 py-8">{children}</div>
        </main>
      </div>
    </PinsProvider>
  );
}
