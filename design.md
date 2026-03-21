# OpenArti — Architecture Design

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph Clients["Client Layer"]
        Web["Web App<br/>(Next.js)"]
        CLI["arti CLI<br/>(npm pkg)"]
        Skill["Skill<br/>(SKILL.md)"]
    end


    subgraph Server["API Server (Hono)"]
        subgraph Routes["Route Layer"]
            ToolAPI["Tool API<br/>read, write, edit<br/>grep, glob, ls<br/>log, diff, blame"]
            MgmtAPI["Mgmt API<br/>team, repo, list"]
        end
        subgraph Services["Service Layer"]
            RepoService["RepoService"]
            TeamService["TeamService"]
            AuthService["AuthService"]
        end
    end

    subgraph Storage["Storage Layer"]
        Git[("Git Storage<br/>(bare repos)<br/>───<br/>artifact content<br/>version history<br/>diff, blame")]
        PG[("PostgreSQL<br/>───<br/>team, user, repo<br/>member, list<br/>api_key, permissions")]
    end

    Web -->|"HTTP / WS"| ToolAPI
    Web -->|"HTTP"| MgmtAPI
    CLI -->|"HTTP"| ToolAPI
    Skill -.->|"via CLI"| CLI

    ToolAPI --> RepoService
    MgmtAPI --> TeamService

    RepoService --> Git
    TeamService --> PG
    AuthService --> PG
    RepoService --> PG
```

---

## 2. Key Design Decisions

### 2.1 Git as Content Storage Engine

All artifact content is stored in **bare git repos**, not in the database.

**Why:**
- The spec requires commit, diff, blame, log, rollback — all native git capabilities, zero extra implementation
- Every write = a git commit, version history is automatic
- Blame is line-level, naturally supports multi-Agent collaboration tracing
- Self-hosting only needs git + PostgreSQL, extremely low barrier

**Git operations:** The server uses git plumbing commands (no libgit2 bindings), keeping things simple and reliable. Key operation mappings:

| Tool API | Git Operation |
|----------|---------|
| `read` | `git show HEAD:<path>` |
| `write` | `hash-object` → `read-tree` → `update-index` → `write-tree` → `commit-tree` → `update-ref` |
| `edit` | read → string replace → same as write flow |
| `grep` | `git grep` |
| `glob` | `git ls-tree` + pattern match |
| `ls` | `git ls-tree` |
| `log` | `git log` |
| `diff` | `git diff` |
| `blame` | `git blame` |

**Concurrent write strategy:** Optimistic concurrency + CAS (compare-and-swap), no locks.

```mermaid
flowchart TD
    A["Read current HEAD commit hash<br/>(record as old_head)"] --> B["git hash-object -w<br/>write blob"]
    B --> C["read-tree + update-index + write-tree<br/>build new tree"]
    C --> D["git commit-tree<br/>create new commit (parent = old_head)"]
    D --> E["git update-ref HEAD new_commit old_head<br/>atomic CAS"]
    E -->|"old_head unchanged → success"| F["Return commit hash"]
    E -->|"old_head changed → CAS failed"| A
```

Concurrency scenarios:

| Scenario | Result |
|------|------|
| Concurrent writes to **different files** | CAS-failed side retries, rebuilds tree from new HEAD → both writes preserved |
| Concurrent edits to **same file, different locations** | Retry applies string replace on new content → both edits preserved |
| Concurrent edits to **same file, same location** | Retry finds old_string no longer matches → returns 409 conflict |

No file locks or mutexes anywhere. `update-ref` atomicity guarantees correctness. Write conflicts are rare (agents rarely edit the same line simultaneously), and when they do occur, the error semantics are clear.

**Filesystem layout:**

```
/data/repos/
  {team_name}/
    {repo_name}.git/     ← bare git repo
```

### 2.2 PostgreSQL for Metadata

Git handles content only. Team, User, Repo metadata, API keys, and permission relationships are stored in PostgreSQL.

```mermaid
erDiagram
    users {
        uuid id PK
        string email UK
        string name
        string avatar_url
        datetime created_at
    }

    teams {
        uuid id PK
        string name UK
        string description
        datetime created_at
        datetime updated_at
    }

    team_members {
        uuid team_id FK
        uuid user_id FK
        enum role "owner | member"
    }

    repos {
        uuid id PK
        uuid team_id FK
        string name
        string description
        enum visibility "private | public"
        string git_path
        datetime created_at
    }

    api_keys {
        uuid id PK
        uuid user_id FK
        string key_hash
        datetime created_at
        datetime last_used_at
    }

    lists {
        uuid id PK
        uuid team_id FK
        string name
        string description
    }

    list_repos {
        uuid list_id FK
        string repo_ref "team/repo"
    }

    comments {
        uuid id PK
        uuid repo_id FK
        string path
        int start_line
        int end_line
        string context "anchor text snapshot"
        string body
        uuid author_id FK
        boolean resolved
        boolean orphaned "anchor invalidated"
        datetime created_at
        datetime updated_at
    }

    users ||--o{ team_members : "belongs to"
    teams ||--o{ team_members : "has"
    teams ||--o{ repos : "owns"
    users ||--o{ api_keys : "has"
    teams ||--o{ lists : "owns"
    lists ||--o{ list_repos : "contains"
    repos ||--o{ comments : "has"
    users ||--o{ comments : "authors"
```

### 2.3 Hono as API Framework

Why Hono over Express/Fastify:

- **Lightweight**: zero dependencies, fast startup
- **Multi-runtime**: same code runs on Node (self-hosting) and Cloudflare Workers (Cloud)
- **TypeScript-first**: type-safe routing and middleware
- **Web standards**: based on Request/Response, no framework lock-in

Cloud deployment can migrate directly to edge runtimes without rewriting.

### 2.4 Next.js as Web Framework

- SSR: public repo artifact pages need SEO
- React ecosystem: rendering engine uses React components (Markdown, Mermaid, JSX sandbox, etc.)
- API Routes: during development, API and Web can coexist; separate later

### 2.5 Real-time Updates

```mermaid
sequenceDiagram
    participant C as Client (Browser)
    participant WS as WebSocket Server
    participant API as API Server
    participant EE as EventEmitter / Redis pub/sub

    C->>WS: Subscribe to repo changes
    Note over API: Agent writes artifact
    API->>API: git commit
    API->>EE: Publish file.updated event
    EE->>WS: Forward event
    WS->>C: Push change notification
    C->>C: Re-render
```

Single-instance deployment (self-hosting) doesn't need Redis — in-memory EventEmitter suffices. Multi-instance Cloud deployment introduces Redis pub/sub.

---

## 3. Monorepo Structure

```
openarti/
  apps/
    api/                    ← API server (Hono + Node)
      src/
        routes/
          tools.ts          ← Tool API (read, write, edit, grep...)
          repos.ts          ← Repo management API
        services/
          git.ts            ← Git operations wrapper
          repo.ts
        middleware/
          auth.ts           ← API Key / Session auth
        db/
          schema.ts         ← Drizzle schema
          migrations/
    web/                    ← Web frontend (Next.js)
      src/
        app/                ← App Router pages
          [team]/
            page.tsx        ← Team home
            [repo]/
              page.tsx      ← Repo home (file list)
              [...path]/
                page.tsx    ← Artifact render page
        components/
          renderers/        ← Rendering engine
            markdown.tsx
            code.tsx
            registry.ts
  packages/
    cli/                    ← arti CLI (npm package)
      src/
        commands/           ← One file per command
        api-client.ts       ← HTTP client wrapper
    shared/                 ← Shared types and utilities
      src/
        types.ts            ← API request/response types
        errors.ts           ← Error code definitions
  skills/
    openarti/               ← Agent Skill
      SKILL.md
  docker/
    docker-compose.yml      ← One-click self-hosting
    Dockerfile.api
    Dockerfile.web
```

Package management: **pnpm workspaces**. Build: **Turborepo**.

---

## 4. Core Flows

### 4.1 Agent Writes an Artifact

```mermaid
sequenceDiagram
    participant A as Agent
    participant S as Skill Prompt
    participant CLI as arti CLI
    participant API as API Server
    participant Git as Git Storage

    A->>S: Need to write an artifact
    S->>A: Guide to call arti write
    A->>CLI: echo "content" | arti write nestor/feature-x/spec.md -m "..."
    CLI->>API: POST /repos/nestor/feature-x/tools/write
    API->>API: Auth middleware validates API token
    API->>API: Permissions middleware checks team membership
    API->>Git: hash-object → write-tree → commit-tree → update-ref
    Git-->>API: commit hash
    API-->>API: Publish file.created event
    API-->>CLI: { path, commit, created }
    CLI-->>A: Plain text result
```

### 4.2 Web Viewing an Artifact

```mermaid
sequenceDiagram
    participant B as Browser
    participant Next as Next.js SSR
    participant API as API Server
    participant WS as WebSocket

    B->>Next: GET /nestor/feature-x/spec.md
    Next->>API: POST /tools/read { path: "spec.md" }
    API-->>Next: File content
    Next->>Next: Select Markdown renderer based on .md extension
    Next-->>B: Server-rendered HTML
    B->>B: Client-side hydrate
    B->>WS: Subscribe to repo changes
    Note over WS,B: Content updates push automatically → re-render
```

### 4.3 Edit Operation (Precise Replacement)

```mermaid
flowchart TD
    A["POST /tools/edit<br/>old_string + new_string"] --> B["git show HEAD:spec.md<br/>get full file content"]
    B --> C{"old_string<br/>occurrences?"}
    C -->|"0"| D["404 error<br/>old_string not found"]
    C -->|">1 without replace_all"| E["409 error<br/>report match count"]
    C -->|"1, or replace_all set"| F["Execute string replacement"]
    F --> G["Write file → git commit"]
    G --> H["Return { path, commit, replaced }"]
```

---

## 5. Authentication & Permissions

```mermaid
flowchart TB
    subgraph AuthEntry["Auth Entry Points"]
        Key["API Token<br/>OPENARTI_TOKEN<br/>(Agent / CLI)"]
        Session["Session<br/>OAuth → Cookie<br/>(Browser)"]
    end

    subgraph UnifiedAuth["Unified Authorization"]
        Resolve["Resolve to User identity"]
        Team["Check Team membership"]
        Repo["Check Repo visibility"]
    end

    Key --> Resolve
    Session --> Resolve
    Resolve --> Team --> Repo
```

**Permission rules are simple:**
- Public repo: read operations require no auth
- Private repo: must be a team member
- Write operations: must be a team member
- Admin operations (delete repo, manage members): must be team owner

---

## 6. Tech Stack Summary

| Layer | Choice | Rationale |
|----|------|------|
| Monorepo | pnpm + Turborepo | Fast, mature, TypeScript ecosystem standard |
| API Framework | Hono | Lightweight, multi-runtime, TS-first |
| Web Framework | Next.js (App Router) | SSR + React rendering ecosystem |
| Database | PostgreSQL | Metadata storage, mature and reliable |
| ORM | Drizzle | Lightweight, type-safe, good migrations |
| Content Storage | Bare Git Repos | Version operations with zero extra implementation |
| CLI | TypeScript + Commander.js | Shares types with the project |
| Real-time | WebSocket | Simple and direct |
| Auth | API Token + OAuth (Web) | Agents use tokens, humans use OAuth |
| Deployment | Docker Compose (self-hosting) | One command to start API + Web + PostgreSQL + Git |
| CI/CD | GitHub Actions | Standard choice |
| Language | TypeScript (full-stack) | Frontend, backend, and CLI share types; single language stack |

---

## 7. Deployment Architecture

### 7.1 Self-Hosting (Single Instance)

Most self-hosting scenarios don't need multiple instances. A single instance with periodic backups can support thousands of users.

```mermaid
graph TB
    subgraph DockerCompose["Docker Compose"]
        LB["Reverse Proxy<br/>(Caddy / Traefik)"]
        API["API Server<br/>(Hono + Node)"]
        Web["Web App<br/>(Next.js)"]
        PG[("PostgreSQL")]
        Git[("Git Repos<br/>/data/repos")]
    end

    User(("User / Agent")) --> LB
    LB --> API
    LB --> Web
    API --> PG
    API --> Git
    Web -->|"Internal call"| API
```

Start with: `docker compose up`. Three containers (API, Web, PostgreSQL), Git repos on a host-mounted volume. Real-time push uses in-memory EventEmitter — no Redis needed.

### 7.2 Cloud (Multi-Instance)

The core challenge with multiple instances: Git repos live on disk, multiple API instances can't each hold a copy.

Solution: extract a standalone **Git Storage Service**, making API instances stateless.

```mermaid
graph TB
    subgraph Edge
        CDN["CDN<br/>(Cloudflare)"]
    end

    subgraph APILayer["API Layer (stateless, horizontally scalable)"]
        API1["API Instance 1"]
        API2["API Instance 2"]
        API3["API Instance N..."]
    end

    subgraph GitService["Git Storage Service"]
        GW1["Git Worker 1<br/>/data/repos/a-m"]
        GW2["Git Worker 2<br/>/data/repos/n-z"]
    end

    Redis[("Redis<br/>pub/sub + routing table")]
    PG[("Managed PostgreSQL")]
    Web["Web App<br/>(Vercel)"]

    User(("User / Agent")) --> CDN
    CDN --> API1 & API2 & API3
    CDN --> Web
    API1 & API2 & API3 -->|"gRPC"| GW1 & GW2
    API1 & API2 & API3 --> PG
    API1 & API2 & API3 --> Redis
    GW1 & GW2 --> Redis
```

**Layer responsibilities:**

| Layer | Responsibility | Scaling |
|---|---|---|
| API Instances | Auth, permissions, request routing | Stateless, add instances horizontally |
| Git Workers | Hold bare repos, execute git operations | Sharded by team/repo |
| Redis | WebSocket event broadcast + Git Worker routing table | Single instance or cluster |
| PostgreSQL | Metadata | Managed, read-write splitting |

**API → Git Worker routing:** API receives a request, checks Redis routing table (team/repo → worker address), forwards git operations to the appropriate worker. New repos are assigned to workers by load and written to the routing table.

**Git Worker sharding strategy:** Sharded by team (all repos in a team on the same worker) for simplicity. Can later migrate hot data at per-repo granularity.

### 7.3 Comparison

| | Self-Hosting | Cloud |
|---|---|---|
| API | Single instance Node | Multi-instance stateless |
| Git Storage | Local disk, API operates directly | Git Storage Service, API calls via gRPC |
| Real-time Push | In-memory EventEmitter | Redis pub/sub |
| Database | Docker PostgreSQL | Managed PostgreSQL |
| Web | Same Docker Compose | Vercel / standalone deployment |
| CDN | None | Cloudflare |

**Code-level abstraction:** The API operates repos through a unified `GitService` interface. Self-hosting implements it as local git calls; Cloud implements it as a gRPC client. One codebase, two deployment modes.

```typescript
interface GitService {
  read(repo: string, path: string, opts?: ReadOpts): Promise<FileContent>
  write(repo: string, path: string, content: string, opts?: WriteOpts): Promise<Commit>
  edit(repo: string, path: string, edits: EditOp[], opts?: EditOpts): Promise<Commit>
  grep(repo: string, pattern: string, opts?: GrepOpts): Promise<GrepResult>
  // ...
}

// Self-hosting: direct git CLI calls
class LocalGitService implements GitService { ... }

// Cloud: gRPC calls to Git Worker
class RemoteGitService implements GitService { ... }
```

Cloud-specific features (future iterations):
- Analytics dashboard, audit logs
- SSO / SAML
- Automatic backups
- SLA + support

---

## 8. Rendering Engine Architecture

```mermaid
flowchart LR
    Input["filename.ext"] --> Registry["ExtensionRegistry<br/>.getRenderer(ext)"]
    Registry --> MD[".md → MarkdownRenderer<br/>(react-markdown + GFM)"]
    Registry --> HTML[".html → HtmlSandbox<br/>(iframe sandbox)"]
    Registry --> JSX[".jsx/.tsx → JsxSandbox<br/>(sandpack / iframe)"]
    Registry --> Mermaid[".mermaid → MermaidRenderer<br/>(mermaid.js)"]
    Registry --> SVG[".svg → SvgRenderer<br/>(sanitized)"]
    Registry --> YAML[".yaml → YamlRenderer<br/>(OpenAPI → Scalar / else highlight)"]
    Registry --> JSON[".json → JsonViewer<br/>(tree view)"]
    Registry --> TXT[".txt → PlainText<br/>(monospace)"]
    Registry --> Code["* → CodeRenderer<br/>(shiki, language inferred from ext)"]
```

Every Renderer is a React component with a uniform interface:

```typescript
interface RendererProps {
  content: string
  filename: string
}
```

Adding a new type = write a React component + register it in the Registry.

All Renderers support switching to source mode (raw text + syntax highlighting).

---

## 9. Development Phases

### Phase 1 — Core Viability

Goal: an Agent can read/write artifacts via the Skill, and the browser can render them.

- [x] API: Tool API (read, write, edit, rm, grep, glob, ls, log, diff, blame) + Git storage layer
- [x] API: Basic auth (API Key)
- [x] CLI: All commands
- [x] Web: Artifact rendering (Markdown, code)
- [x] Skill: SKILL.md
- [x] Docker Compose self-hosting

### Phase 2 — Full Features

- [ ] API: Management API (team, repo, list)
- [ ] API: Comment system (region anchoring + Agent reads via `read`)
- [ ] Web: All renderers, version history, source/preview toggle
- [ ] Web: Comment interaction + reference copy (with location info)
- [ ] Real-time updates (WebSocket)
- [ ] OAuth login

### Phase 3 — Collaboration & Polish

- [ ] List (cross-team aggregation)
- [ ] Public repo search and discovery

### Phase 4 — Cloud

- [ ] Edge deployment
- [ ] CDN + global acceleration
- [ ] Analytics dashboard
- [ ] Billing
