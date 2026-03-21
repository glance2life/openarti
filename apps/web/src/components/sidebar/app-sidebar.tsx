"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SidebarTeamSwitcher } from "./sidebar-team-switcher";
import { SidebarDynamicContent } from "./sidebar-dynamic-content";
import { SidebarPinnedItems } from "./sidebar-pinned-items";
import { usePinsContext } from "@/hooks/pins-context";
import { Home, Settings } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description: string;
  role: string;
}

interface AppSidebarProps {
  teams: Team[];
  activeTeam: string;
}

export function AppSidebar({ teams, activeTeam }: AppSidebarProps) {
  const { pins, addPin, removePin, removePinByPath, isPinned } =
    usePinsContext();
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const inRepo =
    segments.length >= 2 &&
    segments[0] === activeTeam &&
    segments[1] !== "settings";

  return (
    <aside className="flex h-screen w-[260px] min-w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      {/* Top: Team switcher */}
      <div className="px-2 py-1.5 mb-2">
        <SidebarTeamSwitcher teams={teams} activeTeam={activeTeam} />
      </div>

      {/* Home link */}
      <div className="px-2">
        <Link
          href={`/${activeTeam}`}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
            segments.length === 1 && segments[0] === activeTeam
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          <Home className="size-4" />
          Home
        </Link>
      </div>

      {/* Middle: Dynamic content + Pinned items */}
      <ScrollArea className="flex-1 px-2 py-2">
        <SidebarDynamicContent
          activeTeam={activeTeam}
          isPinned={isPinned}
          onPin={addPin}
          onUnpin={removePinByPath}
        />
        {!inRepo && (
          <>
            <div className="mt-6" />
            <SidebarPinnedItems
              team={activeTeam}
              pins={pins}
              onUnpin={removePin}
            />
          </>
        )}
      </ScrollArea>

      {/* Bottom: Settings */}
      <Separator />
      <div className="px-2 py-2">
        <Link
          href={`/${activeTeam}/settings`}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Settings className="size-4" />
          Settings
        </Link>
      </div>
    </aside>
  );
}
