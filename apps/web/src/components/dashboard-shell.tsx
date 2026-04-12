"use client";

import { Suspense } from "react";
import { FinderNavigationProvider } from "@/hooks/finder-navigation-context";
import { CollectionSidebar } from "@/components/finder/collection-sidebar";
import { FileTreePanel } from "@/components/finder/file-tree-panel";
import { DialogRouter } from "@/components/dialog-router";

interface DashboardShellProps {
  user: { name: string; email: string };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <FinderNavigationProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Column 1: Collection sidebar */}
        <CollectionSidebar user={user} />

        {/* Column 2: Toolbar + File tree */}
        <FileTreePanel />

        {/* Column 3: Content (full height) */}
        <main className="flex-1 overflow-hidden bg-background">
          {children}
        </main>
      </div>

      <Suspense>
        <DialogRouter user={user} />
      </Suspense>
    </FinderNavigationProvider>
  );
}
