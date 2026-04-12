"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, AlertTriangle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface OAuthConsentProps {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope: string;
  userName: string;
}

export function OAuthConsent({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  scope,
  userName,
}: OAuthConsentProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAuthorize() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/oauth/authorize`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge,
          scope,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error_description || data.error || "Authorization failed");
        setLoading(false);
        return;
      }

      // Redirect back to the MCP client with the auth code
      window.location.href = data.redirect_uri;
    } catch {
      setError("Failed to connect to server");
      setLoading(false);
    }
  }

  function handleDecline() {
    // Redirect back with error
    const url = new URL(redirectUri);
    url.searchParams.set("error", "access_denied");
    if (state) url.searchParams.set("state", state);
    window.location.href = url.toString();
  }

  return (
    <div className="w-full max-w-lg space-y-6 px-4">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">
          Authorize API access
        </h1>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-200">
                MCP Client Connection
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                This is an MCP (Model Context Protocol) client designed to
                connect with AI applications. Please ensure you trust this
                application before granting access to your data.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 rounded-lg border p-4">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-lg font-bold">
            {(clientId || "?")[0].toUpperCase()}
          </div>
          <p className="text-sm">
            <span className="font-medium">{clientId}</span> is requesting API
            access as <span className="font-medium">{userName}</span>.
          </p>
        </div>

        <div className="mt-6">
          <h2 className="font-medium">Permissions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This application will have access to:
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              "Read and Write access to your collections and files",
              "Read access to your profile",
              "Search and browse your collections",
            ].map((perm) => (
              <li key={perm} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                {perm}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-8 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={handleDecline} disabled={loading}>
            Decline
          </Button>
          <Button onClick={handleAuthorize} disabled={loading}>
            {loading ? "Authorizing..." : "Authorize"}
          </Button>
        </div>
      </div>
    </div>
  );
}
