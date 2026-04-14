import path from "node:path";
import { engine } from "./storage.js";

/**
 * Template files for the "getting-started" collection created for every new user.
 * Key = file path inside the collection, value = file content.
 */
const TEMPLATE_FILES: Record<string, string> = {
  // ──────────────────────────────────────────────
  // 1. README — Entry point & quick tour
  // ──────────────────────────────────────────────
  "README.md": `# Welcome to OpenArti

OpenArti is a **versioned knowledge base** that you and your AI agents can read and write together. This collection is your guided tour — click any file on the left to explore.

## Quick start

1. **Try editing** — open \`playground/scratch.md\` and type anything. Your changes are saved as a new version automatically.
2. **See rich previews** — browse the \`samples/\` folder. OpenArti renders Markdown, CSV, JSON, YAML, TOML, Mermaid, PlantUML, SVG, HTML, and LaTeX — not just plain text.
3. **Connect your AI** — read \`guides/connect-ai-agents.md\` to let Claude, Cursor, or any MCP client read & write your artifacts directly.
4. **Use the API** — read \`guides/api-quickstart.md\` to start calling the REST API with an API key.

## Core concepts

| Concept | What it means |
|---------|---------------|
| **Collection** | A versioned folder of files. You're inside one right now. |
| **Artifact** | Any file in a collection. Every write creates a new version. |
| **Rich preview** | OpenArti auto-detects file types and renders them visually — tables, diagrams, math, etc. |
| **MCP** | [Model Context Protocol](https://modelcontextprotocol.io) — lets AI agents access your artifacts natively. |

## What's in this collection

| Folder | Purpose |
|--------|---------|
| \`guides/\` | Step-by-step guides to help you get the most out of OpenArti |
| \`samples/\` | Example files in every supported format — see what OpenArti can render |
| \`playground/\` | Your scratch space — experiment freely here |

> **Tip:** This collection is entirely yours. Edit, rename, or delete anything — or delete the whole collection from Settings.
`,

  // ──────────────────────────────────────────────
  // 2. Guides — onboarding journey
  // ──────────────────────────────────────────────
  "guides/how-it-works.md": `# How OpenArti Works

## Every file is versioned

When you write or edit a file, OpenArti saves it as a **new version**. This means you can:

- **Browse history** — see every change, who made it, and when
- **View diffs** — compare any two versions side by side
- **Blame lines** — trace each line to the version that introduced it

You never lose work. Every version is preserved.

## Architecture at a glance

\`\`\`mermaid
graph TB
    subgraph Clients
        Web[Web App]
        CLI[CLI Tool]
        MCP[AI Agents<br/>Claude · Cursor · etc.]
    end

    subgraph Server["API Server"]
        REST[REST API]
        MCPServer[MCP Server]
        Engine[Arti Engine]
    end

    subgraph Storage
        PG[(PostgreSQL)]
        Disk[(File System)]
    end

    Web --> REST
    CLI --> REST
    MCP --> MCPServer
    REST --> Engine
    MCPServer --> Engine
    Engine --> Disk
    REST --> PG
\`\`\`

## Three ways to access your artifacts

| Method | Best for | How |
|--------|----------|-----|
| **Web UI** | Browsing, reading, quick edits | You're using it right now |
| **REST API** | Scripts, CI/CD, programmatic access | See \`guides/api-quickstart.md\` |
| **MCP** | AI agents (Claude, Cursor, etc.) | See \`guides/connect-ai-agents.md\` |

All three methods access the same underlying data — a write via API shows up instantly in the web UI, and vice versa.
`,

  "guides/connect-ai-agents.md": `# Connect AI Agents

OpenArti speaks [MCP](https://modelcontextprotocol.io) (Model Context Protocol) natively. This means AI assistants can read and write your artifacts directly — no copy-pasting.

## Supported clients

| Client | Status |
|--------|--------|
| Claude Desktop | Supported |
| Claude Code | Supported |
| Cursor | Supported |
| Any MCP-compatible client | Supported |

## Setup

### 1. Create an API key

Go to **Settings > API Keys** and create a new key. Copy it — you'll need it next.

### 2. Configure your client

Add the following MCP server configuration to your client:

\`\`\`json
{
  "mcpServers": {
    "openarti": {
      "url": "https://api.openarti.dev/mcp",
      "headers": {
        "Authorization": "Bearer oai_your_key_here"
      }
    }
  }
}
\`\`\`

### 3. Start using it

Once connected, your AI agent can:

- **Read** any file from your collections
- **Write** new files or update existing ones
- **Search** across files with grep and glob
- **Browse history** with log, diff, and blame

### Example conversation

> **You:** Read the file \`guides/api-quickstart.md\` from my getting-started collection.
>
> **Claude:** *(reads the file via MCP and responds with its contents)*
>
> **You:** Add a new section about rate limiting at the end.
>
> **Claude:** *(writes the updated file — a new version is created automatically)*
`,

  "guides/api-quickstart.md": `# API Quick Start

The REST API lets you read and write artifacts programmatically.

## 1. Get your API key

Go to **Settings > API Keys** and create one. All requests require it:

\`\`\`bash
curl -H "Authorization: Bearer oai_your_key_here" \\
  https://api.openarti.dev/collections
\`\`\`

## 2. Core operations

All file operations use the \`/tools/\` namespace on a collection:

| Operation | Endpoint | What it does |
|-----------|----------|--------------|
| \`read\` | \`POST /collections/:owner/:name/tools/read\` | Read a file |
| \`write\` | \`POST /collections/:owner/:name/tools/write\` | Create or overwrite a file |
| \`edit\` | \`POST /collections/:owner/:name/tools/edit\` | Patch part of a file |
| \`rm\` | \`POST /collections/:owner/:name/tools/rm\` | Delete a file |
| \`ls\` | \`POST /collections/:owner/:name/tools/ls\` | List files |
| \`grep\` | \`POST /collections/:owner/:name/tools/grep\` | Search file contents |
| \`glob\` | \`POST /collections/:owner/:name/tools/glob\` | Search file names |
| \`log\` | \`POST /collections/:owner/:name/tools/log\` | View version history |
| \`diff\` | \`POST /collections/:owner/:name/tools/diff\` | Compare versions |
| \`blame\` | \`POST /collections/:owner/:name/tools/blame\` | Line-level attribution |

## 3. Example: write a file

\`\`\`bash
curl -X POST https://api.openarti.dev/collections/nestor/my-docs/tools/write \\
  -H "Authorization: Bearer oai_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "path": "notes/hello.md",
    "content": "# Hello World\\n\\nMy first artifact.",
    "message": "add hello note"
  }'
\`\`\`

## 4. Example: search across files

\`\`\`bash
curl -X POST https://api.openarti.dev/collections/nestor/my-docs/tools/grep \\
  -H "Authorization: Bearer oai_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "pattern": "TODO",
    "glob": "*.md",
    "ignore_case": true
  }'
\`\`\`
`,

  "guides/supported-formats.md": `# Supported File Formats

OpenArti auto-detects file types and renders them with rich previews. Check out the \`samples/\` folder to see each one in action.

## Rich preview formats

| Format | Extensions | Preview |
|--------|-----------|---------|
| Markdown | \`.md\` \`.mdx\` | Full rendering with headings, tables, code blocks, math, Mermaid diagrams |
| CSV / TSV | \`.csv\` \`.tsv\` | Interactive sortable table |
| JSON | \`.json\` | Collapsible tree view |
| YAML | \`.yaml\` \`.yml\` | Collapsible tree view |
| TOML | \`.toml\` | Collapsible tree view |
| Mermaid | \`.mmd\` \`.mermaid\` | Rendered diagram (flowcharts, sequence, class, etc.) |
| PlantUML | \`.puml\` \`.plantuml\` | Rendered UML diagram |
| SVG | \`.svg\` | Inline rendered image |
| HTML | \`.html\` \`.htm\` | Sandboxed page preview |
| LaTeX | \`.tex\` | Rendered math equations (KaTeX) |
| OpenAPI | (auto-detected) | Interactive API documentation |

## Code files

All other file types (\`.js\`, \`.py\`, \`.go\`, \`.rs\`, \`.sql\`, etc.) are displayed with **syntax highlighting**. OpenArti supports 40+ languages.

## Try it yourself

Browse the \`samples/\` folder in this collection — there's one example for every rich preview format listed above.
`,

  // ──────────────────────────────────────────────
  // 3. Samples — one per rich-preview format
  // ──────────────────────────────────────────────
  "samples/dashboard.csv": `Month,Active Users,API Calls,Avg Response (ms),MCP Sessions,Uptime %
Jan 2025,89,48200,45,312,99.95
Feb 2025,104,56800,42,487,99.97
Mar 2025,127,71300,38,623,99.99
Apr 2025,151,89400,36,891,99.98
May 2025,183,102000,34,1204,99.99
Jun 2025,210,118500,32,1567,99.97
`,

  "samples/config.yaml": `# Application configuration
# Try clicking the arrows to expand/collapse sections.

app:
  name: openarti
  version: 0.1.0
  environment: production

server:
  host: 0.0.0.0
  port: 3000
  cors:
    origins:
      - https://app.openarti.dev
      - http://localhost:3001
    credentials: true

database:
  provider: postgresql
  pool:
    min: 2
    max: 10
    idle_timeout: 30s

storage:
  driver: filesystem
  base_path: ./data/repos
  max_file_size: 10MB

features:
  mcp_server: true
  api_keys: true
  collaboration: true
  version_history: true
`,

  "samples/design-tokens.json": `{
  "brand": "OpenArti",
  "colors": {
    "primary": {
      "hex": "#b05e27",
      "oklch": "oklch(0.617 0.138 39.04)",
      "usage": "Buttons, links, active states"
    },
    "background": {
      "light": "#faf6ee",
      "dark": "#3a3733"
    },
    "foreground": {
      "light": "#4d4535",
      "dark": "#c9b88e"
    },
    "muted": {
      "light": "#ebe3d0",
      "dark": "#302d28"
    },
    "accent": {
      "light": "#e8dfca",
      "dark": "#2f2a1e"
    }
  },
  "typography": {
    "sans": "Satoshi",
    "serif": "Lora",
    "mono": "ui-monospace, SFMono-Regular, Menlo, monospace"
  },
  "radii": {
    "sm": "0.3rem",
    "md": "0.4rem",
    "lg": "0.5rem",
    "xl": "0.7rem"
  },
  "spacing": {
    "unit": "0.25rem",
    "scale": [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24]
  }
}
`,

  "samples/architecture.mmd": `graph TB
    subgraph Clients
        Web([Web App<br/>Next.js])
        CLI([CLI Tool])
        MCP([AI Agents<br/>Claude · Cursor])
    end

    subgraph API["API Server — Hono"]
        Auth[Auth Layer<br/>better-auth]
        REST[REST Routes]
        MCPServer[MCP Server<br/>SSE Transport]
        Engine[Arti Engine<br/>commits + weaves]
    end

    subgraph Storage
        PG[(PostgreSQL<br/>metadata)]
        Disk[(File System<br/>collection dirs)]
    end

    Web --> REST
    CLI --> REST
    MCP --> MCPServer
    REST --> Auth
    MCPServer --> Auth
    REST --> Engine
    MCPServer --> Engine
    Engine --> Disk
    Auth --> PG
    REST --> PG
`,

  "samples/data-model.puml": `@startuml
skinparam backgroundColor transparent
skinparam shadowing false

package "Core" {
  class Collection {
    +id: string
    +name: string
    +visibility: "public" | "private"
    +createdAt: Date
    --
    +addFile(path, content): void
    +getFile(path): File
    +listFiles(glob?): File[]
  }

  class File {
    +path: string
    +content: string
    +size: number
    --
    +read(): string
    +write(content): Commit
    +history(): Commit[]
  }

  class Commit {
    +sha: string
    +message: string
    +author: string
    +timestamp: Date
  }
}

package "Auth" {
  class User {
    +id: string
    +username: string
    +email: string
    --
    +collections(): Collection[]
    +apiKeys(): ApiKey[]
  }

  class ApiKey {
    +id: string
    +keyHint: string
    +expiresAt: Date
    --
    +verify(token): boolean
  }
}

User "1" --> "*" Collection : owns
User "1" --> "*" ApiKey : manages
Collection "1" --> "*" File : contains
File "1" --> "*" Commit : versioned by
@enduml
`,

  "samples/logo.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c97a3a"/>
      <stop offset="100%" stop-color="#8b4513"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="40" fill="url(#bg)"/>
  <g transform="translate(100,100)">
    <rect x="-45" y="-50" width="90" height="100" rx="6" fill="none" stroke="#fff" stroke-width="5"/>
    <line x1="-10" y1="-50" x2="-10" y2="50" stroke="#fff" stroke-width="3"/>
    <line x1="2" y1="-30" x2="32" y2="-30" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <line x1="2" y1="-15" x2="28" y2="-15" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <line x1="2" y1="0" x2="35" y2="0" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <line x1="2" y1="15" x2="22" y2="15" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
    <circle cx="38" cy="-45" r="8" fill="#ffd700" opacity="0.9"/>
    <circle cx="38" cy="-45" r="4" fill="#fff"/>
  </g>
</svg>
`,

  "samples/widget.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenArti Widget Preview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; color: #3a3530; background: #faf6ee; }
    .hero {
      max-width: 640px; margin: 0 auto; padding: 80px 24px; text-align: center;
    }
    h1 { font-size: 2.2rem; font-weight: 700; margin-bottom: 16px; }
    h1 span { color: #b05e27; }
    p.subtitle {
      font-size: 1.1rem; color: #7a7060; line-height: 1.6; margin-bottom: 40px;
    }
    .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: left; }
    .card {
      background: #fff; border: 1px solid #e8dfca; border-radius: 12px; padding: 20px;
    }
    .card h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 6px; }
    .card p { font-size: 0.85rem; color: #7a7060; line-height: 1.5; }
    .badge {
      display: inline-block; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em;
      padding: 3px 8px; border-radius: 6px; margin-bottom: 10px;
      background: #f3ead8; color: #b05e27;
    }
  </style>
</head>
<body>
  <section class="hero">
    <h1>Welcome to <span>OpenArti</span></h1>
    <p class="subtitle">
      A versioned knowledge base that your AI agents can read and write.
      Store docs, configs, and data — accessible via REST API and MCP.
    </p>
    <div class="cards">
      <div class="card">
        <span class="badge">VERSION CONTROL</span>
        <h3>Every edit is a commit</h3>
        <p>Built on Git. Browse history, diff changes, and blame lines — all through the API.</p>
      </div>
      <div class="card">
        <span class="badge">MCP NATIVE</span>
        <h3>AI-agent ready</h3>
        <p>Claude, Cursor, and other MCP clients can read and write your artifacts directly.</p>
      </div>
      <div class="card">
        <span class="badge">RICH PREVIEW</span>
        <h3>Not just plain text</h3>
        <p>Markdown, CSV, JSON, YAML, Mermaid, SVG, LaTeX — all rendered beautifully.</p>
      </div>
      <div class="card">
        <span class="badge">COLLABORATE</span>
        <h3>Share with your team</h3>
        <p>Invite collaborators with read or edit access. Generate API keys for programmatic use.</p>
      </div>
    </div>
  </section>
</body>
</html>
`,

  "samples/deploy.toml": `# Deployment descriptor
# TOML is great for structured config — OpenArti renders it as a tree view.

[app]
name = "openarti"
region = "us-east-1"
instances = 2

[app.scaling]
min_instances = 1
max_instances = 8
target_cpu = 70
cooldown_seconds = 120

[build]
builder = "docker"
dockerfile = "Dockerfile"

[build.args]
NODE_ENV = "production"
NEXT_TELEMETRY_DISABLED = "1"

[database]
provider = "neon"
pool_size = 10

[[services]]
name = "web"
port = 3001
health_check = "/api/health"

[[services]]
name = "api"
port = 3000
health_check = "/health"

[logging]
level = "info"
format = "json"
`,

  "samples/equations.tex": `% LaTeX math — rendered with KaTeX.

% Quadratic formula
The solutions to $ax^2 + bx + c = 0$:

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

% Euler's identity
$$
e^{i\\pi} + 1 = 0
$$

% Matrix multiplication
$$
\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}
\\begin{bmatrix} x \\\\ y \\end{bmatrix}
=
\\begin{bmatrix} ax + by \\\\ cx + dy \\end{bmatrix}
$$

% Bayes' theorem
$$
P(A \\mid B) = \\frac{P(B \\mid A)\\, P(A)}{P(B)}
$$

% Gaussian integral
$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\, dx = \\sqrt{\\pi}
$$

% Cross-entropy gradient
For softmax output $\\hat{y}_i$ and one-hot target $y_i$:

$$
\\frac{\\partial \\mathcal{L}}{\\partial z_i} = \\hat{y}_i - y_i
$$
`,

  // ──────────────────────────────────────────────
  // 4. Playground — user's scratch space
  // ──────────────────────────────────────────────
  "playground/scratch.md": `# Scratch Pad

Write anything here. This is your space to experiment.

---

Try editing this file — your changes are saved as a new version automatically.
`,
};

import os from "node:os";
const STORAGE_DIR = (process.env.STORAGE_DIR || path.join(os.homedir(), ".openarti", "storage")).replace(/^~/, os.homedir());

/**
 * Create and populate the "getting-started" collection for a new user.
 * Returns the storagePath for the created collection, or null if creation failed.
 */
export async function createGettingStartedCollection(
  username: string,
): Promise<string | null> {
  const collectionName = "getting-started";
  const storagePath = path.resolve(STORAGE_DIR, username, collectionName);

  await engine.init(storagePath);

  const author = "OpenArti <hello@openarti.dev>";
  for (const [filePath, content] of Object.entries(TEMPLATE_FILES)) {
    await engine.writeFile(storagePath, filePath, content, {
      message: `add ${filePath}`,
      author,
    });
  }

  return storagePath;
}

export { TEMPLATE_FILES };
