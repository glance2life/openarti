"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FileText,
  Pin,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface LsEntry {
  name: string;
  type: "file" | "dir";
}

interface TreeNodeState {
  entries: LsEntry[];
  loading: boolean;
  expanded: boolean;
}

interface SidebarFileTreeProps {
  team: string;
  repo: string;
  currentPath: string;
  isPinned: (path: string) => boolean;
  onPin: (targetType: "repo" | "file" | "dir", targetPath: string) => void;
  onUnpin: (targetPath: string) => void;
}

function sortEntries(entries: LsEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function SidebarFileTree({
  team,
  repo,
  currentPath,
  isPinned,
  onPin,
  onUnpin,
}: SidebarFileTreeProps) {
  const [tree, setTree] = useState<Record<string, TreeNodeState>>({});
  const [rootLoading, setRootLoading] = useState(true);

  const fetchDir = useCallback(
    async (dirPath: string) => {
      setTree((prev) => ({
        ...prev,
        [dirPath]: { entries: prev[dirPath]?.entries ?? [], loading: true, expanded: true },
      }));

      try {
        const res = await fetch(
          `${API_URL}/repos/${team}/${repo}/tools/ls`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: dirPath || undefined }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          setTree((prev) => ({
            ...prev,
            [dirPath]: {
              entries: sortEntries(data.entries),
              loading: false,
              expanded: true,
            },
          }));
        }
      } catch {
        setTree((prev) => ({
          ...prev,
          [dirPath]: { entries: [], loading: false, expanded: true },
        }));
      }
    },
    [team, repo]
  );

  // Load root + auto-expand to current path
  useEffect(() => {
    setTree({});
    setRootLoading(true);

    async function init() {
      await fetchDir("");
      setRootLoading(false);

      // Auto-expand directories in the current path
      if (currentPath) {
        const parts = currentPath.split("/");
        for (let i = 0; i < parts.length; i++) {
          const dirPath = parts.slice(0, i + 1).join("/");
          // Only expand intermediate directories, not the last segment if it's a file
          if (i < parts.length - 1) {
            await fetchDir(dirPath);
          }
        }
      }
    }

    init();
  }, [team, repo, currentPath, fetchDir]);

  function toggleDir(dirPath: string) {
    const node = tree[dirPath];
    if (node?.expanded) {
      setTree((prev) => ({
        ...prev,
        [dirPath]: { ...prev[dirPath], expanded: false },
      }));
    } else if (node?.entries.length) {
      setTree((prev) => ({
        ...prev,
        [dirPath]: { ...prev[dirPath], expanded: true },
      }));
    } else {
      fetchDir(dirPath);
    }
  }

  function renderEntries(entries: LsEntry[], parentPath: string, depth: number) {
    return entries.map((entry) => {
      const entryPath = parentPath
        ? `${parentPath}/${entry.name}`
        : entry.name;
      const fullPath = `${repo}/${entryPath}`;
      const href = `/${team}/${repo}/${entryPath}`;
      const isActive = currentPath === entryPath;
      const pinned = isPinned(fullPath);

      if (entry.type === "dir") {
        const node = tree[entryPath];
        const isExpanded = node?.expanded ?? false;
        const isLoading = node?.loading ?? false;

        return (
          <div key={entryPath}>
            <div className="group relative">
              <button
                onClick={() => toggleDir(entryPath)}
                className={`flex w-full items-center gap-1 rounded-md py-1 pr-2 text-sm hover:bg-sidebar-accent ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : ""
                }`}
                style={{ paddingLeft: depth * 12 + 8 }}
              >
                <ChevronRight
                  className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                />
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{entry.name}</span>
                {isLoading && (
                  <Loader2 className="ml-auto size-3 animate-spin text-muted-foreground" />
                )}
              </button>
              <button
                onClick={() =>
                  pinned ? onUnpin(fullPath) : onPin("dir", fullPath)
                }
                className={`absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-sidebar-accent ${
                  pinned
                    ? "text-foreground"
                    : "text-muted-foreground opacity-0 group-hover:opacity-100"
                }`}
              >
                <Pin
                  className={`size-3 ${pinned ? "fill-current" : ""}`}
                />
              </button>
            </div>
            {isExpanded && node?.entries && (
              <div>{renderEntries(node.entries, entryPath, depth + 1)}</div>
            )}
          </div>
        );
      }

      // File
      return (
        <div key={entryPath} className="group relative">
          <Link
            href={href}
            className={`flex items-center gap-1 rounded-md py-1 pr-2 text-sm hover:bg-sidebar-accent ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : ""
            }`}
            style={{ paddingLeft: depth * 12 + 8 + 14 }}
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{entry.name}</span>
          </Link>
          <button
            onClick={() =>
              pinned ? onUnpin(fullPath) : onPin("file", fullPath)
            }
            className={`absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-sidebar-accent ${
              pinned
                ? "text-foreground"
                : "text-muted-foreground opacity-0 group-hover:opacity-100"
            }`}
          >
            <Pin className={`size-3 ${pinned ? "fill-current" : ""}`} />
          </button>
        </div>
      );
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-sm text-muted-foreground">{repo}</span>
        <Link
          href={`/${team}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3" />
          Back
        </Link>
      </div>
      {rootLoading ? (
        <div className="space-y-1 px-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : (tree[""]?.entries ?? []).length === 0 ? (
        <p className="px-2 py-1 text-sm text-muted-foreground/60">
          Empty
        </p>
      ) : (
        renderEntries(tree[""]?.entries ?? [], "", 0)
      )}
    </div>
  );
}
