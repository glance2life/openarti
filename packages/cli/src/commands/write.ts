import type { Command } from "commander";
import { parsePath, getContext, readStdin } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { WriteResponse } from "@openarti/shared";

export function registerWrite(program: Command) {
  program
    .command("write <path>")
    .description("Write a file to a collection (reads content from stdin)")
    .option("-m, --message <msg>", "Commit message")
    .action(async (pathArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, collection, path: filePath } = parsePath(pathArg);

      const content = await readStdin();

      const result = await apiRequest<WriteResponse>(
        ctx,
        "POST",
        `/collections/${owner}/${collection}/tools/write`,
        {
          path: filePath,
          content,
          ...(opts.message && { message: opts.message }),
        }
      );

      const verb = result.created ? "Created" : "Updated";
      console.log(`${verb} ${filePath} (${result.commit.slice(0, 7)})`);
    });
}
