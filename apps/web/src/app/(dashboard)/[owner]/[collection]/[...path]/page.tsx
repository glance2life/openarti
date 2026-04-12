import Link from "next/link";
import { FileIcon } from "@/lib/file-icon";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ArtifactViewer } from "@/components/artifact-viewer";

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

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ owner: string; collection: string; path: string[] }>;
}) {
  const { owner, collection, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");
  const filename = pathSegments[pathSegments.length - 1];

  // Try directory listing and file reading in parallel
  const [lsResult, readResult] = await Promise.allSettled([
    apiFetch<{ entries: LsEntry[] }>("POST", `/collections/${owner}/${collection}/tools/ls`, {
      path: filePath,
    }),
    apiFetch<ReadResult>("POST", `/collections/${owner}/${collection}/tools/read`, {
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

    return (
      <ArtifactViewer
        owner={owner}
        collection={collection}
        filePath={filePath}
        filename={filename}
        initialContent={rawContent}
      />
    );
  }

  // Error state
  const errorMsg =
    readResult.status === "rejected"
      ? (readResult.reason as Error).message
      : "Not found";

  return (
    <div className="px-6 py-6 space-y-4">
      <Card>
        <CardContent className="py-6 text-center text-sm text-destructive">
          {errorMsg}
        </CardContent>
      </Card>
    </div>
  );
}
