import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { FileIcon } from "@/lib/file-icon";
import { buttonVariants } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDetail {
  path: string;
  action: "create" | "update" | "delete";
}

interface Commit {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files: FileDetail[];
}

interface LogResponse {
  commits: Commit[];
  page: number;
  hasMore: boolean;
}

const ACTION_LABEL: Record<string, string> = {
  create: "A",
  update: "M",
  delete: "D",
};

const ACTION_COLOR: Record<string, string> = {
  create: "text-green-600 dark:text-green-400",
  update: "text-blue-600 dark:text-blue-400",
  delete: "text-red-500 dark:text-red-400",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ owner: string; collection: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { owner, collection } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));

  let data: LogResponse = { commits: [], page, hasMore: false };
  try {
    data = await apiFetch<LogResponse>(
      "GET",
      `/collections/${owner}/${collection}/log?page=${page}`
    );
  } catch {
    // empty / error — show empty state
  }

  return (
    <div className="px-6 py-6 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">History</h1>
        <Link
          href={`/${owner}/${collection}/-/trash`}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Trash
        </Link>
      </div>

      {data.commits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No commits yet.</p>
      ) : (
        <ol className="space-y-px">
          {data.commits.map((commit) => (
            <li
              key={commit.hash}
              className="rounded-lg border border-border bg-card p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-snug">
                    {commit.message || <span className="text-muted-foreground italic">no message</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {commit.author} · {formatTime(commit.timestamp)}
                  </p>
                </div>
                <code className="shrink-0 text-[10px] text-muted-foreground font-mono">
                  {commit.hash.slice(0, 7)}
                </code>
              </div>

              <ul className="space-y-0.5">
                {commit.files.map((f) => (
                  <li key={f.path} className="flex items-center gap-1.5">
                    <span
                      className={`w-4 shrink-0 text-center text-[11px] font-bold font-mono ${ACTION_COLOR[f.action] ?? ""}`}
                      title={f.action}
                    >
                      {ACTION_LABEL[f.action] ?? "?"}
                    </span>
                    <FileIcon filename={f.path.split("/").pop() ?? f.path} />
                    {f.action === "delete" ? (
                      <Link
                        href={`/${owner}/${collection}/${f.path}`}
                        className="text-xs text-muted-foreground line-through hover:no-underline hover:text-foreground truncate"
                      >
                        {f.path}
                      </Link>
                    ) : (
                      <Link
                        href={`/${owner}/${collection}/${f.path}`}
                        className="text-xs hover:underline underline-offset-2 truncate"
                      >
                        {f.path}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {(page > 1 || data.hasMore) && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={`/${owner}/${collection}/-/history?page=${page - 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ChevronLeft className="size-4 mr-1" />
              Newer
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-50 pointer-events-none")}>
              <ChevronLeft className="size-4 mr-1" />
              Newer
            </span>
          )}
          {data.hasMore ? (
            <Link
              href={`/${owner}/${collection}/-/history?page=${page + 1}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Older
              <ChevronRight className="size-4 ml-1" />
            </Link>
          ) : (
            <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-50 pointer-events-none")}>
              Older
              <ChevronRight className="size-4 ml-1" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
