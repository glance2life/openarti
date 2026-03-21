import type { Command } from "commander";
import { parsePath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { EditResponse } from "@openarti/shared";

export function registerEdit(program: Command) {
  program
    .command("edit <path>")
    .description("Edit a file in a repo (string replacement)")
    .requiredOption("--old <string>", "String to find")
    .requiredOption("--new <string>", "Replacement string")
    .option("--replace-all", "Replace all occurrences")
    .option("-m, --message <msg>", "Commit message")
    .action(async (pathArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, repo, path: filePath } = parsePath(pathArg);

      const result = await apiRequest<EditResponse>(
        ctx,
        "POST",
        `/repos/${owner}/${repo}/tools/edit`,
        {
          path: filePath,
          old_string: opts.old,
          new_string: opts.new,
          ...(opts.replaceAll && { replace_all: true }),
          ...(opts.message && { message: opts.message }),
        }
      );

      console.log(
        `Edited ${filePath}: ${result.replaced} replacement(s) (${result.commit.slice(0, 7)})`
      );
    });
}
