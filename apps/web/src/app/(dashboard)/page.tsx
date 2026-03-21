import { apiFetch } from "@/lib/api";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch } from "lucide-react";

interface Team {
  id: string;
  name: string;
  description: string;
  role: string;
}

interface Repo {
  id: string;
  name: string;
  owner: string;
  description: string;
  visibility: string;
}

export default async function HomePage() {
  const { teams } = await apiFetch<{ teams: Team[] }>("GET", "/user/teams");

  const teamsWithRepos = await Promise.all(
    teams.map(async (team) => {
      try {
        const repos = await apiFetch<Repo[]>("GET", `/repos/${team.name}`);
        return { ...team, repos };
      } catch {
        return { ...team, repos: [] as Repo[] };
      }
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Your teams and repositories
        </p>
      </div>

      {teamsWithRepos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground">
              You are not a member of any team yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        teamsWithRepos.map((team) => (
          <section key={team.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/${team.name}`}
                className="text-lg font-semibold hover:underline"
              >
                {team.name}
              </Link>
              <Badge variant="secondary">{team.role}</Badge>
            </div>

            {team.repos.length === 0 ? (
              <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No repositories yet.{" "}
                  <Link
                    href={`/${team.name}`}
                    className="underline hover:text-foreground"
                  >
                    Create one
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {team.repos.map((repo) => (
                  <Link key={repo.id} href={`/${team.name}/${repo.name}`}>
                    <Card className="transition-colors hover:border-foreground/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <GitBranch className="size-4 text-muted-foreground" />
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
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
