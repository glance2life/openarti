"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

const SYSTEM_ROUTES = new Set(["settings", "connect", "join", "oauth"]);

interface SelectedCollection {
  owner: string;
  collection: string;
}

interface FinderNavigationContextValue {
  selectedCollection: SelectedCollection | null;
  viewMode: "collections" | "recent" | "connect";
  hydrated: boolean;
  selectCollection: (owner: string, collection: string) => void;
  selectRecentlyUpdated: () => void;
  selectConnect: () => void;
  clearSelection: () => void;
}

const FinderNavigationContext =
  createContext<FinderNavigationContextValue | null>(null);

type ViewMode = "collections" | "recent" | "connect";

const VIEW_MODE_KEY = "openarti-view-mode";

function parsePathname(pathname: string): {
  viewMode: ViewMode;
  selectedCollection: SelectedCollection | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (!firstSegment) {
    return { viewMode: "recent", selectedCollection: null };
  }

  if (firstSegment === "connect") {
    return { viewMode: "connect", selectedCollection: null };
  }

  if (SYSTEM_ROUTES.has(firstSegment)) {
    return { viewMode: "recent", selectedCollection: null };
  }

  // /{owner}/{collection}/... pattern
  if (segments.length >= 2 && !SYSTEM_ROUTES.has(segments[1])) {
    return {
      viewMode: "collections",
      selectedCollection: { owner: segments[0], collection: segments[1] },
    };
  }

  return { viewMode: "recent", selectedCollection: null };
}

export function FinderNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const initial = parsePathname(pathname);
  const [selectedCollection, setSelectedCollection] =
    useState<SelectedCollection | null>(initial.selectedCollection);
  const [viewMode, setViewMode] = useState<ViewMode>(initial.viewMode);
  const [hydrated, setHydrated] = useState(false);

  // Persist viewMode to sessionStorage (only after hydration,
  // so we don't overwrite the saved value with the SSR-derived initial state)
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {}
  }, [viewMode, hydrated]);

  // Sync state from URL changes (also handles initial mount / page refresh)
  useEffect(() => {
    const parsed = parsePathname(pathname);

    // Read sessionStorage directly to determine the real viewMode.
    // This is reliable on both initial mount (restoring after refresh) and
    // subsequent navigations, because we persist viewMode on every change.
    let savedViewMode: string | null = null;
    try {
      savedViewMode = sessionStorage.getItem(VIEW_MODE_KEY);
    } catch {}

    if (savedViewMode === "recent" && parsed.viewMode === "collections") {
      // URL looks like /{owner}/{col}/... but user is in recent mode —
      // keep recent mode, don't highlight any collection
      setViewMode("recent");
      setSelectedCollection(null);
    } else {
      setViewMode(parsed.viewMode);
      if (parsed.selectedCollection) {
        setSelectedCollection((prev) => {
          if (
            prev?.owner === parsed.selectedCollection!.owner &&
            prev?.collection === parsed.selectedCollection!.collection
          )
            return prev;
          return parsed.selectedCollection;
        });
      } else {
        setSelectedCollection(null);
      }
    }

    setHydrated(true);
  }, [pathname]);

  const selectCollection = useCallback(
    (owner: string, collection: string) => {
      setSelectedCollection({ owner, collection });
      setViewMode("collections");
      router.push(`/${owner}/${collection}`);
    },
    [router]
  );

  const selectRecentlyUpdated = useCallback(() => {
    setViewMode("recent");
    setSelectedCollection(null);
    router.push("/");
  }, [router]);

  const selectConnect = useCallback(() => {
    setViewMode("connect");
    setSelectedCollection(null);
    router.push("/connect");
  }, [router]);

  const clearSelection = useCallback(() => {
    setSelectedCollection(null);
    setViewMode("collections");
  }, []);

  return (
    <FinderNavigationContext.Provider
      value={{
        selectedCollection,
        viewMode,
        hydrated,
        selectCollection,
        selectRecentlyUpdated,
        selectConnect,
        clearSelection,
      }}
    >
      {children}
    </FinderNavigationContext.Provider>
  );
}

export function useFinderNavigation() {
  const ctx = useContext(FinderNavigationContext);
  if (!ctx) {
    throw new Error(
      "useFinderNavigation must be used within FinderNavigationProvider"
    );
  }
  return ctx;
}
