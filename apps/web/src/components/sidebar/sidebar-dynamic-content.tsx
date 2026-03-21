"use client";

import { usePathname } from "next/navigation";
import { SidebarRepoList } from "./sidebar-repo-list";
import { SidebarFileTree } from "./sidebar-file-tree";

interface SidebarDynamicContentProps {
  activeTeam: string;
  isPinned: (path: string) => boolean;
  onPin: (targetType: "repo" | "file" | "dir", targetPath: string) => void;
  onUnpin: (targetPath: string) => void;
}

export function SidebarDynamicContent({
  activeTeam,
  isPinned,
  onPin,
  onUnpin,
}: SidebarDynamicContentProps) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const inRepo =
    segments.length >= 2 &&
    segments[0] === activeTeam &&
    segments[1] !== "settings";

  const repo = inRepo ? segments[1] : null;
  const currentPath = inRepo ? segments.slice(2).join("/") : "";

  if (repo) {
    return (
      <SidebarFileTree
        team={activeTeam}
        repo={repo}
        currentPath={currentPath}
        isPinned={isPinned}
        onPin={onPin}
        onUnpin={onUnpin}
      />
    );
  }

  return (
    <SidebarRepoList
      team={activeTeam}
      isPinned={isPinned}
      onPin={onPin}
      onUnpin={onUnpin}
    />
  );
}
