"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarCollectionList } from "@/components/sidebar/sidebar-collection-list";
import { SidebarUserSection } from "@/components/sidebar/sidebar-user-section";
import { SearchCommand } from "@/components/finder/search-command";
import { useFinderNavigation } from "@/hooks/finder-navigation-context";
import { useOpenDialog } from "@/hooks/use-dialog-router";
import { PlugZap, Clock, Search } from "lucide-react";

const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 160;
const MAX_WIDTH = 300;

interface CollectionSidebarProps {
  user: { name: string; email: string };
}

export function CollectionSidebar({ user }: CollectionSidebarProps) {
  const { viewMode, selectedCollection, selectCollection, selectRecentlyUpdated } =
    useFinderNavigation();
  const openDialog = useOpenDialog();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [searchOpen, setSearchOpen] = useState(false);

  // Load persisted width
  useEffect(() => {
    const saved = localStorage.getItem("col1-width");
    if (saved) {
      const w = Number(saved);
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setWidth(w);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("col1-width", String(width));
  }, [width]);

  // Cmd+K to open search, Cmd+J to open connect, Cmd+E to open recent
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        openDialog("connect");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        selectRecentlyUpdated();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [openDialog, selectRecentlyUpdated]);

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

  return (
    <>
      <aside
        className="relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
        style={{ width, minWidth: width }}
      >
        {/* Brand */}
        <div className="flex h-12 shrink-0 items-center px-4">
          <Link
            href="/"
            className="text-base font-bold tracking-tight"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.svg" alt="OpenArti" width={90} height={15} />
          </Link>
        </div>

        {/* Nav rows */}
        <div className="px-2 flex flex-col gap-0.5">
          <button
            onClick={selectRecentlyUpdated}
            className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
              viewMode === "recent"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Clock className="size-4" />
            Recents
            <span className="ml-auto hidden group-hover:inline-flex items-center gap-1 text-sidebar-foreground/50"><kbd className="text-sm">⌘</kbd><kbd className="text-xs">E</kbd></span>
          </button>
          <button
            onClick={() => openDialog("connect")}
            className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <PlugZap className="size-4" />
            Connect
            <span className="ml-auto hidden group-hover:inline-flex items-center gap-1 text-sidebar-foreground/50"><kbd className="text-sm">⌘</kbd><kbd className="text-xs">J</kbd></span>
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Search className="size-4" />
            Search
            <span className="ml-auto hidden group-hover:inline-flex items-center gap-1 text-sidebar-foreground/50"><kbd className="text-sm">⌘</kbd><kbd className="text-xs">K</kbd></span>
          </button>
        </div>

        {/* Collection list */}
        <ScrollArea className="flex-1 overflow-hidden min-h-0 mt-1">
          <SidebarCollectionList onSelect={selectCollection} selectedCollection={selectedCollection} />
        </ScrollArea>

        {/* User avatar at bottom */}
        <div className="border-t border-sidebar-border">
          <SidebarUserSection user={user} />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleWidthMouseDown}
          className="absolute -right-px top-0 h-full w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        />
      </aside>

      {/* Spotlight search dialog */}
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
