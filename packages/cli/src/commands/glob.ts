import type { Command } from "commander";
import { parseCollectionPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { GlobResponse } from "@openarti/shared";

export function registerGlob(program: Command) {
  program
    .command("glob <pattern> <collection>")
    .description("Find files by glob pattern")
    .action(async (pattern: string, collectionArg: string, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, collection } = parseCollectionPath(collectionArg);

      const result = await apiRequest<GlobResponse>(
        ctx,
        "POST",
        `/collections/${owner}/${collection}/tools/glob`,
        { pattern }
      );

      for (const f of result.files) {
        console.log(f.path);
      }
    });
}
