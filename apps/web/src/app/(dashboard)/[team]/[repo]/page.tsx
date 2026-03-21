import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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

interface LsEntry {
  name: string;
  type: "file" | "dir";
}

export default async function RepoPage({
  params,
}: {
  params: Promise<{ team: string; repo: string }>;
}) {
  const { team, repo } = await params;
  let entries: LsEntry[] = [];
  let error = "";

  try {
    const result = await apiFetch<{ entries: LsEntry[] }>(
      "POST",
      `/repos/${team}/${repo}/tools/ls`,
      { path: undefined }
    );
    entries = result.entries;
  } catch (e) {
    error = (e as Error).message;
  }

  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href={`/${team}`}>{team}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{repo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="text-2xl font-bold tracking-tight">{repo}</h1>

      {error ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Empty repository. Use the CLI to write your first artifact.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableBody>
              {sorted.map((entry) => (
                <PinnableRow
                  key={entry.name}
                  href={`/${team}/${repo}/${entry.name}`}
                  name={entry.name}
                  type={entry.type}
                  pinPath={`${repo}/${entry.name}`}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
