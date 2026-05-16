import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { FileIcon } from "@/lib/file-icon";
import { TrashRestoreButton } from "./restore-button";

interface DeletedFile {
  path: string;
  deletedAt: string;
}

interface TrashResponse {
  files: DeletedFile[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TrashPage({
  params,
}: {
  params: Promise<{ owner: string; collection: string }>;
}) {
  const { owner, collection } = await params;

  let data: TrashResponse = { files: [] };
  try {
    data = await apiFetch<TrashResponse>(
      "GET",
      `/collections/${owner}/${collection}/trash`
    );
  } catch {
    // empty / error — show empty state
  }

  return (
    <div className="px-6 py-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Trash</h1>
        <Link
          href={`/${owner}/${collection}/-/history`}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          History
        </Link>
      </div>

      {data.files.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-2xl">🗑️</p>
          <p className="text-sm text-muted-foreground">Trash is empty.</p>
        </div>
      ) : (
        <ul className="space-y-px">
          {data.files.map((file) => {
            const filename = file.path.split("/").pop() ?? file.path;
            return (
              <li
                key={file.path}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <FileIcon filename={filename} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.path}</p>
                  <p className="text-xs text-muted-foreground">
                    Deleted {formatTime(file.deletedAt)}
                  </p>
                </div>
                <TrashRestoreButton
                  owner={owner}
                  collection={collection}
                  filePath={file.path}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
