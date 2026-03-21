import type { Command } from "commander";
import { parseRepoPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { DiffResponse } from "@openarti/shared";

export function registerDiff(program: Command) {
  program
    .command("diff <repo> [path]")
    .description("Compare versions")
    .option("--from <commit>", "Start commit")
    .option("--to <commit>", "End commit")
    .action(async (repoArg: string, pathArg: string | undefined, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const parsed = parseRepoPath(repoArg);
      const filePath = pathArg ?? parsed.path;

      const result = await apiRequest<DiffResponse>(
        ctx,
        "POST",
        `/repos/${parsed.owner}/${parsed.repo}/tools/diff`,
        {
          ...(filePath && { path: filePath }),
          ...(opts.from && { from: opts.from }),
          ...(opts.to && { to: opts.to }),
        }
      );

      console.log(result.diff);
      if (result.stats) {
        console.log(`+${result.stats.additions} -${result.stats.deletions}`);
      }
    });
}
