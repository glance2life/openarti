"use client";

import { useEffect, useRef } from "react";
import type { CollectionRef, FileRef } from "@openarti/shared";
import { useRealtimeAdapter } from "./context";

function useStableCallback(cb: () => void) {
  const ref = useRef(cb);
  useEffect(() => {
    ref.current = cb;
  });
  return ref;
}

export function useCollectionRealtime(ref: CollectionRef, onChange: () => void): void {
  const adapter = useRealtimeAdapter();
  const cbRef = useStableCallback(onChange);

  useEffect(() => {
    if (!adapter) return;
    return adapter.subscribeCollection(ref, () => cbRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, ref.owner, ref.name]);
}

export function useFileRealtime(ref: FileRef, onChange: () => void): void {
  const adapter = useRealtimeAdapter();
  const cbRef = useStableCallback(onChange);

  useEffect(() => {
    if (!adapter) return;
    return adapter.subscribeFile(ref, () => cbRef.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, ref.owner, ref.name, ref.path]);
}
