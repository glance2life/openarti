"use client";

import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { useOpenDialog } from "@/hooks/use-dialog-router";
import {
  Settings,
  LogOut,
  ChevronsUpDown,
  Github,
  ArrowUpRight,
} from "lucide-react";

interface SidebarUserSectionProps {
  user: { name: string; email: string; role: string };
}

export function SidebarUserSection({ user }: SidebarUserSectionProps) {
  const openDialog = useOpenDialog();

  const initial =
    user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase();

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
      <DropdownMenuTrigger className="flex w-full items-center gap-2 px-3 py-2 hover:bg-sidebar-accent outline-none transition-colors">
        <Avatar className="size-9">
          <AvatarFallback className="text-sm">{initial}</AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-left">{user.name}</span>
        <ChevronsUpDown className="size-3.5 opacity-40" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openDialog("settings")} className="group">
          <Settings className="size-4" />
          Settings
          <Kbd
            keys="mod+,"
            className="ml-auto opacity-0 transition-opacity group-data-[highlighted]:opacity-100"
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            window.open(
              "https://github.com/glance2life/openarti",
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          <Github className="size-4" />
          GitHub
          <ArrowUpRight className="ml-auto size-3.5 opacity-60" />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
