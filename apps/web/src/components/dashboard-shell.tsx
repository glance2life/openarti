"use client";

import { Suspense } from "react";
import { FinderNavigationProvider } from "@/hooks/finder-navigation-context";
import { CollectionSidebar } from "@/components/finder/collection-sidebar";
import { FileTreePanel } from "@/components/finder/file-tree-panel";
import { DialogRouter } from "@/components/dialog-router";
import { HotkeyHelpDialog } from "@/components/hotkey-help-dialog";
import { HotkeyProvider } from "@/lib/hotkeys/context";
import { RealtimeProvider } from "@/lib/realtime/context";
import { QueryProvider } from "@/lib/query-client";
import { TooltipProvider } from "@/components/ui/tooltip";

interface DashboardShellProps {
  user: { name: string; email: string; role: string };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <QueryProvider>
      <RealtimeProvider>
        <HotkeyProvider>
          <TooltipProvider delay={500}>
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
            <HotkeyHelpDialog />
          </FinderNavigationProvider>
          </TooltipProvider>
        </HotkeyProvider>
      </RealtimeProvider>
    </QueryProvider>
  );
}
