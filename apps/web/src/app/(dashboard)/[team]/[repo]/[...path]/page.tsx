import { apiFetch } from "@/lib/api";
import { getRenderer } from "@/components/renderers/registry";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Table,
  TableBody,
} from "@/components/ui/table";
import { PinnableRow } from "@/components/pinnable-row";
import { PinButton } from "@/components/pin-button";
import React from "react";

interface LsEntry {
  name: string;
  type: "file" | "dir";
}

interface ReadResult {
  path: string;
  content: string;
  lines: number;
  commit: string;
}

function PathBreadcrumb({
  team,
  repo,
  pathSegments,
}: {
  team: string;
  repo: string;
  pathSegments: string[];
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${team}`}>{team}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href={`/${team}/${repo}`}>{repo}</BreadcrumbLink>
        </BreadcrumbItem>
        {pathSegments.map((segment, i) => (
          <React.Fragment key={i}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {i === pathSegments.length - 1 ? (
                <BreadcrumbPage>{segment}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink
                  href={`/${team}/${repo}/${pathSegments.slice(0, i + 1).join("/")}`}
                >
                  {segment}
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ team: string; repo: string; path: string[] }>;
}) {
  const { team, repo, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");

  // Try directory listing and file reading in parallel
  const [lsResult, readResult] = await Promise.allSettled([
    apiFetch<{ entries: LsEntry[] }>("POST", `/repos/${team}/${repo}/tools/ls`, {
      path: filePath,
    }),
    apiFetch<ReadResult>("POST", `/repos/${team}/${repo}/tools/read`, {
      path: filePath,
    }),
  ]);

  // If it's a directory with entries, show directory view
  if (
    lsResult.status === "fulfilled" &&
    lsResult.value.entries.length > 0
  ) {
    const sorted = [...lsResult.value.entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="space-y-4">
        <PathBreadcrumb team={team} repo={repo} pathSegments={pathSegments} />
        <h1 className="text-2xl font-bold tracking-tight">
          {pathSegments[pathSegments.length - 1]}
        </h1>
        <Card>
          <Table>
            <TableBody>
              {sorted.map((entry) => (
                <PinnableRow
                  key={entry.name}
                  href={`/${team}/${repo}/${filePath}/${entry.name}`}
                  name={entry.name}
                  type={entry.type}
                  pinPath={`${repo}/${filePath}/${entry.name}`}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  // If it's a file, show file view
  if (readResult.status === "fulfilled") {
    const data = readResult.value;

    // Strip line numbers from content for rendering
    const rawContent = data.content
      .split("\n")
      .map((line) => {
        const match = line.match(/^\s*\d+\t(.*)$/);
        return match ? match[1] : line;
      })
      .join("\n");

    const Renderer = getRenderer(filePath);

    return (
      <div className="space-y-4">
        <PathBreadcrumb team={team} repo={repo} pathSegments={pathSegments} />

        <div className="flex items-center justify-between">
          <div className="group flex items-center gap-1.5">
            <h1 className="text-lg font-semibold">
              {pathSegments[pathSegments.length - 1]}
            </h1>
            <PinButton
              targetType="file"
              targetPath={`${repo}/${filePath}`}
              className="opacity-100"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{data.lines} lines</span>
            <Badge variant="outline" className="font-mono text-xs">
              {data.commit.slice(0, 7)}
            </Badge>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <Renderer content={rawContent} filename={filePath} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  const errorMsg =
    readResult.status === "rejected"
      ? (readResult.reason as Error).message
      : "Not found";

  return (
    <div className="space-y-4">
      <PathBreadcrumb team={team} repo={repo} pathSegments={pathSegments} />
      <Card>
        <CardContent className="py-6 text-center text-sm text-destructive">
          {errorMsg}
        </CardContent>
      </Card>
    </div>
  );
}
