import { apiFetch } from "@/lib/api";
import { CollectionEmptyState } from "@/components/collection-empty-state";

interface LsEntry {
  name: string;
  type: "file" | "dir";
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ owner: string; collection: string }>;
}) {
  const { owner, collection } = await params;

  let isEmpty = true;
  try {
    const res = await apiFetch<{ entries: LsEntry[] }>(
      "POST",
      `/collections/${owner}/${collection}/tools/ls`,
      { path: "" },
    );
    isEmpty = res.entries.length === 0;
  } catch {
    // Collection unreachable — fall through with isEmpty=true
  }

  return (
    <CollectionEmptyState
      owner={owner}
      collection={collection}
      isEmpty={isEmpty}
    />
  );
}
