import type { Command } from "commander";
import { parsePath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { ReadResponse } from "@openarti/shared";

export function registerRead(program: Command) {
  program
    .command("read <path>")
    .description("Read a file from a repo")
    .option("--offset <n>", "Start line number", parseInt)
    .option("--limit <n>", "Number of lines to read", parseInt)
    .option("--ref <commit>", "Read a specific version")
    .action(async (pathArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, repo, path: filePath } = parsePath(pathArg);

      const result = await apiRequest<ReadResponse>(
        ctx,
        "POST",
        `/repos/${owner}/${repo}/tools/read`,
        {
          path: filePath,
          ...(opts.offset && { offset: opts.offset }),
          ...(opts.limit && { limit: opts.limit }),
          ...(opts.ref && { ref: opts.ref }),
        }
      );

      console.log(result.content);
    });
}
