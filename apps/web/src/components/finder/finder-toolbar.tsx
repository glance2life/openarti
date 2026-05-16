"use client";

import { Settings, ChevronDown, History, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFinderNavigation } from "@/hooks/finder-navigation-context";
import { useOpenDialog } from "@/hooks/use-dialog-router";
import { useRouter } from "next/navigation";

export function FinderToolbar() {
  const { selectedCollection, viewMode, hydrated } = useFinderNavigation();
  const openDialog = useOpenDialog();
  const router = useRouter();

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
            onClick={() => router.push(`/${owner}/${collection}/-/history`)}
          >
            <History className="mr-2 size-4" />
            History
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/${owner}/${collection}/-/trash`)}
          >
            <Trash2 className="mr-2 size-4" />
            Trash
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              openDialog("collection-settings", { owner, collection })
            }
          >
            <Settings className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
