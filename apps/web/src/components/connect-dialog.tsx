"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConnectAgents } from "@/components/connect-agents";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectDialog({ open, onOpenChange }: ConnectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[70vh] overflow-y-auto top-[12%] -translate-y-0 p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-6">
          <ConnectAgents />
        </div>
      </DialogContent>
    </Dialog>
  );
}
