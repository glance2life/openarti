"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { User, BookMarked } from "lucide-react";
import React from "react";

const LABEL_MAP: Record<string, string> = {
  settings: "Settings",
  account: "Account",
  "api-keys": "API Keys",
  connect: "Connect",
};

/**
 * Determine icon for a breadcrumb segment based on route structure.
 * Routes:
 *   /{owner}                         -> owner (User)
 *   /{owner}/{collection}[/...]      -> owner / collection (BookMarked)
 */
function getSegmentIcon(segments: string[], index: number) {
  const cls = "size-3.5 shrink-0";

  // /{owner}/settings/... route -- no icons for settings sub-pages
  if (index >= 1 && segments[1] === "settings") {
    if (index === 0) return <User className={cls} />;
    return null;
  }

  // /{owner} or /{owner}/{collection}[/...]
  if (index === 0) return <User className={cls} />;
  if (index === 1) return <BookMarked className={cls} />;
  return null;
}

export function ContentHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, i) => ({
    label: LABEL_MAP[segment] || segment,
    href: "/" + segments.slice(0, i + 1).join("/"),
    icon: getSegmentIcon(segments, i),
  }));

  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center border-b px-6">
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={crumb.href}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage className="inline-flex items-center gap-1.5">
                    {crumb.icon}
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    href={crumb.href}
                    className="inline-flex items-center gap-1.5"
                  >
                    {crumb.icon}
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </header>
  );
}
