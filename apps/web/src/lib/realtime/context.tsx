"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { RealtimeAdapter } from "@openarti/shared";

const RealtimeContext = createContext<RealtimeAdapter | null>(null);

export function useRealtimeAdapter(): RealtimeAdapter | null {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<RealtimeAdapter | null>(null);

  useEffect(() => {
    let cancelled = false;
    const driver = process.env.NEXT_PUBLIC_REALTIME_DRIVER ?? "polling";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    if (driver === "supabase") {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        void import("./supabase").then(({ SupabaseAdapter }) => {
          if (cancelled) return;
          setAdapter(new SupabaseAdapter({ supabaseUrl, supabaseAnonKey, apiUrl }));
        });
        return () => {
          cancelled = true;
        };
      }
      // misconfigured → fall through to polling
    }

    const interval = Number(process.env.NEXT_PUBLIC_REALTIME_POLL_INTERVAL_MS ?? "5000");
    void import("./polling").then(({ PollingAdapter }) => {
      if (cancelled) return;
      setAdapter(new PollingAdapter({ apiUrl, intervalMs: interval }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return <RealtimeContext.Provider value={adapter}>{children}</RealtimeContext.Provider>;
}
