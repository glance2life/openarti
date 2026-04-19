"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { parse, formatChord, isMac } from "@/lib/hotkeys/parse";

interface KbdProps {
  keys?: string;
  className?: string;
  children?: React.ReactNode;
}

const KEY_CAP =
  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 font-sans text-[11px] leading-none opacity-70 border border-[color-mix(in_oklab,currentColor_30%,transparent)]";

export function Kbd({ keys, className, children }: KbdProps) {
  // Avoid hydration mismatch: render the non-mac variant first, then swap on mount.
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(isMac());
  }, []);

  if (children) {
    return <kbd className={cn(KEY_CAP, className)}>{children}</kbd>;
  }

  if (!keys) return null;

  const chords = parse(keys);

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {chords.map((chord, ci) => {
        const parts = formatChord(chord, mac);
        return (
          <span key={ci} className="inline-flex items-center gap-0.5">
            {ci > 0 && (
              <span className="px-0.5 text-[11px] opacity-60">then</span>
            )}
            {parts.map((p, pi) => (
              <kbd key={pi} className={KEY_CAP}>
                {p}
              </kbd>
            ))}
          </span>
        );
      })}
    </span>
  );
}
