"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { InvitationsAdmin } from "@/components/invitations-admin";
import { ArrowLeft, LogOut, User, KeyRound, UserPlus } from "lucide-react";

type Section = "account" | "api-keys" | "invitations";

interface SettingsDialogProps {
  user: { name: string; email: string; role: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTIONS: readonly Section[] = ["account", "api-keys", "invitations"];

const RETURN_TO_LABELS: Record<string, string> = {
  connect: "Connect",
};

function isSection(v: string | null): v is Section {
  return v !== null && (SECTIONS as readonly string[]).includes(v);
}

export function SettingsDialog({
  user,
  open,
  onOpenChange,
}: SettingsDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const returnToParam = searchParams.get("returnTo");
  const [section, setSection] = useState<Section>(
    isSection(sectionParam) ? sectionParam : "account",
  );

  function handleBack() {
    if (!returnToParam) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("dialog", returnToParam);
    params.delete("section");
    params.delete("returnTo");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    if (open && isSection(sectionParam)) {
      setSection(sectionParam);
    }
  }, [open, sectionParam]);

  const returnToLabel = returnToParam
    ? RETURN_TO_LABELS[returnToParam] ?? "Back"
    : null;

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
    ...(user.role === "admin"
      ? ([
          {
            key: "invitations" as const,
            label: "Invitations",
            icon: <UserPlus className="size-4" />,
          },
        ])
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden top-[10%] -translate-y-0">
        <div className="flex h-[80vh]">
          {/* Left nav */}
          <nav className="w-[180px] shrink-0 border-r flex flex-col gap-1 p-3">
            <DialogHeader className="px-3 pb-3">
              <DialogTitle>Settings</DialogTitle>
            </DialogHeader>
            {returnToParam && returnToLabel && (
              <button
                type="button"
                onClick={handleBack}
                className="mx-0 mb-2 flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                Back to {returnToLabel}
              </button>
            )}
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  section === item.key
                    ? "bg-muted/50 text-foreground"
                    : "text-foreground hover:bg-muted/30"
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

            {section === "invitations" && user.role === "admin" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-medium">Invitations</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invite users to this OpenArti instance. Links expire after 7
                    days.
                  </p>
                </div>
                <InvitationsAdmin />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
