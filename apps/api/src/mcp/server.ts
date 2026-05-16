import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { engine } from "../services/storage.js";
import { resolveCollection, checkCollectionAccess, listCollections } from "../services/collection.js";
import type { AuthUser } from "../middleware/auth.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "openarti",
    version: "1.0.0",
  });

  // Helper: resolve user from extra.authInfo
  function getUser(extra: Record<string, unknown>): AuthUser {
    const authInfo = extra.authInfo as { extra?: { user?: AuthUser } } | undefined;
    const user = authInfo?.extra?.user;
    if (!user) throw new Error("Authentication required");
    return user;
  }

  // Helper: resolve collection and check read access
  async function resolveAndCheckRead(args: { owner: string; collection: string }, user: AuthUser) {
    const resolved = await resolveCollection(args.owner, args.collection);
    if (resolved.visibility === "private") {
      await checkCollectionAccess(user.id, resolved.collectionId, resolved.ownerId, "read");
    }
    return resolved;
  }

  // Helper: resolve collection and check edit access
  async function resolveAndCheckEdit(args: { owner: string; collection: string }, user: AuthUser) {
    const resolved = await resolveCollection(args.owner, args.collection);
    await checkCollectionAccess(user.id, resolved.collectionId, resolved.ownerId, "edit");
    return resolved;
  }

  // ---- list-collections ----
  server.registerTool(
    "list-collections",
    {
      description:
        "List all OpenArti collections accessible to the current user, including owned collections and collections shared with them. Use this to discover available owner/collection pairs before calling other tools.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_args, extra) => {
      const user = getUser(extra);
      const collections = await listCollections(user.id);
      return { content: [{ type: "text" as const, text: JSON.stringify(collections, null, 2) }] };
    }
  );

  // ---- ls ----
  server.registerTool(
    "ls",
    {
      description: "List files and directories in an OpenArti collection",
      inputSchema: { owner: z.string(), collection: z.string(), path: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const entries = await engine.listFiles(resolved.collectionId, args.path);
      return { content: [{ type: "text" as const, text: JSON.stringify(entries, null, 2) }] };
    }
  );

  // ---- read ----
  server.registerTool(
    "read",
    {
      description: "Read a file from an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string(),
        offset: z.number().int().positive().optional(),
        limit: z.number().int().positive().optional(),
        ref: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const result = await engine.readFile(resolved.collectionId, args.path, {
        ref: args.ref,
        offset: args.offset,
        limit: args.limit,
      });
      return { content: [{ type: "text" as const, text: result.content }] };
    }
  );

  // ---- write ----
  server.registerTool(
    "write",
    {
      description: "Write or create a file in an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string(),
        content: z.string(),
        message: z.string().optional(),
      },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckEdit(args, user);
      
      const result = await engine.writeFile(resolved.collectionId, args.path, args.content, {
        message: args.message,
        author: `${user.name} <${user.email}>`,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ path: args.path, commit: result.commit, created: result.created }) },
        ],
      };
    }
  );

  // ---- edit ----
  server.registerTool(
    "edit",
    {
      description: "Edit a file in an OpenArti collection using search-and-replace",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string(),
        old_string: z.string(),
        new_string: z.string(),
        replace_all: z.boolean().optional(),
        message: z.string().optional(),
      },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckEdit(args, user);
      
      const result = await engine.editFile(
        resolved.collectionId,
        args.path,
        [{ old_string: args.old_string, new_string: args.new_string }],
        {
          replaceAll: args.replace_all,
          message: args.message,
          author: `${user.name} <${user.email}>`,
        }
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ path: args.path, commit: result.commit, replaced: result.replaced }) },
        ],
      };
    }
  );

  // ---- rm ----
  server.registerTool(
    "rm",
    {
      description: "Delete a file from an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string(),
        message: z.string().optional(),
      },
      annotations: { destructiveHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckEdit(args, user);
      
      const result = await engine.removeFile(resolved.collectionId, args.path, {
        message: args.message,
        author: `${user.name} <${user.email}>`,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ path: args.path, commit: result.commit }) }],
      };
    }
  );

  // ---- grep ----
  server.registerTool(
    "grep",
    {
      description: "Search file contents in an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        pattern: z.string(),
        glob: z.string().optional(),
        context: z.number().int().nonnegative().optional(),
        ignore_case: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const result = await engine.grepFiles(resolved.collectionId, args.pattern, {
        glob: args.glob,
        context: args.context,
        ignoreCase: args.ignore_case,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ matches: result.matches, total_matches: result.totalMatches }, null, 2) }],
      };
    }
  );

  // ---- glob ----
  server.registerTool(
    "glob",
    {
      description: "Find files matching a glob pattern in an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        pattern: z.string(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const files = await engine.globFiles(resolved.collectionId, args.pattern);
      return { content: [{ type: "text" as const, text: JSON.stringify(files, null, 2) }] };
    }
  );

  // ---- log ----
  server.registerTool(
    "log",
    {
      description: "Get version history for an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const commits = await engine.getLog(resolved.collectionId, {
        path: args.path,
        limit: args.limit,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(commits, null, 2) }] };
    }
  );

  // ---- diff ----
  server.registerTool(
    "diff",
    {
      description: "Get diff for changes in an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const result = await engine.getDiff(resolved.collectionId, {
        path: args.path,
        from: args.from,
        to: args.to,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ diff: result.diff, stats: result.stats }, null, 2) }],
      };
    }
  );

  // ---- blame ----
  server.registerTool(
    "blame",
    {
      description: "Get per-line authorship (blame) for a file in an OpenArti collection",
      inputSchema: {
        owner: z.string(),
        collection: z.string(),
        path: z.string(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => {
      const user = getUser(extra);
      const resolved = await resolveAndCheckRead(args, user);
      
      const lines = await engine.getBlame(resolved.collectionId, args.path);
      return { content: [{ type: "text" as const, text: JSON.stringify(lines, null, 2) }] };
    }
  );

  return server;
}
