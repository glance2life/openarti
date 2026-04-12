import type { Command } from "commander";
import { parsePath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { RmResponse } from "@openarti/shared";

export function registerRm(program: Command) {
  program
    .command("rm <path>")
    .description("Delete a file from a collection")
    .option("-m, --message <msg>", "Commit message")
    .action(async (pathArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, collection, path: filePath } = parsePath(pathArg);

      const result = await apiRequest<RmResponse>(
        ctx,
        "POST",
        `/collections/${owner}/${collection}/tools/rm`,
        {
          path: filePath,
          ...(opts.message && { message: opts.message }),
        }
      );

      console.log(`Deleted ${filePath} (${result.commit.slice(0, 7)})`);
    });
}
