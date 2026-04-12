"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Lock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CollectionMembers } from "@/components/collection-members";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
  const [visibility, setVisibility] = useState<"private" | "public" | null>(null);
  const [loading, setLoading] = useState(false);

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
      setVisibility(null);
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

  const isPublic = visibility === "public";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[70vh] overflow-y-auto top-[12%] -translate-y-0">
        <DialogHeader>
          <DialogTitle>{collection}</DialogTitle>
          <DialogDescription>
            Manage members and sharing for this collection.
          </DialogDescription>
        </DialogHeader>

        {/* Visibility */}
        <div className="rounded-lg border p-4 space-y-3">
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

        {/* Members */}
        <CollectionMembers owner={owner} collection={collection} />
      </DialogContent>
    </Dialog>
  );
}
