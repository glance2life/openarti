"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface PinItem {
  id: string;
  targetType: "repo" | "file" | "dir";
  targetPath: string;
}

interface SidebarPinnedItemsProps {
  team: string;
  pins: PinItem[];
  onUnpin: (pinId: string) => void;
}

const DEFAULT_VISIBLE = 5;

export function SidebarPinnedItems({
  team,
  pins,
  onUnpin,
}: SidebarPinnedItemsProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? pins : pins.slice(0, DEFAULT_VISIBLE);
  const remaining = pins.length - DEFAULT_VISIBLE;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="px-2 text-xs text-muted-foreground/60">
        Pinned
      </div>
      {pins.length === 0 && (
        <p className="px-2 py-1 text-sm text-muted-foreground/60">
          No pinned items
        </p>
      )}
      {visible.map((pin) => {
        return (
          <div key={pin.id} className="group relative">
            <Link
              href={`/${team}/${pin.targetPath}`}
              className="flex items-center rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent"
            >
              <span className="truncate">{pin.targetPath}</span>
            </Link>
            <button
              onClick={() => onUnpin(pin.id)}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-foreground group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
      {remaining > 0 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          +{remaining} more...
        </button>
      )}
    </div>
  );
}
