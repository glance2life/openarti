"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiKeys } from "@/components/api-keys";
import { LogOut, User, KeyRound } from "lucide-react";

type Section = "account" | "api-keys";

interface SettingsDialogProps {
  user: { name: string; email: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({
  user,
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const [section, setSection] = useState<Section>("account");

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

  const navItems: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: "account", label: "Account", icon: <User className="size-4" /> },
    {
      key: "api-keys",
      label: "API Keys",
      icon: <KeyRound className="size-4" />,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden top-[12%] -translate-y-0">
        <div className="flex h-[70vh]">
          {/* Left nav */}
          <nav className="w-[180px] shrink-0 border-r flex flex-col gap-1 p-3">
            <DialogHeader className="px-3 pb-3">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  section === item.key
                    ? "bg-muted/50 text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === "account" && (
              <div className="space-y-6">
                <h2 className="text-base font-medium">Account</h2>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="size-12">
                      <AvatarFallback className="text-lg">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="size-4" />
                    Log out
                  </Button>
                </div>
              </div>
            )}

            {section === "api-keys" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-medium">API Keys</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    For scripts, CI/CD, and direct API access.
                  </p>
                </div>
                <ApiKeys />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
