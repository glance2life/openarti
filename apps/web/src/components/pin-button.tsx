"use client";

import { Pin } from "lucide-react";
import { usePinsContext } from "@/hooks/pins-context";

interface PinButtonProps {
  targetType: "repo" | "file" | "dir";
  targetPath: string;
  className?: string;
}

export function PinButton({ targetType, targetPath, className }: PinButtonProps) {
  const { isPinned, addPin, removePinByPath } = usePinsContext();
  const pinned = isPinned(targetPath);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        pinned ? removePinByPath(targetPath) : addPin(targetType, targetPath);
      }}
      className={`rounded p-1 hover:bg-accent ${
        pinned ? "text-foreground" : "text-muted-foreground opacity-0 group-hover:opacity-100"
      } ${className ?? ""}`}
    >
      <Pin className={`size-3.5 ${pinned ? "fill-current" : ""}`} />
    </button>
  );
}
