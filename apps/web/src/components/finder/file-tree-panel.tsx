"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarFileTree } from "@/components/sidebar/sidebar-file-tree";
import { FinderToolbar } from "@/components/finder/finder-toolbar";
import { useFinderNavigation } from "@/hooks/finder-navigation-context";
import { Clock, Loader2 } from "lucide-react";
import { FileIcon } from "@/lib/file-icon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

interface RecentFile {
  owner: string;
  collection: string;
  path: string;
  timestamp: string;
  deleted?: boolean;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diffSec / (86400 * 30)), "month");
  return rtf.format(Math.round(diffSec / (86400 * 365)), "year");
}

export function FileTreePanel() {
  const { selectedCollection, viewMode } = useFinderNavigation();
  const pathname = usePathname();

  const [width, setWidth] = useState(DEFAULT_WIDTH);

  // Determine current path within collection
  const segments = pathname.split("/").filter(Boolean);
  const currentPath =
    selectedCollection && segments.length > 2
      ? segments.slice(2).join("/")
      : "";

  // Load persisted width
  useEffect(() => {
    const saved = localStorage.getItem("col2-width");
    if (saved) {
      const w = Number(saved);
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setWidth(w);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("col2-width", String(width));
  }, [width]);

  // Width resize
  const handleWidthMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, startWidth + ev.clientX - startX)
        );
        setWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [width]
  );

  // Recent files data
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    if (viewMode !== "recent") return;
    setRecentLoading(true);
    fetch(`${API_URL}/collections/recent`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((data) => setRecentFiles(data.files ?? []))
      .catch(() => setRecentFiles([]))
      .finally(() => setRecentLoading(false));
  }, [viewMode]);

  // Don't render if no collection selected and not in recent mode
  if (!selectedCollection && viewMode !== "recent") {
    return null;
  }

  // Recently Updated mode — behaves like a virtual collection file list
  if (viewMode === "recent") {
    // Derive active path from current URL for highlighting
    const activePath = pathname === "/" ? "" : pathname.slice(1); // e.g. "owner/col/file.md"

    return (
      <aside
        className="relative flex h-full flex-col border-r border-border bg-background"
        style={{ width, minWidth: width }}
      >
        <FinderToolbar />
        {recentLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground px-4">
              <Clock className="size-8 mx-auto mb-2 opacity-50" />
              <p>No recent updates yet.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-hidden min-h-0 px-2">
            <div className="flex flex-col gap-0.5 py-1">
              {recentFiles.map((file) => {
                const href = `/${file.owner}/${file.collection}/${file.path}`;
                const isActive = activePath === `${file.owner}/${file.collection}/${file.path}`;
                const filename = file.path.split("/").pop() ?? file.path;

                return (
                  <Link
                    key={`${file.owner}/${file.collection}/${file.path}`}
                    href={href}
                    className={`flex items-center gap-1 rounded-md py-1 px-2 hover:bg-sidebar-accent ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : ""
                    } ${file.deleted ? "opacity-40" : ""}`}
                  >
                    <FileIcon filename={filename} />
                    <span className={`truncate ${file.deleted ? "line-through" : ""}`}>{filename}</span>
                    <span
                      className="ml-auto shrink-0 text-xs text-muted-foreground"
                      title={new Date(file.timestamp).toLocaleString()}
                    >
                      {formatRelativeTime(file.timestamp)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Width drag handle */}
        <div
          onMouseDown={handleWidthMouseDown}
          className="absolute -right-px top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        />
      </aside>
    );
  }

  const { owner, collection } = selectedCollection!;

  return (
    <aside
      className="relative flex h-full flex-col border-r border-border bg-background"
      style={{ width, minWidth: width }}
    >
      <FinderToolbar />

      {/* File tree */}
      <ScrollArea className="flex-1 overflow-hidden min-h-0 px-2">
        <SidebarFileTree
          owner={owner}
          collection={collection}
          currentPath={currentPath}
        />
      </ScrollArea>

      {/* Width drag handle */}
      <div
        onMouseDown={handleWidthMouseDown}
        className="absolute -right-px top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
      />
    </aside>
  );
}
