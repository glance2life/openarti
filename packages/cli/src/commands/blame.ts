import type { Command } from "commander";
import { parsePath, getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { BlameResponse } from "@openarti/shared";

export function registerBlame(program: Command) {
  program
    .command("blame <path>")
    .description("View line authorship")
    .action(async (pathArg: string, cmd: Command) => {
      const ctx = getContext(cmd);
      const { owner, collection, path: filePath } = parsePath(pathArg);

      const result = await apiRequest<BlameResponse>(
        ctx,
        "POST",
        `/collections/${owner}/${collection}/tools/blame`,
        { path: filePath }
      );

      for (const l of result.lines) {
        const date = l.timestamp.slice(0, 10);
        const lineNo = String(l.line).padStart(4);
        console.log(
          `${l.commit.slice(0, 7)} (${l.author} ${date}) ${lineNo}| ${l.text}`
        );
      }
    });
}
