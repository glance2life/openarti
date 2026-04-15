# Self-Hosting OpenArti

OpenArti is fully open source and designed to run on your own infrastructure. All state lives in PostgreSQL — there is no local filesystem, no object storage, no Redis, no background worker. This keeps the moving parts small and the deployment shapes flexible.

This guide covers three ways to run OpenArti:

1. [Local development](#local-development) — `pnpm dev`, Postgres in Docker.
2. [Docker Compose](#docker-compose) — single-box self-hosting.
3. [Cloud](#cloud) — managed Postgres plus serverless or container API.

---

## Prerequisites

- Node.js >= 20.6
- pnpm >= 9
- Docker (for PostgreSQL, or for the full compose stack)
- PostgreSQL >= 14 if you bring your own database (OpenArti uses `bigserial`, `tsvector`, and GIN indexes — no private extensions)

---

## Local development

Best for trying OpenArti or hacking on the code.

```bash
git clone https://github.com/glance2life/openarti.git
cd openarti
pnpm install

# Start PostgreSQL in Docker
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

This runs:

- **API** at `http://localhost:3001`
- **Web** at `http://localhost:3000`

Point the CLI at your local instance:

```bash
export OPENARTI_ENDPOINT=http://localhost:3001
export OPENARTI_TOKEN=<api key printed by db:seed>
```

Stop everything:

```bash
pnpm db:down
```

---

## Docker Compose

Best for a single-box deployment on your own server (VPS, home lab, on-prem).

```bash
git clone https://github.com/glance2life/openarti.git
cd openarti
cp .env.example .env    # fill in required variables
docker compose -f docker/docker-compose.yml up -d
```

The compose file starts three containers:

- `api` — Hono API server
- `web` — Next.js frontend
- `postgres` — PostgreSQL (the only container with a persistent volume)

Put a reverse proxy (Caddy, Traefik, nginx) in front to terminate TLS and route `/` to `web` and `/api` to `api`.

A single-box deployment comfortably serves thousands of users. When you outgrow it, migrate the database to managed Postgres and move the API to containers or functions — no code changes required.

---

## Cloud

Best for teams that want zero database ops or serverless scale-to-zero.

Because every API request is self-contained and all state lives in Postgres, the same build runs under long-running containers or on-demand functions. You only pick where each piece lives:

```
Web (Vercel / Netlify / Cloudflare Pages)
  ─► API (Vercel Functions / Cloudflare Workers / Fly / Railway / Cloud Run)
       ─► Postgres (Supabase / Neon / RDS / Cloud SQL)
       ─► Google OAuth / generic OIDC (optional)
```

### API host

| Shape | Typical platforms | When to pick |
|-------|-------------------|--------------|
| Serverless functions | Vercel Functions, Cloudflare Workers, AWS Lambda | Bursty or sparse traffic; minimal ops |
| Long-running container | Fly.io, Railway, Render, Cloud Run, ECS | Steady traffic; cold-start sensitive; prefer a local connection pool |

The API is built on Hono (Web-standard Request/Response), so the exact same artifact runs in any of these.

### Database host

Any managed PostgreSQL 14+ works:

| Option | Notes |
|--------|-------|
| Supabase | Built-in connection pooler, dashboard, backups — closest to a "Vercel backend" |
| Neon | Native serverless (pay per compute time, < 500 ms cold start); HTTP driver fits FaaS best |
| AWS RDS / Aurora | Enterprise-grade; bring your own PgBouncer |
| Google Cloud SQL | Same profile as RDS; integrates cleanly with Cloud Run over private IP |
| Self-hosted Postgres | The compose file's default |

### Serverless connection pooling

`postgres-js` keeps a long-lived pool by default. Under FaaS, every cold start would open a fresh connection and quickly exhaust the database. **Swap `DATABASE_URL` to a pooler endpoint or an HTTP driver**:

- Supabase: use port `6543` (transaction mode).
- Neon: use the serverless driver (HTTP).

No application-code changes are required — only the connection string and the driver initialization line.

---

## Environment variables

See `.env.example` for the full list. The required set:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_URL` | Public URL of the API |
| `BETTER_AUTH_SECRET` | Random secret used to sign sessions |
| `WEB_ORIGIN` | Public URL of the web app (used for CORS) |

Optional (authentication providers):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Enable Google OAuth |
| `OIDC_ISSUER` / `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | Enable a generic OIDC provider |
| `ALLOW_REGISTRATION` | Set to `true` to allow public signups |

---

## What OpenArti does *not* need

Explicitly not in the deployment footprint:

- **Object storage** (S3 / R2) — file content lives in `arti_file_snapshot.content`.
- **Shared filesystem** (EFS, Azure Files, GCS FUSE) — the API has no disk dependency.
- **Search engine** (Meilisearch, Elasticsearch) — `tsvector` + GIN covers `grep`.
- **Redis / distributed lock service** — concurrency is serialized via `pg_advisory_xact_lock`.
- **Queue / background worker** — there are no async jobs.

This keeps the runbook short: back up Postgres, and you have backed up OpenArti.

---

## When file sizes grow

File contents are stored directly in a Postgres `text` column. If individual files exceed ~1 MB or the database passes ~100 GB of content, you can offload blob storage to S3 / R2 by changing `content` to `content_ref` in the schema and adding a `BlobStore` implementation behind the engine. This layer is intentionally not built yet (YAGNI) — the current shape works well into tens of gigabytes.
