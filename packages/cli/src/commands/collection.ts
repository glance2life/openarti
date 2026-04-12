import type { Command } from "commander";
import { getContext } from "../utils.js";
import { apiRequest } from "../api-client.js";
import type { CollectionInfo } from "@openarti/shared";

export function registerCollection(program: Command) {
  const collection = program
    .command("collection")
    .description("Manage collections");

  collection
    .command("create <owner/name>")
    .description("Create a new collection")
    .option("--description <desc>", "Collection description")
    .option("--visibility <vis>", "private or public", "private")
    .action(async (collectionArg: string, opts, cmd: Command) => {
      const ctx = getContext(cmd);
      const parts = collectionArg.split("/");
      if (parts.length !== 2) {
        throw new Error("Argument must be in format: owner/name");
      }
      const [owner, name] = parts;

      const result = await apiRequest<CollectionInfo>(
        ctx,
        "POST",
        `/collections`,
        {
          name,
          ...(opts.description && { description: opts.description }),
          ...(opts.visibility && { visibility: opts.visibility }),
        }
      );

      console.log(`Created ${result.owner}/${result.name} (${result.visibility})`);
    });

  collection
    .command("list <owner>")
    .description("List collections for an owner")
    .action(async (owner: string, cmd: Command) => {
      const ctx = getContext(cmd);

      const collections = await apiRequest<CollectionInfo[]>(
        ctx,
        "GET",
        `/collections/${encodeURIComponent(owner)}`
      );

      if (collections.length === 0) {
        console.log("No collections found.");
        return;
      }

      for (const c of collections) {
        const desc = c.description ? `  ${c.description}` : "";
        console.log(`${c.name}\t${c.visibility}${desc}`);
      }
    });
}
