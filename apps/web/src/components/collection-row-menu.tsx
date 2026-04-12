"use client";

import { MoreHorizontal, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOpenDialog } from "@/hooks/use-dialog-router";

interface CollectionRowMenuProps {
  owner: string;
  collectionName: string;
}

export function CollectionRowMenu({
  owner,
  collectionName,
}: CollectionRowMenuProps) {
  const openDialog = useOpenDialog();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="rounded p-1 text-muted-foreground opacity-0 hover:bg-background group-hover:opacity-100 data-[popup-open]:opacity-100"
          />
        }
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            openDialog("collection-settings", {
              owner,
              collection: collectionName,
            })
          }
        >
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
