"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useHotkey } from "@/hooks/use-hotkey";

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SidebarSearch({ value, onChange, placeholder = "Search..." }: SidebarSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useHotkey("mod+k", () => inputRef.current?.focus(), {
    label: "Focus artifact search",
    group: "Navigation",
    allowInInput: true,
  });

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-6 pl-6 pr-6 text-[12px] bg-sidebar border-sidebar-border rounded-md"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
