import Link from "next/link";
import { FileIcon } from "@/lib/file-icon";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { PublicArtifactViewer } from "./viewer";

const API_URL = process.env.OPENARTI_API_URL || "http://localhost:3001";

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

async function publicApiFetch<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const json = await res.json().catch(() => null);
    const msg =
      (json as { error?: { message?: string } } | null)?.error?.message ||
      `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ owner: string; collection: string; path: string[] }>;
}) {
  const { owner, collection, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");
  const filename = pathSegments[pathSegments.length - 1];

  const [lsResult, readResult] = await Promise.allSettled([
    publicApiFetch<{ entries: LsEntry[] }>(
      "POST",
      `/collections/${owner}/${collection}/tools/ls`,
      { path: filePath }
    ),
    publicApiFetch<ReadResult>(
      "POST",
      `/collections/${owner}/${collection}/tools/read`,
      { path: filePath }
    ),
  ]);

  // Directory view
  if (
    lsResult.status === "fulfilled" &&
    lsResult.value.entries.length > 0
  ) {
    const sorted = [...lsResult.value.entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div className="mx-auto max-w-4xl px-6 py-6 space-y-4">
        <div className="text-sm text-muted-foreground">
          {owner}/{collection}/{filePath}
        </div>
        <Card>
          <Table>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow key={entry.name}>
                  <TableCell>
                    <Link
                      href={`/s/${owner}/${collection}/${filePath}/${entry.name}`}
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

  // File view
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
      <PublicArtifactViewer
        owner={owner}
        collection={collection}
        filePath={filePath}
        filename={filename}
        initialContent={rawContent}
      />
    );
  }

  // Error / not found / private
  const errorMsg =
    readResult.status === "rejected"
      ? (readResult.reason as Error).message
      : "Not found";

  return (
    <div className="flex flex-1 items-center justify-center">
      <Card>
        <CardContent className="py-8 px-12 text-center text-sm text-muted-foreground">
          {errorMsg}
        </CardContent>
      </Card>
    </div>
  );
}
