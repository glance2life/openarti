"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Globe,
  Lock,
  Copy,
  Check,
  ChevronDown,
  Loader2,
  Settings,
} from "lucide-react";
import { useOpenDialog } from "@/hooks/use-dialog-router";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface SharePopoverProps {
  owner: string;
  collection: string;
  filePath: string;
}

export function SharePopover({ owner, collection, filePath }: SharePopoverProps) {
  const openDialog = useOpenDialog();
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<"private" | "public" | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
    if (open && visibility === null) {
      fetchVisibility();
    }
  }, [open, visibility, fetchVisibility]);

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

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/s/${owner}/${collection}/${filePath}`
      : "";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [publicUrl]);

  const isPublic = visibility === "public";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1" />
        }
      >
        Share
        <ChevronDown className="size-3 text-muted-foreground" />
      </PopoverTrigger>

      <PopoverContent align="end" side="bottom" className="w-80 p-0">
        {/* Public link section */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isPublic ? (
                <Globe className="size-4 text-green-500" />
              ) : (
                <Lock className="size-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {isPublic ? "Public link is on" : "Public link is off"}
              </span>
            </div>
            <Button
              variant={isPublic ? "default" : "outline"}
              size="xs"
              onClick={toggleVisibility}
              disabled={loading || visibility === null}
            >
              {loading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : isPublic ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {isPublic
              ? "Anyone with the link can view this content, including AI agents."
              : "Only you and collaborators can access this content."}
          </p>

          {isPublic && (
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-muted px-2.5 py-1.5 text-xs font-mono">
                {publicUrl}
              </code>
              <Button
                variant="outline"
                size="icon-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="size-3 text-green-500" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border" />

        {/* Collaboration hint */}
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Invite collaborators to read or edit in collection settings.
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0 gap-1"
            onClick={() => {
              setOpen(false);
              openDialog("collection-settings", { owner, collection });
            }}
          >
            <Settings className="size-3" />
            Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
