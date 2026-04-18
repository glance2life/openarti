# OpenArti

**Shared knowledge base for AI Agents.**

Different agents — Claude Code, Cursor, Codex CLI, and others — read and write artifacts to a shared collection. Humans review and browse them in the browser. Think of it as Git for AI-generated content: versioned, searchable, and accessible from any agent.

[CLI Reference](#cli-reference) | [MCP Server](#mcp-server) | [Documentation](#documentation) | [Project Structure](#project-structure)

- **Agent-native access** — CLI, MCP server, and Skill designed for agents, not just humans
- **Version controlled** — every write is a commit with full history, diff, and blame
- **Browser rendering** — Markdown, Mermaid, HTML, code — all rendered in the web UI
- **Self-hostable** — full-stack open source, deploy with Docker Compose
- **Serverless-ready** — stateless API, all state in Postgres; deploys to Vercel / Workers / Lambda or any container host

## Quick Start

Install the skill in your agent (Claude Code, Cursor, or any agent that supports [skills](https://skills.sh)):

```bash
npx skills add openarti/openarti@openarti
```

Then just ask your agent:

> "Read the files in nestor/docs and summarize them"

The agent will automatically install the `arti` CLI and prompt you for an API token on first use.

## CLI Reference

```
arti
├── read <owner/collection/path>       Read a file
├── write <owner/collection/path>      Write a file (stdin)
├── edit <owner/collection/path>       Edit a file (string replacement)
├── rm <owner/collection/path>         Delete a file
├── ls <owner/collection> [path]       List directory
├── grep <pattern> <owner/collection>  Search file content
├── glob <pattern> <owner/collection>  Find files by pattern
├── log <owner/collection> [path]      Commit history
├── diff <owner/collection> [path]     Compare versions
├── blame <owner/collection/path>      Line-by-line authorship
└── collection
    ├── create <owner/name>            Create a collection
    └── list <owner>                   List collections
```

**Examples:**

```bash
# Write
echo "# API Design" | arti write nestor/docs/api.md -m "initial draft"

# Read
arti read nestor/docs/api.md

# Search
arti grep "authentication" nestor/docs
arti glob "*.md" nestor/docs

# Browse
arti ls nestor/docs
arti log nestor/docs

# Edit
arti edit nestor/docs/api.md --old "v1" --new "v2" -m "update version"
```

Global options: `--token <token>`, `--endpoint <url>`

## MCP Server

OpenArti exposes a native [Model Context Protocol](https://modelcontextprotocol.io) server, so MCP-capable clients (Claude Desktop, Claude Code, Cursor, etc.) can read and write your collections directly — no copy-paste.

Endpoint: `POST /mcp` (on the API server).

The transport is **stateless Streamable HTTP** (2025-03 spec, JSON responses — no SSE, no session affinity), which means the endpoint works just as well behind serverless functions as behind a long-running container.

Configure your MCP client:

```json
{
  "mcpServers": {
    "openarti": {
      "url": "https://your-api-host/mcp",
      "headers": { "Authorization": "Bearer oai_your_key_here" }
    }
  }
}
```

All CLI tools (`read`, `write`, `edit`, `rm`, `ls`, `grep`, `glob`, `log`, `diff`, `blame`) are exposed as MCP tools.

## Documentation

- [Self-Hosting Guide](./docs/self-hosting.md) — local dev, Docker Compose, and cloud deployment shapes.
- [Specification](./docs/spec.md) — product model, Web / CLI / MCP / REST surface.
- [Architecture](./docs/architecture.md) — storage engine, schema, and deployment architecture.

## Project Structure

```
apps/
  api/          Hono API server (REST + Tool API)
  web/          Next.js frontend (rendering + browsing)
packages/
  cli/          arti CLI
  shared/       Shared types
skills/
  openarti/     Agent skill (SKILL.md)
docker/         Docker Compose + Dockerfiles
openapi.yaml    OpenAPI spec
```
## License

[MIT](LICENSE)
