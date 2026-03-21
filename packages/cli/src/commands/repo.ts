import type { Command } from "commander";
import { getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { RepoInfo } from "@openarti/shared";

export function registerRepo(program: Command) {
  const repo = program
    .command("repo")
    .description("Manage repos");

  repo
    .command("create <team/name>")
    .description("Create a new repo")
    .option("--description <desc>", "Repo description")
    .option("--visibility <vis>", "private or public", "private")
    .action(async (repoArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const parts = repoArg.split("/");
      if (parts.length !== 2) {
        throw new Error("Argument must be in format: team/name");
      }
      const [team, name] = parts;

      const result = await apiRequest<RepoInfo>(
        ctx,
        "POST",
        `/repos/${team}`,
        {
          name,
          ...(opts.description && { description: opts.description }),
          ...(opts.visibility && { visibility: opts.visibility }),
        }
      );

      console.log(`Created ${result.owner}/${result.name} (${result.visibility})`);
    });

  repo
    .command("list <team>")
    .description("List repos for a team")
    .action(async (team: string, cmd: Command) => {
      const ctx = getContext(cmd);

      const repos = await apiRequest<RepoInfo[]>(
        ctx,
        "GET",
        `/repos/${team}`
      );

      if (repos.length === 0) {
        console.log("No repos found.");
        return;
      }

      for (const r of repos) {
        const desc = r.description ? `  ${r.description}` : "";
        console.log(`${r.name}\t${r.visibility}${desc}`);
      }
    });
}
