"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookMarked, Users, Globe, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateCollectionButton } from "@/components/create-collection-button";
import { CollectionRowMenu } from "@/components/collection-row-menu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Collection {
  id: string;
  name: string;
  owner: string;
  description: string;
  visibility: string;
}

interface SharedCollection extends Collection {
  level: "read" | "edit";
}

interface SidebarCollectionListProps {
  searchQuery?: string;
  onSelect?: (owner: string, collection: string) => void;
  selectedCollection?: { owner: string; collection: string } | null;
}

export function SidebarCollectionList({ searchQuery = "", onSelect, selectedCollection }: SidebarCollectionListProps) {
  const [own, setOwn] = useState<Collection[]>([]);
  const [shared, setShared] = useState<SharedCollection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/collections`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setOwn(Array.isArray(data.own) ? data.own : []);
        setShared(Array.isArray(data.shared) ? data.shared : []);
      })
      .catch(() => {
        setOwn([]);
        setShared([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const q = searchQuery.toLowerCase();
  const filteredOwn = q ? own.filter((c) => c.name.toLowerCase().includes(q)) : own;
  const filteredShared = q
    ? shared.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.owner.toLowerCase().includes(q)
      )
    : shared;

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-5/6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Mine */}
      <SectionLabel action={<CreateCollectionButton iconOnly />}>Mine</SectionLabel>
      <div className="flex flex-col gap-0.5 px-2">
        {filteredOwn.length === 0 && q && (
          <span className="px-2 py-1 text-xs text-muted-foreground">No matches</span>
        )}
        {filteredOwn.map((col) => (
          <CollectionRow key={col.id} col={col} selectedCollection={selectedCollection} onSelect={onSelect} />
        ))}
      </div>

      {/* Shared */}
      {(shared.length > 0 || q) && (
        <>
          <SectionLabel>Shared</SectionLabel>
          <div className="flex flex-col gap-0.5 px-2">
            {filteredShared.length === 0 && q && (
              <span className="px-2 py-1 text-xs text-muted-foreground">No matches</span>
            )}
            {filteredShared.map((col) => (
              <CollectionRow
                key={col.id}
                col={col}
                selectedCollection={selectedCollection}
                showOwner
                level={col.level}
                onSelect={onSelect}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-1">
      <span className="text-sm font-medium text-muted-foreground">
        {children}
      </span>
      {action}
    </div>
  );
}

function CollectionRow({
  col,
  selectedCollection,
  showOwner,
  level,
  onSelect,
}: {
  col: Collection;
  selectedCollection?: { owner: string; collection: string } | null;
  showOwner?: boolean;
  level?: "read" | "edit";
  onSelect?: (owner: string, collection: string) => void;
}) {
  const href = `/${col.owner}/${col.name}`;
  const isActive = selectedCollection?.owner === col.owner && selectedCollection?.collection === col.name;

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect) {
      e.preventDefault();
      onSelect(col.owner, col.name);
    }
  };

  return (
    <div className="group relative">
      <Link
        href={href}
        onClick={handleClick}
        className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent"
        }`}
      >
        {showOwner ? (
          <Users className="size-4 shrink-0" />
        ) : col.visibility === "public" ? (
          <Globe className="size-4 shrink-0" />
        ) : (
          <Lock className="size-4 shrink-0" />
        )}
        <span className="truncate">
          {showOwner ? `${col.owner}/${col.name}` : col.name}
        </span>
        {level && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1 py-0.5 text-[10px] leading-none text-muted-foreground">
            {level}
          </span>
        )}
      </Link>
      {!showOwner && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <CollectionRowMenu owner={col.owner} collectionName={col.name} />
        </div>
      )}
    </div>
  );
}
