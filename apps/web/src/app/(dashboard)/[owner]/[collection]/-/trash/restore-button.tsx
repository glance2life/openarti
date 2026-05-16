"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function TrashRestoreButton({
  owner,
  collection,
  filePath,
}: {
  owner: string;
  collection: string;
  filePath: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/collections/${owner}/${collection}/tools/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ path: filePath }),
        }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      setDone(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span className="text-xs text-muted-foreground">Restored</span>;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRestore}
      disabled={loading}
    >
      {loading ? "Restoring…" : "Restore"}
    </Button>
  );
}
