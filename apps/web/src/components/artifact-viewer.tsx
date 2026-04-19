"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Eye, Code, Download, MoreHorizontal } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface ArtifactViewerProps {
  owner: string;
  collection: string;
  filePath: string;
  filename: string;
  initialContent: string;
}

export function ArtifactViewer({
  owner,
  collection,
  filePath,
  filename,
  initialContent,
}: ArtifactViewerProps) {
  const [content, setContent] = useState(initialContent);

  // Reset content when navigating between files (initialContent prop changes)
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

  // Realtime: refetch current file when it changes on the server
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

        {/* Right: share + more */}
        <div className="flex items-center gap-1 shrink-0">
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content – no padding, renderer provides its own */}
      <div className="flex-1 overflow-y-auto">
        <ActiveRenderer content={content} filename={filePath} />
      </div>
    </div>
  );
}
