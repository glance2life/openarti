"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateRepoButton } from "@/components/create-repo-button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Repo {
  id: string;
  name: string;
  description: string;
  visibility: string;
}

interface SidebarRepoListProps {
  team: string;
  isPinned: (path: string) => boolean;
  onPin: (targetType: "repo" | "file" | "dir", targetPath: string) => void;
  onUnpin: (targetPath: string) => void;
}

export function SidebarRepoList({
  team,
  isPinned,
  onPin,
  onUnpin,
}: SidebarRepoListProps) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/repos/${team}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setRepos(Array.isArray(data) ? data : []))
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, [team]);

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-5/6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between pl-2 pr-0.5">
        <span className="text-xs text-muted-foreground/60">Repos</span>
        <CreateRepoButton team={team} iconOnly />
      </div>
      {repos.map((repo) => {
        const href = `/${team}/${repo.name}`;
        const isActive = pathname.startsWith(href);
        const pinned = isPinned(repo.name);

        return (
          <div key={repo.id} className="group relative">
            <Link
              href={href}
              className={`flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <span className="truncate">{repo.name}</span>
            </Link>
            <button
              onClick={(e) => {
                e.preventDefault();
                pinned ? onUnpin(repo.name) : onPin("repo", repo.name);
              }}
              className={`absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-sidebar-accent ${
                pinned
                  ? "text-foreground"
                  : "text-muted-foreground opacity-0 group-hover:opacity-100"
              }`}
            >
              <Pin className={`size-3.5 ${pinned ? "fill-current" : ""}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
