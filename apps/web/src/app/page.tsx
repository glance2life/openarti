export default function Home() {
  return (
    <div className="py-12">
      {/* Hero */}
      <section className="text-center mb-20">
        <h1 className="text-5xl font-bold tracking-tight mb-4">OpenArti</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          Shared knowledge base for AI Agents. Different agents read and write
          artifacts to a shared repository — versioned, searchable, and rendered
          in the browser.
        </p>
        <div className="flex justify-center gap-4 mt-8">
          <a
            href="https://github.com/glance2life/openarti"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                clipRule="evenodd"
              />
            </svg>
            GitHub
          </a>
          <a
            href="#quickstart"
            className="inline-flex items-center bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Quick Start
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="mb-20">
        <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Agents Write"
            description="Any AI agent writes artifacts — specs, docs, diagrams — to a shared repo via the CLI."
            icon="✏️"
          />
          <Card
            title="Git Versions"
            description="Every write is a git commit. Full history, diff, blame — know who wrote what and when."
            icon="📋"
          />
          <Card
            title="Humans Review"
            description="Browse and render artifacts in the browser. Markdown, Mermaid, HTML — all rendered."
            icon="👁️"
          />
        </div>
      </section>

      {/* CLI demo */}
      <section className="mb-20" id="quickstart">
        <h2 className="text-2xl font-bold mb-6 text-center">Quick Start</h2>
        <div className="bg-gray-950 text-gray-100 rounded-xl p-6 font-mono text-sm leading-relaxed overflow-x-auto">
          <Line comment="# Install" />
          <Line text="npm install -g openarti" />
          <Line />
          <Line comment="# Write an artifact" />
          <Line text='echo "# API Design\n\n## Authentication\n\nUse JWT tokens." \' />
          <Line text='  | arti write team/docs/api.md -m "initial draft"' />
          <Line />
          <Line comment="# Read it back" />
          <Line text="arti read team/docs/api.md" />
          <Line />
          <Line comment="# Search across the repo" />
          <Line text='arti grep "authentication" team/docs' />
          <Line />
          <Line comment="# Edit precisely (no full rewrite)" />
          <Line text='arti edit team/docs/api.md --old "Use JWT tokens." \' />
          <Line text='  --new "Use OAuth 2.0 with PKCE." -m "switch to OAuth"' />
          <Line />
          <Line comment="# View history" />
          <Line text="arti log team/docs" />
        </div>
      </section>

      {/* Features */}
      <section className="mb-20">
        <h2 className="text-2xl font-bold mb-8 text-center">Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Feature
            title="Agent-Native CLI"
            description="11 commands designed for agents: read, write, edit, rm, ls, grep, glob, log, diff, blame, repo. Plain text output, git-style interface."
          />
          <Feature
            title="Version Controlled"
            description="Every write is a git commit. Full history with log, diff, and blame. Know which agent wrote each line."
          />
          <Feature
            title="Browser Rendering"
            description="Markdown, code, Mermaid, HTML, SVG — all rendered in the web UI. Source and preview modes."
          />
          <Feature
            title="Self-Hostable"
            description="Docker Compose one-liner. API server, web frontend, and PostgreSQL — everything you need."
          />
          <Feature
            title="Agent Skill"
            description="Install the skill so any agent knows how to use arti. Works with Claude Code, Cursor, Codex CLI, and more."
          />
          <Feature
            title="Open Source"
            description="MIT licensed. Full-stack monorepo — API, CLI, web, skill. Read the code, fork it, self-host it."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-sm text-gray-400 pt-8 border-t">
        <p>
          OpenArti is open source —{" "}
          <a
            href="https://github.com/glance2life/openarti"
            className="text-gray-600 hover:text-gray-900 underline"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

function Card({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="border rounded-xl p-6 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border rounded-xl p-5">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function Line({ text, comment }: { text?: string; comment?: string }) {
  if (!text && !comment) return <div className="h-4" />;
  if (comment) return <div className="text-gray-500">{comment}</div>;
  return <div className="text-green-400">{text}</div>;
}
