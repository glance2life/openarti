"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, LogOut } from "lucide-react";

interface Team {
  id: string;
  name: string;
  role: string;
}

interface SidebarTeamSwitcherProps {
  teams: Team[];
  activeTeam: string;
}

export function SidebarTeamSwitcher({
  teams,
  activeTeam,
}: SidebarTeamSwitcherProps) {
  const router = useRouter();
  const initial = activeTeam.charAt(0).toUpperCase();

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-sidebar-accent outline-none transition-colors">
        <Avatar className="size-6">
          <AvatarFallback className="bg-blue-600 text-white text-xs font-medium">{initial}</AvatarFallback>
        </Avatar>
        <span className="truncate text-left font-semibold">{activeTeam}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="bottom" align="start" className="w-64">
        {/* Current team info */}
        <div className="px-1.5 py-1.5">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-blue-600 text-white text-base font-medium">{initial}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{activeTeam}</p>
              <p className="text-xs text-muted-foreground">Team</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => router.push(`/${activeTeam}/settings`)}
          >
            Settings
          </Button>
        </div>

        <DropdownMenuSeparator />

        {/* Team list */}
        <div className="px-1.5 py-1">
          <p className="text-xs font-medium text-muted-foreground">Team & Personal</p>
        </div>
        {teams.map((team) => {
          const teamInitial = team.name.charAt(0).toUpperCase();
          return (
            <DropdownMenuItem
              key={team.id}
              onClick={() => router.push(`/${team.name}`)}
              className="gap-2"
            >
              <Avatar className="size-6">
                <AvatarFallback className="bg-blue-600 text-white text-xs">{teamInitial}</AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate">{team.name}</span>
              {team.name === activeTeam && (
                <Check className="size-4 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Log out */}
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
