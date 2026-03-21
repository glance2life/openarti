import { apiFetch } from "@/lib/api";

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

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">
        <a href={`/${team}`} className="text-blue-600 hover:underline">
          {team}
        </a>
        <span className="text-gray-400"> / </span>
        {repo}
      </h1>
      <div className="mt-4">
        {error ? (
          <p className="text-red-600">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-gray-500">Empty repository.</p>
        ) : (
          <ul className="space-y-1">
            {entries.map((e) => (
              <li key={e.name} className="flex items-center gap-2">
                <span className="text-gray-400">
                  {e.type === "dir" ? "📁" : "📄"}
                </span>
                {e.type === "file" ? (
                  <a
                    href={`/${team}/${repo}/${e.name}`}
                    className="text-blue-600 hover:underline"
                  >
                    {e.name}
                  </a>
                ) : (
                  <span>{e.name}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
