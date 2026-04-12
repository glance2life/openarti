"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { BookMarked, Users } from "lucide-react";
import { FileIcon } from "@/lib/file-icon";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Collection {
  id: string;
  name: string;
  owner: string;
  description: string;
  visibility: string;
}

interface SharedCollection extends Collection {
  level: "read" | "edit";
}

interface GlobFile {
  path: string;
}

interface SearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchCommand({ open, onOpenChange }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [collections, setCollections] = useState<{
    own: Collection[];
    shared: SharedCollection[];
  }>({ own: [], shared: [] });
  const [fileResults, setFileResults] = useState<
    { collection: Collection; files: GlobFile[] }[]
  >([]);
  const [searchingFiles, setSearchingFiles] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch collections on open
  useEffect(() => {
    if (!open) return;
    fetch(`${API_URL}/collections`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCollections({
          own: Array.isArray(data.own) ? data.own : [],
          shared: Array.isArray(data.shared) ? data.shared : [],
        });
      })
      .catch(() => {});
  }, [open]);

  // Search files across collections via unified search endpoint
  useEffect(() => {
    if (!query.trim()) {
      setFileResults([]);
      setSearchingFiles(false);
      return;
    }

    setSearchingFiles(true);
    const timer = setTimeout(async () => {
      // Abort any in-flight search request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch(`${API_URL}/collections/search`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pattern: `**/*${query.trim()}*` }),
          signal: controller.signal,
        });
        if (!res.ok) {
          setFileResults([]);
          setSearchingFiles(false);
          return;
        }
        const data = await res.json();
        setFileResults(data.results ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFileResults([]);
      }
      setSearchingFiles(false);
    }, 300);

    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      setQuery("");
      router.push(href);
    },
    [router, onOpenChange]
  );

  // Reset query on close
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const q = query.toLowerCase();
  const allCollections = [...collections.own, ...collections.shared];
  const filteredCollections = q
    ? allCollections.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.owner.toLowerCase().includes(q)
      )
    : allCollections;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search"
      description="Search collections and files"
    >
      <CommandInput
        placeholder="Search collections and files..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {searchingFiles ? "Searching..." : "No results found."}
        </CommandEmpty>

        {/* Collections */}
        {filteredCollections.length > 0 && (
          <CommandGroup heading="Collections">
            {filteredCollections.map((col) => {
              const isShared = collections.shared.some((s) => s.id === col.id);
              return (
                <CommandItem
                  key={col.id}
                  value={`${col.owner}/${col.name}`}
                  onSelect={() => navigate(`/${col.owner}/${col.name}`)}
                >
                  {isShared ? (
                    <Users className="opacity-50" />
                  ) : (
                    <BookMarked className="opacity-50" />
                  )}
                  <span>
                    {isShared ? `${col.owner}/` : ""}
                    {col.name}
                  </span>
                  {col.description && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">
                      {col.description}
                    </span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {/* File results */}
        {fileResults.map(({ collection: col, files }) => (
          <CommandGroup key={col.id} heading={col.name}>
            {files.slice(0, 8).map((file) => {
              const isDir = file.path.endsWith("/");
              return (
                <CommandItem
                  key={file.path}
                  value={`${col.owner}/${col.name}/${file.path}`}
                  onSelect={() =>
                    navigate(`/${col.owner}/${col.name}/${file.path}`)
                  }
                >
                  <FileIcon
                    filename={file.path.split("/").pop() ?? file.path}
                    isDirectory={isDir}
                    className="size-4 shrink-0"
                  />
                  <span className="truncate">{file.path}</span>
                </CommandItem>
              );
            })}
            {files.length > 8 && (
              <CommandItem disabled>
                <span className="text-xs text-muted-foreground">
                  +{files.length - 8} more
                </span>
              </CommandItem>
            )}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
