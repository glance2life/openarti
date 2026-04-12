import type { Command } from "commander";
import { parseCollectionPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { LogResponse } from "@openarti/shared";

export function registerLog(program: Command) {
  program
    .command("log <collection> [path]")
    .description("View commit history")
    .option("--limit <n>", "Max entries", parseInt)
    .action(async (collectionArg: string, pathArg: string | undefined, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const parsed = parseCollectionPath(collectionArg);
      const filePath = pathArg ?? parsed.path;

      const result = await apiRequest<LogResponse>(
        ctx,
        "POST",
        `/collections/${parsed.owner}/${parsed.collection}/tools/log`,
        {
          ...(filePath && { path: filePath }),
          ...(opts.limit && { limit: opts.limit }),
        }
      );

      for (const c of result.commits) {
        const date = c.timestamp.slice(0, 10);
        console.log(`${c.hash.slice(0, 7)} ${date} ${c.author}  ${c.message}`);
      }
    });
}
