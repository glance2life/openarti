import type { Command } from "commander";
import { parseCollectionPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { DiffResponse } from "@openarti/shared";

export function registerDiff(program: Command) {
  program
    .command("diff <collection> [path]")
    .description("Compare versions")
    .option("--from <commit>", "Start commit")
    .option("--to <commit>", "End commit")
    .action(async (collectionArg: string, pathArg: string | undefined, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const parsed = parseCollectionPath(collectionArg);
      const filePath = pathArg ?? parsed.path;

      const result = await apiRequest<DiffResponse>(
        ctx,
        "POST",
        `/collections/${parsed.owner}/${parsed.collection}/tools/diff`,
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
