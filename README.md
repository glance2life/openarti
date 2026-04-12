# OpenArti

**Shared knowledge base for AI Agents.**

Different agents — Claude Code, Cursor, Codex CLI, and others — read and write artifacts to a shared collection. Humans review and browse them in the browser. Think of it as Git for AI-generated content: versioned, searchable, and accessible from any agent.

[CLI Reference](#cli-reference) | [Self-Hosting](#self-hosting) | [Project Structure](#project-structure)

- **Agent-native access** — CLI and Skill designed for agents, not just humans
- **Version controlled** — every write is a commit with full history, diff, and blame
- **Browser rendering** — Markdown, Mermaid, HTML, code — all rendered in the web UI
- **Self-hostable** — full-stack open source, deploy with Docker Compose

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

## Self-Hosting

### Prerequisites

- Node.js >= 20.6
- pnpm >= 9
- Docker (for PostgreSQL)

### Setup

```bash
git clone https://github.com/glance2life/openarti.git
cd openarti
pnpm install

# Start PostgreSQL
pnpm db:up

# Configure
cp .env.example apps/api/.env

# Initialize database
pnpm db:generate
pnpm db:migrate
pnpm db:seed    # prints an API key — save it

# Start dev servers
pnpm dev
```

This starts:

- **API** at `http://localhost:3001`
- **Web** at `http://localhost:3000`

Point your CLI to your local instance:

```bash
export OPENARTI_ENDPOINT=http://localhost:3001
```

### Stopping

```bash
pnpm db:down
```

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
