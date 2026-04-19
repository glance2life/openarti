"use client";

import { FileText, PlugZap, Search } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useOpenDialog } from "@/hooks/use-dialog-router";

interface CollectionEmptyStateProps {
  owner: string;
  collection: string;
  isEmpty: boolean;
}

export function CollectionEmptyState({
  owner,
  collection,
  isEmpty,
}: CollectionEmptyStateProps) {
  const openDialog = useOpenDialog();

  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="relative mb-6">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 translate-x-2 translate-y-1 rotate-6 rounded-xl bg-muted/40"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 -translate-x-2 translate-y-0.5 -rotate-6 rounded-xl bg-muted/30"
          />
          <div className="flex size-16 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm">
            <FileText className="size-7 text-muted-foreground/70" />
          </div>
        </div>

        <div className="mb-1 font-mono text-xs text-muted-foreground/80">
          {owner}/<span className="text-foreground/80">{collection}</span>
        </div>

        <h2 className="mb-2 text-lg font-semibold tracking-tight">
          {isEmpty ? "Waiting for your first artifact" : "Select an artifact"}
        </h2>

        <p className="mb-6 text-sm text-muted-foreground">
          {isEmpty
            ? "Connect an agent and it will start writing artifacts into this collection."
            : "Pick a file from the sidebar to preview its contents."}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {isEmpty ? (
            <button
              type="button"
              onClick={() => openDialog("connect")}
              className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            >
              <PlugZap className="size-3.5" />
              Connect an agent
              <Kbd keys="c" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Search className="size-3.5" />
              Search
              <Kbd keys="mod+j" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
