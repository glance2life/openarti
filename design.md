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
            MgmtAPI["Mgmt API<br/>collection, user,<br/>access, api_key"]
            MCPServer["MCP Server<br/>(SSE Transport)"]
        end
        subgraph Services["Service Layer"]
            ArtiEngine["Arti Engine<br/>(StorageEngine)"]
            CollectionService["CollectionService"]
            AuthService["AuthService"]
        end
    end

    subgraph Storage["Storage Layer"]
        FS[("File System<br/>(Weave CRDT)<br/>───<br/>artifact content<br/>version history<br/>diff, blame")]
        PG[("PostgreSQL<br/>───<br/>user, collection<br/>access, api_key<br/>pin, invite_link")]
    end

    Web -->|"HTTP"| ToolAPI
    Web -->|"HTTP"| MgmtAPI
    CLI -->|"HTTP"| ToolAPI
    Skill -.->|"via CLI"| CLI
    MCPServer -->|"MCP"| ArtiEngine

    ToolAPI --> ArtiEngine
    MgmtAPI --> CollectionService

    ArtiEngine --> FS
    CollectionService --> PG
    AuthService --> PG
```

---

## 2. Key Design Decisions

### 2.1 Arti Engine — Weave CRDT Storage

All artifact content is stored on the **local filesystem** using a custom **Weave CRDT** (ported from Manyana), not in the database and not in git.

**Why Weave CRDT over Git:**
- Git is designed for human async collaboration; file-level locking breaks under agent concurrency
- Weave is a line-level CRDT — concurrent writes to the same file merge automatically, no CAS retries
- Merge is commutative and deterministic: `merge(A, B) == merge(B, A)`, always
- No external binary dependency (no `git` on the host)

**Architecture layers:**

| Layer | Responsibility |
|-------|---------------|
| `StorageEngine` interface | 12-method abstraction (read, write, edit, rm, ls, grep, glob, log, diff, blame, fileExists, init) |
| `ArtiEngine` | Implements StorageEngine using Weave + CollectionFS |
| `CollectionFS` / `LocalFS` | Pure I/O abstraction (readFile, writeFile, readdir, glob, lock) |
| Weave module | Pure functions — `initialState`, `updateState`, `mergeStates`, `serialize`, `deserialize` |

**Write flow:**

```mermaid
flowchart TD
    A["writeFile(path, content)"] --> B["Check weave exists"]
    B --> C["Lock weave file"]
    C --> D{"Weave exists?"}
    D -->|"No"| E["initialState(lines)"]
    D -->|"Yes"| F["Read old weave state<br/>updateState(old, newLines)"]
    E --> G["Write weave + file + commit"]
    F --> G
    G --> H["Release lock"]
    H --> I["Return { commit, created }"]
```

**Concurrent write strategy:** Per-file locking via weave files. Each file has its own lock, so writes to different files are fully parallel. Writes to the same file are serialized at the weave level — no conflicts, no retries.

**Commit model:** Lightweight JSON commits stored in `.arti/commits/{id}.json` with a linked-list chain via `parent` pointer. HEAD stored in `.arti/refs/HEAD`.

**Filesystem layout:**

```
/data/repos/
  {username}/
    {collection_name}.git/
      .arti/
        weaves/{path}.weave   ← Weave CRDT state per file
        commits/{id}.json     ← Commit chain
        refs/HEAD             ← Current commit pointer
      {user files}            ← Actual file content
```

### 2.2 PostgreSQL for Metadata

Arti Engine handles content only. User, Collection metadata, API keys, access control, and pins are stored in PostgreSQL. Auth is managed by **better-auth** (users, sessions, accounts, verifications).

```mermaid
erDiagram
    users {
        text id PK
        text name
        text username UK
        text email UK
        boolean email_verified
        text image
        timestamp created_at
        timestamp updated_at
    }

    collections {
        text id PK
        text owner_id FK
        text name
        text description
        enum visibility "private | public"
        text git_path
        timestamp created_at
    }

    collection_access {
        text collection_id FK
        text user_id FK
        enum level "read | edit"
        timestamp created_at
    }

    api_keys {
        text id PK
        text user_id FK
        text key_hash
        text label
        timestamp expires_at
        timestamp created_at
    }

    pins {
        text id PK
        text user_id FK
        text collection_id FK
        enum target_type "collection | file | dir"
        text target_path
        int sort_order
        timestamp created_at
    }

    invite_links {
        text id PK
        text collection_id FK
        text created_by FK
        boolean enabled
        timestamp created_at
    }

    users ||--o{ collections : "owns"
    users ||--o{ collection_access : "has access"
    collections ||--o{ collection_access : "shared with"
    users ||--o{ api_keys : "has"
    users ||--o{ pins : "pins"
    collections ||--o{ pins : "pinned in"
    collections ||--o{ invite_links : "has"
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
          collections.ts    ← Collection management API
        services/
          storage.ts        ← StorageEngine interface
          arti/
            engine.ts       ← ArtiEngine (StorageEngine impl)
            weave.ts        ← Weave CRDT (pure functions)
            collection-fs.ts ← CollectionFS / LocalFS
          collection.ts     ← Collection resolution & access check
          template.ts       ← Getting-started template
        mcp/
          server.ts         ← MCP server (all tools via StorageEngine)
        middleware/
          auth.ts           ← API Key / Session auth (better-auth)
        db/
          schema.ts         ← Drizzle schema
    web/                    ← Web frontend (Next.js)
      src/
        app/
          (auth)/           ← Login pages
          (dashboard)/      ← Dashboard, settings, collection browser
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
    participant Arti as Arti Engine

    A->>S: Need to write an artifact
    S->>A: Guide to call arti write
    A->>CLI: echo "content" | arti write nestor/docs/spec.md -m "..."
    CLI->>API: POST /collections/nestor/docs/tools/write
    API->>API: Auth middleware validates API token
    API->>API: Check collection access
    API->>Arti: engine.writeFile(path, content)
    Note over Arti: lock weave → update CRDT → write file + commit → unlock
    Arti-->>API: { commit, created }
    API-->>CLI: { path, commit, created }
    CLI-->>A: Plain text result
```

### 4.2 Web Viewing an Artifact

```mermaid
sequenceDiagram
    participant B as Browser
    participant Next as Next.js SSR
    participant API as API Server

    B->>Next: GET /nestor/docs/spec.md
    Next->>API: POST /collections/nestor/docs/tools/read
    API-->>Next: File content
    Next->>Next: Select Markdown renderer based on .md extension
    Next-->>B: Server-rendered HTML
    B->>B: Client-side hydrate
```

### 4.3 Edit Operation (Precise Replacement)

```mermaid
flowchart TD
    A["POST /tools/edit<br/>old_string + new_string"] --> B["Read current file content"]
    B --> C{"old_string<br/>occurrences?"}
    C -->|"0"| D["404 error<br/>old_string not found"]
    C -->|">1 without replace_all"| E["409 error<br/>report match count"]
    C -->|"1, or replace_all set"| F["Execute string replacement"]
    F --> G["Update weave CRDT → write file + commit"]
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
- Public collection: read operations require no auth
- Private collection: must be owner or have explicit access
- Write operations: must be owner or have "edit" access level
- Admin operations (delete collection, manage access): must be owner

---

## 6. Tech Stack Summary

| Layer | Choice | Rationale |
|----|------|------|
| Monorepo | pnpm + Turborepo | Fast, mature, TypeScript ecosystem standard |
| API Framework | Hono | Lightweight, multi-runtime, TS-first |
| Web Framework | Next.js (App Router) | SSR + React rendering ecosystem |
| Database | PostgreSQL | Metadata storage, mature and reliable |
| ORM | Drizzle | Lightweight, type-safe, good migrations |
| Content Storage | Arti Engine (Weave CRDT) | Line-level CRDT, agent-native concurrency, no git dependency |
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
        FS[("File System<br/>/data/repos")]
    end

    User(("User / Agent")) --> LB
    LB --> API
    LB --> Web
    API --> PG
    API --> FS
    Web -->|"Internal call"| API
```

Start with: `docker compose up`. Three containers (API, Web, PostgreSQL), collection data on a host-mounted volume.

### 7.2 Cloud (Multi-Instance)

The core challenge with multiple instances: collection data lives on disk, multiple API instances can't each hold a copy.

Solution: migrate `CollectionFS` implementation from `LocalFS` (POSIX) to a shared backend (e.g. S3 + PostgreSQL). The `StorageEngine` interface stays the same — only the I/O layer changes.

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

    S3[("S3<br/>weave + file content")]
    PG[("Managed PostgreSQL<br/>metadata + commits")]
    Web["Web App<br/>(Vercel)"]

    User(("User / Agent")) --> CDN
    CDN --> API1 & API2 & API3
    CDN --> Web
    API1 & API2 & API3 --> S3
    API1 & API2 & API3 --> PG
```

**Code-level abstraction:** The API operates collections through a unified `StorageEngine` interface. `ArtiEngine` delegates I/O to `CollectionFS`. Self-hosting uses `LocalFS` (POSIX); Cloud uses an S3-backed implementation. One codebase, two deployment modes.

```typescript
interface StorageEngine {
  readFile(collectionPath: string, filePath: string, opts?: ReadOpts): Promise<FileContent>
  writeFile(collectionPath: string, filePath: string, content: string, opts?: WriteOpts): Promise<Commit>
  editFile(collectionPath: string, filePath: string, edits: EditOp[], opts?: EditOpts): Promise<Commit>
  // ... 12 methods total
}

// CollectionFS — swappable I/O layer
interface CollectionFS {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  readdir(path: string): Promise<DirEntry[]>
  exists(path: string): Promise<boolean>
  glob(pattern: string): Promise<string[]>
  lock(path: string): Promise<() => Promise<void>>
  // ...
}

// Self-hosting
class LocalFS implements CollectionFS { ... }

// Cloud
class S3FS implements CollectionFS { ... }
```

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

- [x] API: Tool API (read, write, edit, rm, grep, glob, ls, log, diff, blame) + Arti Engine (Weave CRDT)
- [x] API: Auth (API Key + better-auth sessions)
- [x] API: Collection management, access control, invite links
- [x] API: MCP server (SSE transport)
- [x] CLI: All commands
- [x] Web: Artifact rendering (Markdown, code, CSV, JSON, YAML, TOML, Mermaid, PlantUML, SVG, HTML, LaTeX)
- [x] Skill: SKILL.md
- [x] Docker Compose self-hosting

### Phase 2 — Full Features

- [ ] API: Comment system (region anchoring + Agent reads via `read`)
- [ ] Web: Version history, source/preview toggle
- [ ] Web: Comment interaction + reference copy (with location info)
- [ ] Real-time updates (WebSocket)

### Phase 3 — Collaboration & Polish

- [ ] Public collection search and discovery
- [ ] Weave merge for multi-device sync

### Phase 4 — Cloud

- [ ] S3-backed CollectionFS
- [ ] Edge deployment
- [ ] CDN + global acceleration
- [ ] Analytics dashboard
- [ ] Billing
