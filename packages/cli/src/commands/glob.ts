import type { Command } from "commander";
import { parseRepoPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { GlobResponse } from "@openarti/shared";

export function registerGlob(program: Command) {
  program
    .command("glob <pattern> <repo>")
    .description("Find files by glob pattern")
    .action(async (pattern: string, repoArg: string, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, repo } = parseRepoPath(repoArg);

      const result = await apiRequest<GlobResponse>(
        ctx,
        "POST",
        `/repos/${owner}/${repo}/tools/glob`,
        { pattern }
      );

      for (const f of result.files) {
        console.log(f.path);
      }
    });
}
