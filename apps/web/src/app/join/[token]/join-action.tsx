"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface JoinActionProps {
  token: string;
  target: { id: string; name: string; owner: string };
}

export function JoinAction({ token, target }: JoinActionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/join/${token}`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        // If already a member, redirect instead of showing error
        if (res.status === 409) {
          redirectToTarget();
          return;
        }
        throw new Error(msg);
      }

      redirectToTarget();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function redirectToTarget() {
    router.push(`/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.name)}`);
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button className="w-full" onClick={handleJoin} disabled={loading}>
        {loading ? "Joining..." : `Join ${target.name}`}
      </Button>
    </div>
  );
}
