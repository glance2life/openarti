"use client";

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SidebarSearch() {
  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search..."
        className="h-8 pl-8 text-sm bg-sidebar"
      />
    </div>
  );
}
