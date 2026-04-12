"use client";

import { useSearchParams } from "next/navigation";
import { useCloseDialog } from "@/hooks/use-dialog-router";
import { SettingsDialog } from "@/components/settings-dialog";
import { ConnectDialog } from "@/components/connect-dialog";
import { CollectionSettingsDialog } from "@/components/collection-settings-dialog";

interface DialogRouterProps {
  user: { name: string; email: string };
}

export function DialogRouter({ user }: DialogRouterProps) {
  const searchParams = useSearchParams();
  const closeDialog = useCloseDialog();

  const activeDialog = searchParams.get("dialog");

  const handleClose = (open: boolean) => {
    if (!open) closeDialog();
  };

  return (
    <>
      <SettingsDialog
        user={user}
        open={activeDialog === "settings"}
        onOpenChange={handleClose}
      />
      <ConnectDialog
        open={activeDialog === "connect"}
        onOpenChange={handleClose}
      />
      {activeDialog === "collection-settings" &&
        searchParams.get("owner") &&
        searchParams.get("collection") && (
          <CollectionSettingsDialog
            owner={searchParams.get("owner")!}
            collection={searchParams.get("collection")!}
            open
            onOpenChange={handleClose}
          />
        )}
    </>
  );
}
