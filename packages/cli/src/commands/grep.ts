import type { Command } from "commander";
import { parseCollectionPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { GrepResponse } from "@openarti/shared";

export function registerGrep(program: Command) {
  program
    .command("grep <pattern> <collection>")
    .description("Search file content in a collection")
    .option("--glob <pattern>", "Filter by file pattern")
    .option("-C, --context <n>", "Context lines around matches", parseInt)
    .option("-i, --ignore-case", "Case-insensitive search")
    .action(async (pattern: string, collectionArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, collection } = parseCollectionPath(collectionArg);

      const result = await apiRequest<GrepResponse>(
        ctx,
        "POST",
        `/collections/${owner}/${collection}/tools/grep`,
        {
          pattern,
          ...(opts.glob && { glob: opts.glob }),
          ...(opts.context != null && { context: opts.context }),
          ...(opts.ignoreCase && { ignore_case: true }),
        }
      );

      for (const m of result.matches) {
        for (const l of m.lines) {
          const sep = l.match ? ":" : "-";
          console.log(`${m.path}${sep}${l.line}${sep}${l.text}`);
        }
      }
    });
}
