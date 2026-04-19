"use client";

import { useEffect, useId, useRef } from "react";
import { useHotkeyContext } from "@/lib/hotkeys/context";

export interface UseHotkeyOptions {
  label: string;
  group?: string;
  allowInInput?: boolean;
  when?: () => boolean;
  preventDefault?: boolean;
  enabled?: boolean;
}

export function useHotkey(
  keys: string,
  handler: (e: KeyboardEvent) => void,
  options: UseHotkeyOptions,
): void {
  const ctx = useHotkeyContext();
  const id = useId();
  const handlerRef = useRef(handler);
  const whenRef = useRef(options.when);

  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    whenRef.current = options.when;
  });

  const { label, group, allowInInput, preventDefault, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    ctx.register({
      id,
      keys,
      handler: (e) => handlerRef.current(e),
      label,
      group,
      allowInInput,
      preventDefault,
      when: () => (whenRef.current ? whenRef.current() : true),
    });
    return () => ctx.unregister(id);
  }, [ctx, id, keys, label, group, allowInInput, preventDefault, enabled]);
}
