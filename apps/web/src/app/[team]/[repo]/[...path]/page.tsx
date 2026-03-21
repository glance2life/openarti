import { apiFetch } from "@/lib/api";
import { getRenderer } from "@/components/renderers/registry";

interface ReadResult {
  path: string;
  content: string;
  lines: number;
  commit: string;
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ team: string; repo: string; path: string[] }>;
}) {
  const { team, repo, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");
  let data: ReadResult | null = null;
  let error = "";

  try {
    data = await apiFetch<ReadResult>(
      "POST",
      `/repos/${team}/${repo}/tools/read`,
      { path: filePath }
    );
  } catch (e) {
    error = (e as Error).message;
  }

  if (error || !data) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-4">
          {team}/{repo}/{filePath}
        </h1>
        <p className="text-red-600">{error || "Failed to load"}</p>
      </div>
    );
  }

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">
          <a href={`/${team}`} className="text-blue-600 hover:underline">
            {team}
          </a>
          <span className="text-gray-400"> / </span>
          <a
            href={`/${team}/${repo}`}
            className="text-blue-600 hover:underline"
          >
            {repo}
          </a>
          <span className="text-gray-400"> / </span>
          {filePath}
        </h1>
        <span className="text-xs text-gray-400">
          {data.lines} lines · {data.commit.slice(0, 7)}
        </span>
      </div>
      <div className="border rounded-lg p-6">
        <Renderer content={rawContent} filename={filePath} />
      </div>
    </div>
  );
}
