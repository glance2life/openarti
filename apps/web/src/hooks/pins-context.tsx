"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePins, type PinItem } from "./use-pins";

interface PinsContextValue {
  pins: PinItem[];
  loading: boolean;
  addPin: (targetType: "repo" | "file" | "dir", targetPath: string) => Promise<void>;
  removePin: (pinId: string) => Promise<void>;
  removePinByPath: (targetPath: string) => Promise<void>;
  isPinned: (targetPath: string) => boolean;
  activeTeam: string;
}

const PinsContext = createContext<PinsContextValue | null>(null);

export function PinsProvider({
  activeTeam,
  children,
}: {
  activeTeam: string;
  children: ReactNode;
}) {
  const pinsState = usePins(activeTeam);

  return (
    <PinsContext.Provider value={{ ...pinsState, activeTeam }}>
      {children}
    </PinsContext.Provider>
  );
}

export function usePinsContext() {
  const ctx = useContext(PinsContext);
  if (!ctx) throw new Error("usePinsContext must be used within PinsProvider");
  return ctx;
}
