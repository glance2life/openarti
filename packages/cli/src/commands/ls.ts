import type { Command } from "commander";
import { parseCollectionPath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { LsResponse } from "@openarti/shared";

export function registerLs(program: Command) {
  program
    .command("ls <collection> [path]")
    .description("List files in a collection directory")
    .action(async (collectionArg: string, pathArg: string | undefined, cmd: Command) => {
      const ctx = getContext(cmd);
      const parsed = parseCollectionPath(collectionArg);
      const dirPath = pathArg ?? parsed.path;

      const result = await apiRequest<LsResponse>(
        ctx,
        "POST",
        `/collections/${parsed.owner}/${parsed.collection}/tools/ls`,
        { ...(dirPath && { path: dirPath }) }
      );

      for (const entry of result.entries) {
        console.log(entry.type === "dir" ? `${entry.name}/` : entry.name);
      }
    });
}
