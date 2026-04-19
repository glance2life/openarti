"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Lock,
  Loader2,
  Trash2,
  TriangleAlert,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollectionMembers } from "@/components/collection-members";
import { collectionsQueryKey } from "@/components/sidebar/sidebar-collection-list";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Section = "general" | "members" | "danger";

interface CollectionSettingsDialogProps {
  owner: string;
  collection: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CollectionSettingsDialog({
  owner,
  collection,
  open,
  onOpenChange,
}: CollectionSettingsDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("general");
  const [visibility, setVisibility] = useState<"private" | "public" | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fullName = `${owner}/${collection}`;

  const fetchVisibility = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/collections/${owner}/${collection}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setVisibility(data.visibility);
      }
    } catch {
      // ignore
    }
  }, [owner, collection]);

  useEffect(() => {
    if (open) {
      setSection("general");
      setVisibility(null);
      setDeleteInput("");
      setDeleteError(null);
      fetchVisibility();
    }
  }, [open, fetchVisibility]);

  const toggleVisibility = useCallback(async () => {
    const next = visibility === "public" ? "private" : "public";
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/collections/${owner}/${collection}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: next }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setVisibility(data.visibility);
      }
    } finally {
      setLoading(false);
    }
  }, [owner, collection, visibility]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `${API_URL}/collections/${owner}/${collection}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          (data as { error?: { message?: string } } | null)?.error?.message ||
            `HTTP ${res.status}`
        );
      }
      await queryClient.invalidateQueries({ queryKey: collectionsQueryKey });
      onOpenChange(false);
      if (pathname.startsWith(`/${owner}/${collection}`)) {
        router.push("/");
      }
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }, [owner, collection, pathname, router, queryClient, onOpenChange]);

  const isPublic = visibility === "public";

  const navItems: {
    key: Section;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "general", label: "General", icon: <SettingsIcon className="size-4" /> },
    { key: "members", label: "Members", icon: <Users className="size-4" /> },
    { key: "danger", label: "Danger zone", icon: <TriangleAlert className="size-4" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden top-[10%] -translate-y-0">
        <div className="flex h-[80vh]">
          {/* Left nav */}
          <nav className="w-[200px] shrink-0 border-r flex flex-col gap-1 p-3">
            <DialogHeader className="px-3 pb-3">
              <DialogTitle>Settings</DialogTitle>
              <p className="truncate text-xs text-muted-foreground" title={fullName}>
                {fullName}
              </p>
            </DialogHeader>
            {navItems.map((item) => {
              const active = section === item.key;
              const base =
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors";
              const cls = active
                ? `${base} bg-muted/50 text-foreground`
                : `${base} text-foreground hover:bg-muted/30`;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={cls}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Right content */}
          <div className="flex-1 overflow-y-auto p-6">
            {section === "general" && (
              <div className="space-y-6">
                <h2 className="text-base font-medium">General</h2>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isPublic ? (
                        <Globe className="size-4 text-muted-foreground" />
                      ) : (
                        <Lock className="size-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {visibility === null
                            ? "Loading..."
                            : isPublic
                              ? "Public"
                              : "Private"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isPublic
                            ? "This collection is visible to anyone."
                            : "Only you and collaborators can access this collection."}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleVisibility}
                      disabled={loading || visibility === null}
                    >
                      {loading ? (
                        <Loader2 className="size-3 animate-spin mr-1.5" />
                      ) : null}
                      {isPublic ? "Make private" : "Make public"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {section === "members" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-medium">Members</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Invite collaborators or share an invite link.
                  </p>
                </div>
                <CollectionMembers owner={owner} collection={collection} />
              </div>
            )}

            {section === "danger" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-medium text-destructive">
                    Danger zone
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Destructive actions. Artifacts and history are kept and can be restored later.
                  </p>
                </div>

                <div className="rounded-lg border border-destructive/30 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium">Delete this collection</p>
                    <p className="text-xs text-muted-foreground">
                      The collection will disappear from your list. Data is preserved.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Type{" "}
                    <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                      {fullName}
                    </code>{" "}
                    to confirm.
                  </p>
                  <Input
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder={fullName}
                  />
                  {deleteError && (
                    <p className="text-xs text-destructive">{deleteError}</p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteInput !== fullName || deleting}
                    >
                      {deleting ? (
                        <Loader2 className="size-3 animate-spin mr-1.5" />
                      ) : (
                        <Trash2 className="size-3 mr-1.5" />
                      )}
                      Delete collection
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
