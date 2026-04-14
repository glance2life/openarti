# OpenArti — Specification

> Artifacts that live across agents.

---

## 1. Overview

OpenArti is a shared knowledge base for AI Agents. Content produced by different agents (Claude Chat, Claude Code, Cursor, etc.) — Markdown docs, API specs, Mermaid diagrams, HTML pages — is stored in a unified repository that any agent can read and write, and that humans can browse and render in the browser.

### 1.1 Two-Layer Architecture: Protocol vs Platform

Analogous to the Git ecosystem:

| Git Ecosystem | OpenArti Ecosystem | Role |
|---------|--------------|------|
| **git** (CLI/protocol) | **arti** (CLI + OpenAPI protocol) | Open-source tool defining how artifacts are stored and versioned |
| **GitHub** (hosting platform) | **OpenArti** (openarti.dev) | Hosted service, default remote for arti |
| repo | **repo** | A folder of related files |
| file | **artifact** | A text file |

- **arti** is the open-source CLI and API protocol. It defines how artifacts are stored and versioned.
- **OpenArti** is the official hosted platform, the default remote for arti — just as GitHub is the default remote for git.

### 1.2 Project Model

**Supabase model: full-stack open source + official Cloud**

Artifact content (product specs, API docs, technical designs) is core enterprise IP, not personal notes. Enterprises need to see the code and self-host before trusting a platform with these assets. Full-stack open source lowers the trust barrier.

**Everything is open source** (single monorepo):
- arti CLI
- OpenAPI protocol spec
- API server
- Web frontend + rendering engine
- Skill definition
- Docker one-click deployment

**OpenArti Cloud value-add** (why pay instead of self-hosting):
- Zero ops: no database, backup, or upgrade management
- Global CDN + edge rendering
- High availability + auto-scaling
- Enterprise SLA + support
- Advanced features (analytics dashboard, audit logs, SSO/SAML, etc.)

Strategy: focus on the product early, share the same codebase for Cloud and self-hosting. Self-hosting via Docker Compose is one command — no extra maintenance cost.

---

## 2. Core Concepts

### 2.1 Team

Account = Team. Every account is a Team with the creator as the sole initial member. Invite others when collaboration is needed. No distinction between "personal" and "team" accounts.

```
Team {
  name:        string       // Globally unique, used as URL namespace
  description: string
  members:     Member[]     // At least one owner (creator)
  created_at:  datetime
  updated_at:  datetime
}

Member {
  user:        string       // User email or ID
  role:        "owner" | "member"   // owner manages team, member reads/writes repos
}
```

URL format: `openarti.dev/:team`

### 2.2 Repo

A folder. Holds a set of related artifact files. Belongs to a Team.

```
Repo {
  owner:       string       // Owning Team name
  name:        string       // Repo name, unique within Team
  description: string
  visibility:  "private" | "public"
  created_at:  datetime
  updated_at:  datetime
}
```

URL format: `openarti.dev/:team/:repo`

- **private**: accessible only to Team members
- **public**: fully public, discoverable via search

### 2.3 Artifact

A text file. The smallest unit within a Repo.

**Filename is the identifier**, extension is the type:

```
nestor/                            ← team
  feature-x/                      ← repo
    product-spec.md              ← Markdown artifact
    api-design.yaml              ← OpenAPI artifact
    sequence.mermaid             ← Mermaid artifact
    auth-flow.svg                ← SVG artifact
    prototype.html               ← HTML artifact
    dashboard.jsx                ← React artifact
    config.json                  ← JSON artifact
    notes.txt                    ← Plain text artifact
```

File content is plain text.

### 2.4 List

A cross-Team reference list of Repos. Pure aggregation — which Repos you can see in a List depends on your permissions in those Teams (or whether the Repo is public).

```
List {
  owner:       string       // Owning Team
  name:        string
  description: string
  repos:       string[]     // "team/repo" reference list
  created_at:  datetime
  updated_at:  datetime
}
```

Use case: aggregate Repos across multiple Teams to give an Agent a cross-Team search scope.

### 2.5 Comment

Comments are anchored to specific content regions of an Artifact. Comments live at the Repo level, outside git version history — they're discussions about content, not content itself.

```
Comment {
  repo:        string       // Owning Repo
  path:        string       // Associated artifact filename
  anchor:      Anchor       // Associated content region
  body:        string       // Comment body (Markdown)
  author:      string       // Commenter (User ID)
  resolved:    boolean      // Whether resolved
  created_at:  datetime
  updated_at:  datetime
}

Anchor {
  // Source mode positioning
  start_line:  number       // Start line number
  end_line:    number       // End line number
  // Content snapshot (for re-locating after file changes)
  context:     string       // Text snapshot of anchored region
}
```

- Agents can fetch comments when reading a file (`read` with `include_comments` option)
- Comments can be marked as resolved; agents only see unresolved comments
- After file changes, the system uses the `context` snapshot to re-locate the comment; if re-location fails, the comment is marked as orphaned

### 2.6 Reference (Citation Text)

A reference is a copy format, not a data model. When a user selects content in the Web UI and copies, the result includes location info so an Agent can navigate to the source:

```
[nestor/feature-x/product-spec.md:12-18](https://openarti.dev/nestor/feature-x/product-spec.md#L12-L18)
> Selected content excerpt...
```

An Agent receiving this text can use the `read` API with `offset`/`limit` to fetch the latest content at that location.

### 2.7 User

```
User {
  email:       string       // Login credential
  name:        string       // Display name
  avatar_url:  string
  created_at:  datetime
}
```

A User is a login identity. One User can be a member of multiple Teams.

---

## 3. User Capabilities

Users interact with OpenArti through four channels:

| Channel | Primary Users | Core Scenarios |
|---------|---------|---------|
| **Web** | Everyone | Browse, render, comment, manage |
| **Agent Skill** | AI Agents | Read/write knowledge base within agent conversations |
| **arti CLI** | Agents / Developers | Execution layer for the Skill; also usable by humans |
| **REST API** | Developers / Integrators | Programmatic access to all features |

---

### 3.1 Web

URL structure:

```
openarti.dev/:team                        → Team home
openarti.dev/:team/:repo                  → Repo home (file list)
openarti.dev/:team/:repo/:filename        → Artifact render page
```

#### Rendering

Each artifact type has a corresponding renderer, automatically selected by extension:

| Extension | Rendering |
|--------|---------|
| `.md` | Markdown (GFM) |
| `.html` | iframe sandbox |
| `.jsx` / `.tsx` | Sandboxed React runtime |
| `.mermaid` | Mermaid.js |
| `.svg` | Direct rendering |
| `.yaml` / `.yml` | If OpenAPI spec → Scalar; otherwise syntax highlighting |
| `.json` | JSON viewer |
| `.txt` | Monospace font |
| Other | Monospace + syntax highlighting (language inferred from extension) |

The rendering engine is extensible — new artifact types only need a registered renderer.

All artifacts support switching between **source mode** and **preview mode**.

#### Interaction

In either mode, users can select a region and:

1. **Add a comment** — anchored to the selected content region. Agents can fetch these comments when reading the artifact.
2. **Copy reference text** — the copied text includes location info so an Agent can navigate to the exact position.

#### Real-time Updates

When content is modified through any channel (Agent, CLI, API), the Web UI updates in real-time without refresh.

#### Repo Management

- Create / delete Repos
- Set visibility (private / public)
- Manage Team members
- Manage Lists

#### Version History

- View full change history for any file
- Compare any two versions
- View line-by-line authorship (who wrote it, which Agent)
- One-click rollback to any historical version

---

### 3.2 Agent Skill

OpenArti provides an Agent Skill (following the agentskills.io open standard) as the primary Agent integration method. Published on skills.sh, installed uniformly across all platforms.

#### Installation

```bash
npx skills add openarti/openarti@openarti
```

#### Supported Platforms

| Platform | Integration |
|------|---------|
| Claude Code | Via `arti` CLI |
| Cursor | Via `arti` CLI |
| Codex CLI | Via `arti` CLI |
| GitHub Copilot | Via `arti` CLI |
| Gemini CLI | Via `arti` CLI |

#### What Agents Can Do

After installing the Skill, agents can operate on remote Repos like local files:

- **Read files** — read any artifact's content, with pagination and historical version support
- **Write files** — create new artifacts or overwrite existing ones
- **Precise editing** — replace specific text segments without rewriting the entire file
- **Search content** — regex search across all files with file type filtering
- **Find files** — glob pattern matching for filenames
- **List directory** — browse Repo file structure
- **View history** — view change logs, compare diffs, view per-line authorship
- **Delete files** — remove artifacts no longer needed

Every write and edit automatically records a version with full history.

---

### 3.3 arti CLI

`arti` is an npm package installed via `npm install -g openarti`. It is the execution layer for the Skill — the Skill tells the Agent what to do, arti handles how. Developers can also use it directly in the terminal.

Authentication via environment variable `OPENARTI_TOKEN` or `--token` flag.

#### Command Reference

```bash
# File operations
arti read <owner>/<repo>/<path> [--offset N] [--limit N] [--ref <commit>]
echo "content" | arti write <owner>/<repo>/<path> [-m "..."]
arti edit <owner>/<repo>/<path> --old "..." --new "..." [--replace-all] [-m "..."]
arti rm <owner>/<repo>/<path> [-m "..."]

# Search and discovery
arti grep <pattern> <owner>/<repo> [--glob "*.md"] [-C N] [-i]
arti glob <pattern> <owner>/<repo>
arti ls <owner>/<repo> [<path>]

# Version history
arti log <owner>/<repo> [<path>] [--limit N]
arti diff <owner>/<repo> [<path>] [--from <commit>] [--to <commit>]
arti blame <owner>/<repo>/<path>

# Repo management
arti repo create <team/name> [--visibility ...] [--description "..."]
arti repo list <team>
```

#### Output Format

All commands output plain text, agent-context-friendly:

- `read` — plain text content
- `grep` — matching lines with context (`file:line:text` format)
- `glob` / `ls` — file path list (directories have trailing `/`)
- `log` — commit list (hash, date, author, message)
- `diff` — standard unified diff
- `blame` — hash, author, date, line number, content
- Exit code: 0 success, 1 error

---

### 3.4 REST API

Base URL: `https://api.openarti.dev`

#### Authentication

```
Authorization: Bearer oai_xxxxxxxxxxxxxxxx
```

API token is bound to a user. Read operations on `public` Repos do not require authentication.

#### Tool API (Core Agent Operations)

All tool operations use POST with JSON request/response. Path prefix: `/repos/:owner/:repo/tools`

| Tool | Capability |
|---|---|
| `read` | Read file, supports offset/limit, supports historical versions |
| `write` | Create/overwrite file |
| `edit` | Precise string replacement without rewriting the entire file |
| `grep` | Regex search file content with context lines |
| `glob` | Glob pattern matching for filenames |
| `ls` | List directory content |
| `log` | View file/Repo change history |
| `diff` | Compare any two versions |
| `blame` | View per-line authorship and source commit |

---

##### `read` — Read a file

```
POST /repos/nestor/feature-x/tools/read

{
  "path": "product-spec.md",
  "offset": 1,            // Optional, start line (1-based)
  "limit": 200,           // Optional, number of lines
  "ref": "abc1234",       // Optional, commit id (read historical version)
  "include_comments": true // Optional, include comments (default false)
}
```

Response:

```json
{
  "path": "product-spec.md",
  "content": "     1\t# Feature X Product Spec\n     2\t\n     3\t## Background\n...",
  "lines": 42,
  "commit": "abc1234def5678",
  "comments": [
    {
      "id": "cmt_xxx",
      "anchor": { "start_line": 12, "end_line": 14, "context": "## Auth Design\n\nUsing session cookie" },
      "body": "Should switch to JWT — session cookies don't meet compliance requirements",
      "author": "nestor",
      "resolved": false,
      "created_at": "2026-03-17T12:00:00Z"
    }
  ]
}
```

- Content includes line number prefixes (`cat -n` format) for agents to reference line numbers in subsequent edits
- Without offset/limit, returns full content (configurable upper limit, e.g. 2000 lines)
- Without ref, returns the latest version
- When `include_comments` is true, returns unresolved comments on the file (with anchor info and comment body)

---

##### `write` — Create or overwrite a file

```
POST /repos/nestor/feature-x/tools/write

{
  "path": "product-spec.md",
  "content": "# Feature X Product Spec\n\n## Background\n...",
  "message": "initial version"         // Optional, commit message
}
```

Response:

```json
{
  "path": "product-spec.md",
  "commit": "def4567abc8901",
  "created": true
}
```

- File doesn't exist → create (`created: true`); exists → overwrite (`created: false`)
- Every write automatically records a version

---

##### `edit` — Precise string replacement

**The most important agent operation** — replace specific text without rewriting the entire file.

```
POST /repos/nestor/feature-x/tools/edit

{
  "path": "product-spec.md",
  "old_string": "## Auth Design\n\nUsing session cookie",
  "new_string": "## Auth Design\n\nUsing JWT token",
  "message": "switch auth from cookie to JWT"
}
```

Response:

```json
{
  "path": "product-spec.md",
  "commit": "789abc0123def",
  "replaced": 1
}
```

Bulk replacement:

```json
{
  "path": "product-spec.md",
  "old_string": "v1",
  "new_string": "v2",
  "replace_all": true,
  "message": "bump version v1 → v2"
}
```

Multiple edits in a single request:

```json
{
  "path": "product-spec.md",
  "edits": [
    { "old_string": "foo", "new_string": "bar" },
    { "old_string": "baz", "new_string": "qux" }
  ],
  "message": "batch update"
}
```

Error handling:
- `old_string` not found → error
- `old_string` matches multiple locations without `replace_all` → error with match count

---

##### `grep` — Regex search file content

```
POST /repos/nestor/feature-x/tools/grep

{
  "pattern": "auth.*design",        // Regular expression
  "glob": "*.md",                   // Optional, filename filter
  "output_mode": "content",         // "content" | "files_with_matches" (default) | "count"
  "context": 2,                     // Optional, context lines around matches
  "ignore_case": true               // Optional, case-insensitive
}
```

Response (`output_mode: "content"`):

```json
{
  "matches": [
    {
      "path": "product-spec.md",
      "lines": [
        { "line": 40, "text": "  preceding context line..." },
        { "line": 41, "text": "  preceding context line..." },
        { "line": 42, "text": "## Auth Design", "match": true },
        { "line": 43, "text": "  following context line..." },
        { "line": 44, "text": "  following context line..." }
      ]
    }
  ],
  "total_matches": 1
}
```

Response (`output_mode: "files_with_matches"`):

```json
{
  "files": ["product-spec.md", "api-design.yaml"],
  "total_matches": 3
}
```

---

##### `glob` — Find files by pattern

```
POST /repos/nestor/feature-x/tools/glob

{
  "pattern": "**/*.md"
}
```

Response:

```json
{
  "files": [
    { "path": "product-spec.md" },
    { "path": "docs/design.md" }
  ]
}
```

---

##### `ls` — List directory content

```
POST /repos/nestor/feature-x/tools/ls

{
  "path": "/"                   // Optional, defaults to root
}
```

Response:

```json
{
  "entries": [
    { "name": "product-spec.md", "type": "file" },
    { "name": "api-design.yaml", "type": "file" },
    { "name": "docs/", "type": "dir" }
  ]
}
```

---

##### `log` — View change history

```
POST /repos/nestor/feature-x/tools/log

{
  "path": "product-spec.md",   // Optional, omit for full Repo history
  "limit": 20                  // Optional, default 20
}
```

Response:

```json
{
  "commits": [
    {
      "hash": "abc1234",
      "message": "switch auth from cookie to JWT",
      "author": "claude-code",
      "timestamp": "2026-03-17T11:00:00Z",
      "files": ["product-spec.md"]
    },
    {
      "hash": "def5678",
      "message": "initial version",
      "author": "claude-chat",
      "timestamp": "2026-03-17T10:05:00Z",
      "files": ["product-spec.md"]
    }
  ]
}
```

---

##### `diff` — Compare two versions

```
POST /repos/nestor/feature-x/tools/diff

{
  "path": "product-spec.md",   // Optional, omit for full Repo diff
  "from": "def5678",           // Start commit (optional, defaults to previous version)
  "to": "abc1234"              // Target commit (optional, defaults to latest)
}
```

Response:

```json
{
  "path": "product-spec.md",
  "diff": "--- a/product-spec.md\n+++ b/product-spec.md\n@@ -12,3 +12,3 @@\n ## Auth Design\n \n-Using session cookie\n+Using JWT token",
  "stats": { "additions": 1, "deletions": 1 }
}
```

---

##### `blame` — View per-line authorship

Especially useful in multi-Agent collaboration — know which Agent/user wrote each line.

```
POST /repos/nestor/feature-x/tools/blame

{
  "path": "product-spec.md"
}
```

Response:

```json
{
  "path": "product-spec.md",
  "lines": [
    { "line": 1, "text": "# Feature X Product Spec", "author": "claude-chat", "commit": "def5678", "timestamp": "2026-03-17T10:05:00Z" },
    { "line": 2, "text": "", "author": "claude-chat", "commit": "def5678", "timestamp": "2026-03-17T10:05:00Z" },
    { "line": 3, "text": "## Auth Design", "author": "claude-chat", "commit": "def5678", "timestamp": "2026-03-17T10:05:00Z" },
    { "line": 4, "text": "Using JWT token", "author": "claude-code", "commit": "abc1234", "timestamp": "2026-03-17T11:00:00Z" }
  ]
}
```

---

#### Management API

Team, Repo, and List management uses REST style. These APIs serve the Web frontend, CLI management commands, and third-party integrations.

##### User

```
GET    /user                        # Current user info
```

##### Team

```
POST   /teams                       # Create Team
GET    /teams                       # List my Teams
GET    /teams/:team                 # Team details
PATCH  /teams/:team                 # Update Team
DELETE /teams/:team                 # Delete Team
POST   /teams/:team/members         # Invite member
DELETE /teams/:team/members/:user   # Remove member
```

##### Repo

```
POST   /repos/:team                 # Create Repo under Team
GET    /repos/:team                 # List Repos under Team
GET    /repos/:team/:repo           # Repo details
PATCH  /repos/:team/:repo           # Update Repo
DELETE /repos/:team/:repo           # Delete Repo
```

##### Version Operations

```
POST   /repos/:owner/:repo/rollback     # Rollback file to a specific version
```

```json
{
  "path": "product-spec.md",
  "to": "def5678",
  "message": "rollback to initial version"
}
```

Rollback = retrieve target version's content → create a new version. History is never deleted.

##### Comment

```
POST   /repos/:owner/:repo/comments                    # Create comment (anchored to file region)
GET    /repos/:owner/:repo/comments                    # List Repo comments (filterable by path)
GET    /repos/:owner/:repo/comments/:id                # Comment details
PATCH  /repos/:owner/:repo/comments/:id                # Update comment (edit or mark resolved)
DELETE /repos/:owner/:repo/comments/:id                # Delete comment
```

Create comment:

```json
{
  "path": "product-spec.md",
  "anchor": {
    "start_line": 12,
    "end_line": 14,
    "context": "## Auth Design\n\nUsing session cookie"
  },
  "body": "Should switch to JWT"
}
```

List comments with filters:

```
GET /repos/nestor/feature-x/comments?path=product-spec.md&resolved=false
```

##### List

```
POST   /lists                                        # Create List
GET    /lists                                        # List my Lists
GET    /lists/:team/:name                            # List details
PATCH  /lists/:team/:name                            # Update List
DELETE /lists/:team/:name                            # Delete List
POST   /lists/:team/:name/repos                      # Add Repo reference
DELETE /lists/:team/:name/repos/:repo                # Remove Repo reference
```

#### WebSocket (Real-time Updates)

```
ws://api.openarti.dev/ws/:owner/:repo
```

```json
{ "event": "file.updated", "path": "product-spec.md", "commit": "abc1234", "author": "claude-code" }
{ "event": "file.created", "path": "new-doc.md", "commit": "def5678", "author": "claude-chat" }
{ "event": "file.deleted", "path": "old-doc.md", "commit": "ghi9012", "author": "nestor" }
```

#### Error Format

```json
{
  "error": {
    "code": "not_found",
    "message": "File 'product-spec.md' not found in repo 'nestor/feature-x'"
  }
}
```

| HTTP Status | Code |
|-------------|------|
| 400 | `bad_request` |
| 401 | `unauthorized` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict` (edit: old_string matches multiple locations) |
| 422 | `validation_error` |
| 429 | `rate_limited` |
| 500 | `internal_error` |
