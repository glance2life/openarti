import Link from "next/link";
import { FileIcon } from "@/lib/file-icon";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ArtifactViewer } from "@/components/artifact-viewer";
import { RestoreButton } from "@/components/restore-button";

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

interface LastCommit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ owner: string; collection: string; path: string[] }>;
}) {
  const { owner, collection, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");
  const filename = pathSegments[pathSegments.length - 1];

  // Try directory listing, file reading, and last commit in parallel
  const [lsResult, readResult, logResult] = await Promise.allSettled([
    apiFetch<{ entries: LsEntry[] }>("POST", `/collections/${owner}/${collection}/tools/ls`, {
      path: filePath,
    }),
    apiFetch<ReadResult>("POST", `/collections/${owner}/${collection}/tools/read`, {
      path: filePath,
    }),
    apiFetch<{ commits: LastCommit[] }>("GET", `/collections/${owner}/${collection}/log?path=${encodeURIComponent(filePath)}&limit=1`),
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
      <div className="px-6 py-6 space-y-4">
        <Card>
          <Table>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow key={entry.name}>
                  <TableCell>
                    <Link
                      href={`/${owner}/${collection}/${filePath}/${entry.name}`}
                      className="flex items-center gap-2 hover:underline"
                    >
                      <FileIcon filename={entry.name} isDirectory={entry.type === "dir"} />
                      {entry.name}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  // If it's a file, show file viewer
  if (readResult.status === "fulfilled") {
    const data = readResult.value;

    const rawContent = data.content
      .split("\n")
      .map((line) => {
        const match = line.match(/^\s*\d+\t(.*)$/);
        return match ? match[1] : line;
      })
      .join("\n");

    const lastCommit =
      logResult.status === "fulfilled" && logResult.value.commits.length > 0
        ? logResult.value.commits[0]
        : null;

    return (
      <ArtifactViewer
        owner={owner}
        collection={collection}
        filePath={filePath}
        filename={filename}
        initialContent={rawContent}
        lastCommit={lastCommit}
      />
    );
  }

  // File not found / deleted
  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <p className="text-4xl">🗂️</p>
        <p className="text-sm font-medium text-foreground">文件已删除</p>
        <p className="text-xs text-muted-foreground">
          <code className="bg-muted px-1 py-0.5 rounded">{filename}</code> 已被删除，但可以从历史记录恢复
        </p>
        <RestoreButton owner={owner} collection={collection} filePath={filePath} />
        <div>
          <Link
            href={`/${owner}/${collection}`}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            返回 {collection}
          </Link>
        </div>
      </div>
    </div>
  );
}
