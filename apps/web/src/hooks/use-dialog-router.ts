"use client";

import { useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * Open a dialog by setting `?dialog=<name>` (+ optional extra params) in the URL.
 */
export function useOpenDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (dialog: string, extra?: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("dialog", dialog);
      if (extra) {
        for (const [k, v] of Object.entries(extra)) params.set(k, v);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
}

/**
 * Close the active dialog by removing `dialog` (and dialog-specific keys) from the URL.
 */
export function useCloseDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dialog");
    // Clean up dialog-specific params
    params.delete("owner");
    params.delete("collection");
    params.delete("section");
    params.delete("returnTo");
    params.delete("agent");
    params.delete("method");
    const str = params.toString();
    router.replace(str ? `${pathname}?${str}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);
}
