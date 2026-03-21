import type { Command } from "commander";
import { resolveContext, type ResolvedContext } from "./api-client.js";

export function parsePath(input: string): {
  owner: string;
  repo: string;
  path: string;
} {
  const parts = input.split("/");
  if (parts.length < 3) {
    throw new Error(
      "Path must be in format: owner/repo/path (e.g. nestor/docs/hello.md)"
    );
  }
  const [owner, repo, ...rest] = parts;
  return { owner, repo, path: rest.join("/") };
}

export function parseRepoPath(input: string): {
  owner: string;
  repo: string;
  path?: string;
} {
  const parts = input.split("/");
  if (parts.length < 2) {
    throw new Error(
      "Path must be in format: owner/repo[/path] (e.g. nestor/docs)"
    );
  }
  const [owner, repo, ...rest] = parts;
  return { owner, repo, path: rest.length > 0 ? rest.join("/") : undefined };
}

export function getContext(cmd: Command): ResolvedContext {
  let root: Command = cmd;
  while (root.parent) root = root.parent;
  const globalOpts = root.opts<{ token?: string; endpoint?: string }>();
  return resolveContext(globalOpts);
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}
