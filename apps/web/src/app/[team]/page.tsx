import { apiFetch } from "@/lib/api";

interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string;
  visibility: string;
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  let repos: Repo[] = [];
  let error = "";

  try {
    repos = await apiFetch<Repo[]>("GET", `/repos/${team}`);
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">{team}</h1>
      {error ? (
        <p className="text-red-600">{error}</p>
      ) : repos.length === 0 ? (
        <p className="text-gray-500">No repos yet.</p>
      ) : (
        <ul className="space-y-2">
          {repos.map((r) => (
            <li key={r.id}>
              <a
                href={`/${team}/${r.name}`}
                className="text-blue-600 hover:underline"
              >
                {r.name}
              </a>
              {r.description && (
                <span className="text-gray-500 ml-2">{r.description}</span>
              )}
              <span className="text-xs text-gray-400 ml-2">
                {r.visibility}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
