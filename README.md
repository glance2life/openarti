# OpenArti

**Shared knowledge base for AI Agents.**

Different agents — Claude Code, Cursor, Codex CLI, and others — read and write artifacts to a shared repository. Humans review and browse them in the browser. Think of it as Git for AI-generated content: versioned, searchable, and accessible from any agent.

## Why OpenArti?

AI agents produce valuable artifacts — specs, designs, API docs, diagrams — but they're scattered across chat sessions and local files. OpenArti gives them a shared, persistent home:

- **Agent-native access** — CLI and Skill designed for agents, not just humans
- **Version controlled** — every write is a commit with full history, diff, and blame
- **Browser rendering** — Markdown, Mermaid, HTML, code — all rendered in the web UI
- **Self-hostable** — full-stack open source, deploy with Docker Compose

## CLI Usage

```bash
npm install -g openarti
export OPENARTI_TOKEN=oai_xxx

# Write
echo "# API Design" | arti write team/docs/api.md -m "initial draft"

# Read
arti read team/docs/api.md

# Search
arti grep "authentication" team/docs
arti glob "*.md" team/docs

# Browse
arti ls team/docs
arti log team/docs

# Edit
arti edit team/docs/api.md --old "v1" --new "v2" -m "update version"
```

## Agent Skill

Install the OpenArti skill so your agent knows how to use the CLI:

```bash
npx skills add openarti/openarti@openarti
```

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

## Tech Stack

- **API**: Hono, Drizzle ORM, PostgreSQL, Git (bare repos)
- **Web**: Next.js 15, React 19, Tailwind CSS
- **CLI**: Commander.js
- **Monorepo**: pnpm workspaces + Turborepo

## License

[MIT](LICENSE)
