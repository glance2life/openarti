"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronRight,
  FilePlus,
  Loader2,
  PlugZap,
} from "lucide-react";
import { FileIcon } from "@/lib/file-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useOpenDialog } from "@/hooks/use-dialog-router";
import { useCollectionRealtime } from "@/lib/realtime/hooks";

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

interface GlobFile {
  path: string;
}

interface SidebarFileTreeProps {
  owner: string;
  collection: string;
  currentPath: string;
  searchQuery?: string;
}

function sortEntries(entries: LsEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function SidebarFileTree({
  owner,
  collection,
  currentPath,
  searchQuery = "",
}: SidebarFileTreeProps) {
  const [tree, setTree] = useState<Record<string, TreeNodeState>>({});
  const [rootLoading, setRootLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<GlobFile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const openDialog = useOpenDialog();

  // Debounced glob search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(() => {
      fetch(`${API_URL}/collections/${owner}/${collection}/tools/glob`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: `**/*${searchQuery.trim()}*` }),
      })
        .then((r) => (r.ok ? r.json() : { files: [] }))
        .then((data) => setSearchResults(data.files ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, owner, collection]);

  const fetchDir = useCallback(
    async (dirPath: string) => {
      setTree((prev) => ({
        ...prev,
        [dirPath]: { entries: prev[dirPath]?.entries ?? [], loading: true, expanded: true },
      }));

      try {
        const res = await fetch(
          `${API_URL}/collections/${owner}/${collection}/tools/ls`,
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
    [owner, collection]
  );

  // Load root when collection changes
  useEffect(() => {
    setTree({});
    setRootLoading(true);

    fetchDir("").then(() => setRootLoading(false));
  }, [owner, collection, fetchDir]);

  // Realtime: when the collection changes, refetch every currently-expanded directory
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  });

  const refreshExpanded = useCallback(() => {
    const expanded = Object.keys(treeRef.current).filter(
      (k) => treeRef.current[k]?.expanded
    );
    for (const dirPath of expanded) {
      fetchDir(dirPath);
    }
  }, [fetchDir]);

  useCollectionRealtime({ owner, name: collection }, refreshExpanded);

  // Auto-expand directories to match current path (without resetting tree)
  useEffect(() => {
    if (!currentPath) return;

    async function expandToPath() {
      const parts = currentPath.split("/");
      for (let i = 0; i < parts.length - 1; i++) {
        const dirPath = parts.slice(0, i + 1).join("/");
        // Only fetch if not already expanded
        if (!tree[dirPath]?.expanded) {
          await fetchDir(dirPath);
        }
      }
    }

    expandToPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, fetchDir]);

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
      const href = `/${owner}/${collection}/${entryPath}`;
      const isActive = currentPath === entryPath;

      if (entry.type === "dir") {
        const node = tree[entryPath];
        const isExpanded = node?.expanded ?? false;
        const isLoading = node?.loading ?? false;

        return (
          <div key={entryPath} className="flex flex-col gap-0.5">
            <button
              onClick={() => toggleDir(entryPath)}
              className={`flex w-full items-center gap-1 rounded-md py-1 pr-2 hover:bg-sidebar-accent ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : ""
              }`}
              style={{ paddingLeft: depth * 12 + 8 }}
            >
              <ChevronRight
                className={`size-3.5 shrink-0 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                } ${isActive ? "" : "text-sidebar-foreground"}`}
              />
              <FileIcon filename={entry.name} isDirectory />
              <span className="truncate">{entry.name}</span>
              {isLoading && (
                <Loader2 className="ml-auto size-3 animate-spin text-sidebar-foreground" />
              )}
            </button>
            {isExpanded && node?.entries && (
              <div className="flex flex-col gap-0.5">{renderEntries(node.entries, entryPath, depth + 1)}</div>
            )}
          </div>
        );
      }

      // File
      return (
        <div key={entryPath}>
          <Link
            href={href}
            className={`flex items-center gap-1 rounded-md py-1 pr-2 hover:bg-sidebar-accent ${
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : ""
            }`}
            style={{ paddingLeft: depth * 12 + 8 + 14 }}
          >
            <FileIcon filename={entry.name} />
            <span className="truncate">{entry.name}</span>
          </Link>
        </div>
      );
    });
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-0.5">
      {isSearching ? (
        searchLoading ? (
          <div className="space-y-1 px-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
          </div>
        ) : searchResults.length === 0 ? (
          <span className="px-2 py-1 text-xs text-muted-foreground">No artifacts found</span>
        ) : (
          searchResults.map((file) => {
            const href = `/${owner}/${collection}/${file.path}`;
            const isActive = currentPath === file.path;
            const searchFilename = file.path.split("/").pop() ?? file.path;
            return (
              <Link
                key={file.path}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-sidebar-accent ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : ""
                }`}
              >
                <FileIcon filename={searchFilename} className="size-3.5 shrink-0" />
                <span className="truncate">{file.path}</span>
              </Link>
            );
          })
        )
      ) : rootLoading ? (
        <div className="space-y-1 px-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-5/6" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : (tree[""]?.entries ?? []).length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted/60">
            <FilePlus className="size-5 text-muted-foreground/70" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">This collection is empty</p>
            <p className="text-xs text-muted-foreground">
              Connect an agent to start adding artifacts.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => openDialog("connect")}
          >
            <PlugZap className="size-3.5" />
            Connect an agent
            <Kbd keys="c" className="ml-1" />
          </Button>
        </div>
      ) : (
        renderEntries(tree[""]?.entries ?? [], "", 0)
      )}
    </div>
  );
}
