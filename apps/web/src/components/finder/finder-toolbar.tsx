"use client";

import Link from "next/link";
import { Settings, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinderNavigation } from "@/hooks/finder-navigation-context";

export function FinderToolbar() {
  const { selectedCollection, viewMode, hydrated } = useFinderNavigation();

  if (!hydrated) {
    return <div className="flex h-12 shrink-0 items-center px-4" />;
  }

  if (viewMode === "recent") {
    return (
      <div className="flex h-12 shrink-0 items-center px-4">
        <span className="font-semibold">Recently Updated</span>
      </div>
    );
  }

  if (!selectedCollection) {
    return null;
  }

  const { owner, collection } = selectedCollection;

  return (
    <div className="flex h-12 shrink-0 items-center px-4">
      <span className="font-semibold">{collection}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" />
          }
        >
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            render={<Link href={`/${owner}/${collection}/settings`} />}
          >
            <Settings className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
