"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Eye, Code, Download, MoreHorizontal, History } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getRenderer,
  hasPreview,
  getFileTypeLabel,
  isOpenApiContent,
  OpenApiRenderer,
} from "@/components/renderers/registry";
import { CodeRenderer } from "@/components/renderers/code";
import { SharePopover } from "@/components/share-popover";
import { useFileRealtime } from "@/lib/realtime/hooks";
import { useHotkey } from "@/hooks/use-hotkey";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

interface ArtifactViewerProps {
  owner: string;
  collection: string;
  filePath: string;
  filename: string;
  initialContent: string;
  lastCommit?: CommitInfo | null;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FileHistorySheet({
  open,
  onOpenChange,
  owner,
  collection,
  filePath,
  filename,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  owner: string;
  collection: string;
  filePath: string;
  filename: string;
}) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchPage = useCallback(
    async (p: number) => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/collections/${encodeURIComponent(owner)}/${encodeURIComponent(collection)}/log?path=${encodeURIComponent(filePath)}&page=${p}`,
          { credentials: "include" }
        );
        if (res.ok) {
          const data = (await res.json()) as { commits: CommitInfo[]; hasMore: boolean };
          setCommits((prev) => (p === 1 ? data.commits : [...prev, ...data.commits]));
          setHasMore(data.hasMore);
          setPage(p);
        }
      } finally {
        setLoading(false);
      }
    },
    [owner, collection, filePath]
  );

  useEffect(() => {
    if (open) {
      setCommits([]);
      setPage(1);
      fetchPage(1);
    }
  }, [open, fetchPage]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <SheetTitle className="text-sm font-semibold">History — {filename}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {commits.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">No commits yet.</p>
          )}
          {commits.map((commit) => (
            <div
              key={commit.hash}
              className="rounded-lg border border-border bg-card p-3 space-y-0.5"
            >
              <p className="text-sm font-medium leading-snug">
                {commit.message || (
                  <span className="italic text-muted-foreground">no message</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {commit.author} · {formatFullTime(commit.timestamp)}
              </p>
              <code className="text-[10px] text-muted-foreground font-mono">
                {commit.hash.slice(0, 7)}
              </code>
            </div>
          ))}
          {loading && (
            <p className="text-xs text-muted-foreground py-2">Loading…</p>
          )}
          {hasMore && !loading && (
            <button
              onClick={() => fetchPage(page + 1)}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-2"
            >
              Load more
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ArtifactViewer({
  owner,
  collection,
  filePath,
  filename,
  initialContent,
  lastCommit,
}: ArtifactViewerProps) {
  const [content, setContent] = useState(initialContent);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  const openApi = useMemo(
    () => /\.ya?ml$|\.json$/.test(filename) && isOpenApiContent(content),
    [content, filename]
  );
  const canPreview = openApi || hasPreview(filename);
  const typeLabel = getFileTypeLabel(filename);
  const [mode, setMode] = useState<"preview" | "plain">(() => {
    if (!canPreview) return "plain";
    if (typeof window === "undefined") return "preview";
    const saved = localStorage.getItem("artifact-view-mode");
    return saved === "plain" ? "plain" : "preview";
  });

  const handleModeChange = useCallback((v: "preview" | "plain") => {
    setMode(v);
    localStorage.setItem("artifact-view-mode", v);
  }, []);

  useHotkey(
    "p",
    () => handleModeChange(mode === "preview" ? "plain" : "preview"),
    {
      label: "Toggle preview / source",
      group: "View",
      enabled: canPreview,
    },
  );

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_URL}/collections/${encodeURIComponent(owner)}/${encodeURIComponent(collection)}/tools/read`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { content?: string };
        setContent(data.content ?? "");
      }
    } catch {
      // swallow — next realtime tick will retry
    }
  }, [owner, collection, filePath]);

  useFileRealtime({ owner, name: collection, path: filePath }, refetch);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, filename]);

  const PreviewRenderer = openApi ? OpenApiRenderer : getRenderer(filename);
  const ActiveRenderer =
    mode === "preview" && canPreview ? PreviewRenderer : CodeRenderer;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        {/* Left: toggle + title + type */}
        <div className="flex items-center gap-2 min-w-0">
          {canPreview && (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <SegmentedControl
                  id="artifact-mode"
                  value={mode}
                  onValueChange={handleModeChange}
                  items={[
                    { value: "preview", label: <Eye className="size-3.5" /> },
                    { value: "plain", label: <Code className="size-3.5" /> },
                  ]}
                />
              </TooltipTrigger>
              <TooltipContent side="left" sideOffset={8}>
                <Kbd keys="p" className="text-background [&_kbd]:border-background/40 [&_kbd]:opacity-100" />
                to toggle
              </TooltipContent>
            </Tooltip>
          )}
          <span className="truncate font-semibold">{filename}</span>
          {typeLabel && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {typeLabel}
            </span>
          )}
        </div>

        {/* Right: last commit + share + more */}
        <div className="flex items-center gap-1 shrink-0">
          {lastCommit && (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <History className="size-3.5" />
                  <span>{formatRelativeTime(lastCommit.timestamp)}</span>
                  <span className="hidden sm:inline">· {lastCommit.author}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                {lastCommit.message || "no message"} · {formatFullTime(lastCommit.timestamp)}
              </TooltipContent>
            </Tooltip>
          )}

          <SharePopover owner={owner} collection={collection} filePath={filePath} />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="size-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                <History className="size-4" />
                History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content – no padding, renderer provides its own */}
      <div className="flex-1 overflow-y-auto">
        <ActiveRenderer content={content} filename={filePath} />
      </div>

      <FileHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        owner={owner}
        collection={collection}
        filePath={filePath}
        filename={filename}
      />
    </div>
  );
}
