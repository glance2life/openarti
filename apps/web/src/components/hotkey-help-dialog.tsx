"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useHotkey } from "@/hooks/use-hotkey";
import { useHotkeyList } from "@/lib/hotkeys/context";

const DEFAULT_GROUP = "General";

export function HotkeyHelpDialog() {
  const [open, setOpen] = useState(false);
  const entries = useHotkeyList();

  useHotkey("shift+?", () => setOpen((v) => !v), {
    label: "Keyboard shortcuts",
    group: "Help",
  });

  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = entry.group ?? DEFAULT_GROUP;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }
  const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Press ? at any time to open this list.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {sortedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shortcuts registered.</p>
          ) : (
            sortedGroups.map(([group, items]) => (
              <div key={group} className="flex flex-col gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {items.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span>{entry.label}</span>
                      <Kbd keys={entry.keys} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
