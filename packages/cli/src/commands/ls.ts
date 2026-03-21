import type { Command } from "commander";
import { parseRepoPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { LsResponse } from "@openarti/shared";

export function registerLs(program: Command) {
  program
    .command("ls <repo> [path]")
    .description("List files in a repo directory")
    .action(async (repoArg: string, pathArg: string | undefined, cmd: Command) => {
      const ctx = getContext(cmd);
      const parsed = parseRepoPath(repoArg);
      const dirPath = pathArg ?? parsed.path;

      const result = await apiRequest<LsResponse>(
        ctx,
        "POST",
        `/repos/${parsed.owner}/${parsed.repo}/tools/ls`,
        { ...(dirPath && { path: dirPath }) }
      );

      for (const entry of result.entries) {
        console.log(entry.type === "dir" ? `${entry.name}/` : entry.name);
      }
    });
}
