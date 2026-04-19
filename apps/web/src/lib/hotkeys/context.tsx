"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parse, matches, type KeyChord } from "./parse";

export type HotkeyEntry = {
  id: string;
  keys: string;
  chords: KeyChord[];
  handler: (e: KeyboardEvent) => void;
  label: string;
  group?: string;
  allowInInput?: boolean;
  when?: () => boolean;
  preventDefault?: boolean;
};

export type HotkeyInput = Omit<HotkeyEntry, "chords">;

type Registry = Map<string, HotkeyEntry>;

type HotkeyContextValue = {
  register: (input: HotkeyInput) => void;
  unregister: (id: string) => void;
  list: () => HotkeyEntry[];
  subscribe: (cb: () => void) => () => void;
};

const HotkeyContext = createContext<HotkeyContextValue | null>(null);

const SEQUENCE_TIMEOUT_MS = 1500;

function isEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function HotkeyProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<Registry>(new Map());
  const subscribersRef = useRef<Set<() => void>>(new Set());
  const pendingRef = useRef<{ chord: KeyChord; expiresAt: number } | null>(null);

  const notify = useCallback(() => {
    for (const cb of subscribersRef.current) cb();
  }, []);

  const register = useCallback(
    (input: HotkeyInput) => {
      const entry: HotkeyEntry = {
        ...input,
        chords: parse(input.keys),
      };
      if (process.env.NODE_ENV !== "production") {
        for (const existing of registryRef.current.values()) {
          if (existing.id === entry.id) continue;
          if (existing.keys === entry.keys && (existing.when?.() ?? true) && (entry.when?.() ?? true)) {
            // eslint-disable-next-line no-console
            console.warn(
              `[hotkeys] duplicate binding for "${entry.keys}": "${existing.label}" vs "${entry.label}"`,
            );
          }
        }
      }
      registryRef.current.set(entry.id, entry);
      notify();
    },
    [notify],
  );

  const unregister = useCallback(
    (id: string) => {
      if (registryRef.current.delete(id)) notify();
    },
    [notify],
  );

  const list = useCallback(() => Array.from(registryRef.current.values()), []);

  const subscribe = useCallback((cb: () => void) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const editing = isEditingTarget(e.target);
      const now = Date.now();
      const pending = pendingRef.current;
      const pendingExpired = pending && pending.expiresAt < now;
      if (pendingExpired) pendingRef.current = null;

      const entries = Array.from(registryRef.current.values());

      // First, try matching as the second step of a pending sequence.
      if (pendingRef.current) {
        const first = pendingRef.current.chord;
        for (const entry of entries) {
          if (entry.chords.length !== 2) continue;
          if (!chordsEqual(entry.chords[0], first)) continue;
          if (!matches(e, entry.chords[1])) continue;
          if (editing && !entry.allowInInput) continue;
          if (entry.when && !entry.when()) continue;
          pendingRef.current = null;
          if (entry.preventDefault !== false) e.preventDefault();
          entry.handler(e);
          return;
        }
        // Any other key terminates the pending sequence.
        pendingRef.current = null;
      }

      // Match single-chord bindings.
      for (const entry of entries) {
        if (entry.chords.length !== 1) continue;
        if (!matches(e, entry.chords[0])) continue;
        if (editing && !entry.allowInInput) continue;
        if (entry.when && !entry.when()) continue;
        if (entry.preventDefault !== false) e.preventDefault();
        entry.handler(e);
        return;
      }

      // Otherwise, see if this key starts any sequence.
      for (const entry of entries) {
        if (entry.chords.length !== 2) continue;
        if (!matches(e, entry.chords[0])) continue;
        if (editing && !entry.allowInInput) continue;
        if (entry.when && !entry.when()) continue;
        pendingRef.current = {
          chord: entry.chords[0],
          expiresAt: now + SEQUENCE_TIMEOUT_MS,
        };
        if (entry.preventDefault !== false) e.preventDefault();
        return;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const value = useMemo<HotkeyContextValue>(
    () => ({ register, unregister, list, subscribe }),
    [register, unregister, list, subscribe],
  );

  return <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>;
}

function chordsEqual(a: KeyChord, b: KeyChord): boolean {
  return (
    a.key === b.key &&
    !!a.mod === !!b.mod &&
    !!a.ctrl === !!b.ctrl &&
    !!a.shift === !!b.shift &&
    !!a.alt === !!b.alt
  );
}

export function useHotkeyContext(): HotkeyContextValue {
  const ctx = useContext(HotkeyContext);
  if (!ctx) throw new Error("useHotkeyContext must be used within <HotkeyProvider>");
  return ctx;
}

export function useHotkeyList(): HotkeyEntry[] {
  const ctx = useHotkeyContext();
  const [entries, setEntries] = useState<HotkeyEntry[]>(() => ctx.list());
  useEffect(() => {
    setEntries(ctx.list());
    return ctx.subscribe(() => setEntries(ctx.list()));
  }, [ctx]);
  return entries;
}
