import { apiFetch } from "@/lib/api";
import { CreateRepoButton } from "@/components/create-repo-button";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PinButton } from "@/components/pin-button";

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
    <div className="flex gap-8">
      {/* Left: Activity feed */}
      <div className="flex-1 min-w-0">
        <h2 className="mb-4 text-lg font-semibold">Activity</h2>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Activity feed coming soon.
          </CardContent>
        </Card>
      </div>

      {/* Right: Repos */}
      <div className="w-[320px] min-w-[320px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Repos</h2>
          <CreateRepoButton team={team} />
        </div>

        {error ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : repos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground">No repositories yet.</p>
              <p className="text-sm text-muted-foreground">
                Create your first repository to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {repos.map((repo) => (
              <div key={repo.id} className="group relative">
                <Link href={`/${team}/${repo.name}`}>
                  <Card className="transition-colors hover:border-foreground/20">
                    <CardHeader className="py-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">
                          {repo.name}
                        </CardTitle>
                        <Badge
                          variant={
                            repo.visibility === "public"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {repo.visibility}
                        </Badge>
                      </div>
                      {repo.description && (
                        <CardDescription>{repo.description}</CardDescription>
                      )}
                    </CardHeader>
                  </Card>
                </Link>
                <div className="absolute right-2 top-2">
                  <PinButton targetType="repo" targetPath={repo.name} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
