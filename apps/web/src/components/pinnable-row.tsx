"use client";

import Link from "next/link";
import { Folder, FileText, Package } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { PinButton } from "@/components/pin-button";

const ICONS = {
  file: FileText,
  dir: Folder,
  repo: Package,
};

interface PinnableRowProps {
  href: string;
  name: string;
  type: "file" | "dir" | "repo";
  /** Path used for pin target (e.g. "repoName" or "repoName/path/to/file") */
  pinPath: string;
}

export function PinnableRow({ href, name, type, pinPath }: PinnableRowProps) {
  const Icon = ICONS[type];

  return (
    <TableRow className="group">
      <TableCell>
        <div className="flex items-center justify-between">
          <Link
            href={href}
            className="flex items-center gap-2 hover:underline"
          >
            <Icon className="size-4 text-muted-foreground" />
            {name}
          </Link>
          <PinButton targetType={type === "repo" ? "repo" : type} targetPath={pinPath} />
        </div>
      </TableCell>
    </TableRow>
  );
}
