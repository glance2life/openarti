"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Copy, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOpenDialog } from "@/hooks/use-dialog-router";

function getApiUrl() {
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    }
    const apiHost = hostname.replace(/^(www\.)?/, "api.");
    return `${protocol}//${apiHost}${port ? `:${port}` : ""}`;
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
}

// ---- Types & data ----

type AgentId =
  | "claude-code"
  | "claude-ai"
  | "claude-desktop"
  | "cursor"
  | "codex-cli"
  | "manus";
type TargetId = AgentId | "mcp";
type MethodId =
  | "mcp"
  | "skill"
  | "mcp-connector"
  | "mcp-config"
  | "mcp-url"
  | "mcp-json";

interface Agent {
  id: AgentId;
  label: string;
  icon: string;
  methods: MethodId[];
  // false = cloud agent that can't reach localhost; warning shown in local dev
  local: boolean;
  // not verified yet — hidden behind "show more" in the grid
  experimental?: boolean;
}

// Per-method override: some methods (cloud connectors) always need a public URL
// even when the agent is otherwise local.
function methodNeedsPublicUrl(agent: Agent, method: MethodId): boolean {
  if (!agent.local) return true;
  if (method === "mcp-connector") return true;
  return false;
}

const AGENTS: Agent[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    icon: "/assets/agents/claude-code.svg",
    methods: ["mcp", "skill"],
    local: true,
  },
  {
    id: "claude-ai",
    label: "Claude.ai",
    icon: "/assets/agents/claude.svg",
    methods: ["mcp"],
    local: false,
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    icon: "/assets/agents/claude.svg",
    methods: ["mcp-connector", "mcp-config"],
    local: true,
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: "/assets/agents/cursor.svg",
    methods: ["mcp", "skill"],
    local: true,
  },
  {
    id: "codex-cli",
    label: "Codex CLI",
    icon: "/assets/agents/codex.svg",
    methods: ["mcp"],
    local: true,
  },
  {
    id: "manus",
    label: "Manus",
    icon: "/assets/agents/manus.svg",
    methods: ["mcp"],
    local: false,
    experimental: true,
  },
];

const TARGET_IDS: readonly TargetId[] = [
  "claude-code",
  "claude-ai",
  "claude-desktop",
  "cursor",
  "codex-cli",
  "manus",
  "mcp",
];
const METHOD_IDS: readonly MethodId[] = [
  "mcp",
  "skill",
  "mcp-connector",
  "mcp-config",
  "mcp-url",
  "mcp-json",
];

function isTargetId(v: string | null): v is TargetId {
  return v !== null && (TARGET_IDS as readonly string[]).includes(v);
}
function isMethodId(v: string | null): v is MethodId {
  return v !== null && (METHOD_IDS as readonly string[]).includes(v);
}

const METHOD_LABELS: Record<MethodId, string> = {
  mcp: "MCP",
  skill: "Skill",
  "mcp-connector": "Connector",
  "mcp-config": "Config file",
  "mcp-url": "URL",
  "mcp-json": "JSON",
};

interface Step {
  title: string;
  description: string;
  code?: string;
  language?: "bash" | "json" | "toml";
  note?: ReactNode;
}

interface UrlOpts {
  apiUrl: string;
  mcpUrl: string;
  isLocal: boolean;
}

function mcpJsonConfig(mcpUrl: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        openarti: {
          command: "npx",
          args: ["-y", "mcp-remote", mcpUrl],
        },
      },
    },
    null,
    2,
  );
}

function getSteps(target: TargetId, method: MethodId, opts: UrlOpts): Step[] {
  const { apiUrl, mcpUrl, isLocal } = opts;

  if (target === "mcp") {
    const isJson = method === "mcp-json";
    return [
      {
        title: isJson ? "Paste this JSON into your client's config" : "Paste this URL into your client",
        description: isJson
          ? "For stdio-only clients (e.g. local apps that read a config file)."
          : "For HTTP-native clients (most modern MCP clients).",
        code: isJson ? mcpJsonConfig(mcpUrl) : mcpUrl,
        language: isJson ? "json" : undefined,
      },
      {
        title: "Authenticate",
        description:
          "Most clients open a browser for OAuth on first use. If yours only accepts a header token, generate one here:",
        note: <InlineApiKeyCreator apiUrl={apiUrl} label="MCP client" />,
      },
    ];
  }

  if (method === "mcp") {
    switch (target) {
      case "claude-code":
        return [
          {
            title: "Add the MCP server",
            description:
              "Register OpenArti with Claude Code using the CLI.",
            code: `claude mcp add --scope project --transport http openarti "${mcpUrl}"`,
          },
          {
            title: "Authenticate",
            description:
              "In a regular terminal (not the IDE extension), run:",
            code: "claude /mcp",
            note: "Select the openarti server, then Authenticate to start the OAuth flow.",
          },
        ];
      case "claude-ai":
        return [
          {
            title: "Open Connectors",
            description:
              "On claude.ai, go to Settings \u2192 Connectors and click \u201CAdd custom connector\u201D.",
          },
          {
            title: "Add the server",
            description:
              "Enter this URL as the MCP server and complete the OAuth flow.",
            code: mcpUrl,
          },
        ];
      case "claude-desktop":
        // Falls through — Claude Desktop uses mcp-connector / mcp-config handled below.
        break;
      case "cursor":
        return [
          {
            title: "Open MCP settings",
            description:
              "Cursor Settings → Features → MCP → \u201CAdd new MCP server\u201D.",
          },
          {
            title: "Configure the server",
            description:
              "Set the type to \u201Chttp\u201D and enter this URL.",
            code: mcpUrl,
          },
          {
            title: "Authenticate",
            description:
              "Cursor will trigger the OAuth flow the first time you use the server in chat.",
          },
        ];
      case "codex-cli":
        return [
          {
            title: "Add the MCP server",
            description:
              "Add openarti to ~/.codex/config.toml.",
            code: [
              "[mcp_servers.openarti]",
              'command = "npx"',
              `args = ["-y", "mcp-remote", "${mcpUrl}"]`,
            ].join("\n"),
            language: "toml",
          },
          {
            title: "Authenticate",
            description:
              "Run codex and trigger a prompt that uses openarti. The first call opens a browser for OAuth.",
            code: "codex",
          },
        ];
      case "manus":
        return [
          {
            title: "Open MCP integrations",
            description:
              "In Manus, open Settings \u2192 Integrations \u2192 MCP.",
          },
          {
            title: "Add the server",
            description: "Enter this URL as a new MCP server.",
            code: mcpUrl,
          },
          {
            title: "Authenticate",
            description:
              "Complete the OAuth flow in the browser tab Manus opens.",
          },
        ];
    }
  }

  // Claude Desktop: UI-based Custom Connector (recommended)
  if (method === "mcp-connector" && target === "claude-desktop") {
    return [
      {
        title: "Open Connectors",
        description:
          "Claude Desktop \u2192 Settings \u2192 Connectors \u2192 \u201CAdd custom connector\u201D.",
      },
      {
        title: "Add the server",
        description:
          "Enter this URL as the MCP server and complete the OAuth flow when prompted.",
        code: mcpUrl,
      },
    ];
  }

  // Claude Desktop: JSON config file (alternative)
  if (method === "mcp-config" && target === "claude-desktop") {
    return [
      {
        title: "Open the config file",
        description:
          "Claude Desktop \u2192 Settings \u2192 Developer \u2192 Edit Config.",
      },
      {
        title: "Add the server entry",
        description:
          "Paste this into claude_desktop_config.json. If you already have other servers, merge the mcpServers object.",
        code: mcpJsonConfig(mcpUrl),
        language: "json",
      },
      {
        title: "Restart and authenticate",
        description:
          "Quit Claude Desktop fully, reopen it, and complete the OAuth flow when prompted.",
      },
    ];
  }

  // Skill method — only reachable for claude-code / cursor
  const skillClientLabel = target === "cursor" ? "Cursor" : "Claude Code";
  const steps: Step[] = [
    {
      title: "Install the CLI",
      description: "Install openarti-cli globally.",
      code: "npm install -g openarti-cli",
    },
  ];
  if (isLocal) {
    steps.push({
      title: "Point at your local server",
      description: "Tell the CLI where your local OpenArti runs.",
      code: `export OPENARTI_ENDPOINT="${apiUrl}"`,
    });
  }
  steps.push(
    {
      title: "Log in",
      description:
        "Opens a browser window for sign-in. This is needed before installing the skill.",
      code: "arti login",
      note: (
        <>
          Prefer a non-interactive flow?{" "}
          <ApiKeysSettingsLink>Create an API key</ApiKeysSettingsLink>{" "}
          and run{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            export OPENARTI_TOKEN=&lt;key&gt;
          </code>{" "}
          instead.
        </>
      ),
    },
    {
      title: "Install the skill",
      description: `Add the OpenArti skill to ${skillClientLabel}.`,
      code: "npx skills add openarti",
    },
  );
  return steps;
}

function buildPrompt(
  target: TargetId,
  method: MethodId,
  opts: UrlOpts,
  starterPrompts: string[] = [],
): string | null {
  const core = buildCorePrompt(target, method, opts);
  if (!core) return null;
  if (starterPrompts.length === 0) return core;
  const suggestions =
    starterPrompts.length === 1
      ? `\n\nOnce setup is complete, verify it by asking me: "${starterPrompts[0]}"`
      : [
          "",
          "",
          "Once you've finished the setup above, I might ask you to help with things like:",
          ...starterPrompts.map((p) => `  \u2022 ${p}`),
        ].join("\n");
  return core + suggestions;
}

function buildCorePrompt(
  target: TargetId,
  method: MethodId,
  opts: UrlOpts,
): string | null {
  if (target === "mcp") return null;
  const { apiUrl, mcpUrl, isLocal } = opts;

  if (method === "mcp") {
    switch (target) {
      case "claude-code":
        return [
          "Please connect the OpenArti MCP server to this project. Follow these steps:",
          "",
          "1. Run this command to register the server (you execute this):",
          "```",
          `claude mcp add --scope project --transport http openarti "${mcpUrl}"`,
          "```",
          "",
          "2. The next step requires an interactive OAuth flow \u2014 do NOT attempt to run it yourself. After step 1 succeeds, tell me to open a regular terminal (not the IDE extension) and run `claude /mcp`, then select the openarti server and click Authenticate.",
        ].join("\n");
      case "claude-ai":
        return [
          `Please help me add a Custom Connector on claude.ai. Server URL: ${mcpUrl}`,
          "",
          "These steps happen in the claude.ai UI \u2014 you can't execute them. Guide me:",
          "",
          "1. Go to Settings \u2192 Connectors and click \u201CAdd custom connector\u201D.",
          `2. Enter the server URL (${mcpUrl}) and complete OAuth authorization.`,
        ].join("\n");
      case "claude-desktop":
        // Fall through — handled below by method-specific branches.
        break;
      case "cursor":
        return [
          `Please help me add the OpenArti MCP server to Cursor. Server URL: ${mcpUrl}`,
          "",
          "The following steps require Cursor's UI \u2014 you cannot execute them, just guide me through each one and wait for me to confirm:",
          "",
          "1. Open Cursor Settings \u2192 Features \u2192 MCP and click \u201CAdd new MCP server\u201D.",
          `2. Set type to \u201Chttp\u201D and enter the URL: ${mcpUrl}`,
          "3. Cursor will prompt for OAuth authentication the first time I use the server in a chat.",
        ].join("\n");
      case "codex-cli":
        return [
          "Please connect the OpenArti MCP server to Codex CLI.",
          "",
          "1. Edit ~/.codex/config.toml and add (you execute this):",
          "```toml",
          "[mcp_servers.openarti]",
          'command = "npx"',
          `args = ["-y", "mcp-remote", "${mcpUrl}"]`,
          "```",
          "",
          "2. Tell me to run `codex` and trigger a prompt that calls the openarti server. The first call opens a browser for OAuth \u2014 don't try to automate it.",
        ].join("\n");
      case "manus":
        return [
          `Please help me connect the OpenArti MCP server to Manus. Server URL: ${mcpUrl}`,
          "",
          "Guide me through Manus's UI steps (you cannot execute these):",
          "",
          "1. Open Settings \u2192 Integrations \u2192 MCP.",
          `2. Add a new MCP server with URL: ${mcpUrl}`,
          "3. Complete the OAuth flow in the browser tab that opens.",
        ].join("\n");
    }
  }

  // Claude Desktop: Custom Connector (UI)
  if (method === "mcp-connector" && target === "claude-desktop") {
    return [
      `Please help me add a Custom Connector in Claude Desktop. Server URL: ${mcpUrl}`,
      "",
      "These steps happen in the desktop app UI \u2014 you can't execute them. Guide me:",
      "",
      "1. Open Settings \u2192 Connectors and click \u201CAdd custom connector\u201D.",
      `2. Enter the URL: ${mcpUrl}`,
      "3. Complete the OAuth flow when prompted.",
    ].join("\n");
  }

  // Claude Desktop: config file
  if (method === "mcp-config" && target === "claude-desktop") {
    return [
      `Please help me connect the OpenArti MCP server to Claude Desktop via the config file. Server URL: ${mcpUrl}`,
      "",
      "These steps need the desktop app's UI and restart \u2014 you can't execute them. Guide me through each, waiting for me to confirm:",
      "",
      "1. Open Settings \u2192 Developer \u2192 Edit Config. This opens claude_desktop_config.json.",
      "2. Merge this into the file:",
      "```json",
      mcpJsonConfig(mcpUrl),
      "```",
      "3. Fully quit and reopen Claude Desktop.",
      "4. Complete the OAuth flow in the browser that opens on first use.",
    ].join("\n");
  }

  // Skill
  const skillClientLabel = target === "cursor" ? "Cursor" : "Claude Code";
  const lines = [
    `Please install the OpenArti CLI and skill for ${skillClientLabel}. Follow these steps:`,
    "",
    "1. Install the CLI globally (you execute this):",
    "```",
    "npm install -g openarti-cli",
    "```",
  ];
  let n = 2;
  if (isLocal) {
    lines.push(
      "",
      `${n}. Point the CLI at my local server (you execute this):`,
      "```",
      `export OPENARTI_ENDPOINT="${apiUrl}"`,
      "```",
    );
    n++;
  }
  lines.push(
    "",
    `${n}. The next step opens a browser for sign-in \u2014 do NOT attempt to run it yourself. Tell me to run \`arti login\`. Alternatively, I can create an API key in Settings \u2192 API keys and export OPENARTI_TOKEN=<key>.`,
    "",
    `${n + 1}. Install the skill (you execute this):`,
    "```",
    "npx skills add openarti",
    "```",
  );
  return lines.join("\n");
}

// ---- Starter prompts ----

export const STARTER_PROMPTS = ["List my openarti collections"];

// ---- UI atoms ----

// Set by <ConnectDialog> so links that open other dialogs can round-trip back.
// Unset on the standalone /connect page — settings opens without a back link.
export const ConnectReturnToContext = createContext<string | null>(null);

function ApiKeysSettingsLink({ children }: { children: ReactNode }) {
  const openDialog = useOpenDialog();
  const returnTo = useContext(ConnectReturnToContext);
  return (
    <button
      type="button"
      onClick={() => {
        const extras: Record<string, string> = { section: "api-keys" };
        if (returnTo) extras.returnTo = returnTo;
        openDialog("settings", extras);
      }}
      className="underline underline-offset-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function InlineApiKeyCreator({
  apiUrl,
  label,
}: {
  apiUrl: string;
  label: string;
}) {
  const [state, setState] = useState<"idle" | "creating" | "done" | "error">(
    "idle",
  );
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleCreate() {
    setState("creating");
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiUrl}/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const data = (await res.json()) as { key: string };
      setRawKey(data.key);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create key");
      setState("error");
    }
  }

  if (state === "done" && rawKey) {
    return (
      <div className="rounded-lg border bg-muted/40 px-4 py-3">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Copy this key now — it won&apos;t be shown again.
        </p>
        <div className="mt-3 space-y-2">
          <HeaderValueRow fieldLabel="Header" value="Authorization" />
          <HeaderValueRow fieldLabel="Value" value={`Bearer ${rawKey}`} />
        </div>
        <p className="mt-3 text-xs">
          Manage keys in{" "}
          <ApiKeysSettingsLink>Settings → API keys</ApiKeysSettingsLink>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleCreate}
        disabled={state === "creating"}
      >
        {state === "creating" ? "Creating…" : "Create an API key"}
      </Button>
      {errorMsg && (
        <span className="text-xs text-destructive">{errorMsg}</span>
      )}
    </div>
  );
}

function HeaderValueRow({
  fieldLabel,
  value,
}: {
  fieldLabel: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 w-14 shrink-0 text-xs font-medium text-muted-foreground">
        {fieldLabel}
      </span>
      <code className="min-w-0 flex-1 break-all rounded border bg-background px-2 py-1 font-mono text-[12px] leading-relaxed">
        {value}
      </code>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-1 px-2"
        onClick={handleCopy}
        aria-label={`Copy ${fieldLabel.toLowerCase()}`}
      >
        {copied ? (
          <Check className="size-3.5 text-green-600" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  );
}

const CommitContext = createContext<(() => void) | null>(null);

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const onCommit = useContext(CommitContext);
  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCommit?.();
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Click to copy"}
            className="mt-3 block w-full cursor-pointer rounded-lg border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/60"
          />
        }
      >
        <span className="block whitespace-pre-wrap break-all font-mono text-[13px] leading-relaxed">
          {code}
        </span>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Click to copy"}</TooltipContent>
    </Tooltip>
  );
}

function AgentCard({
  agent,
  selected,
  onClick,
}: {
  agent: Agent;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-foreground bg-muted"
          : "border-border hover:bg-muted/50",
      )}
    >
      <Image
        src={agent.icon}
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0"
      />
      <span className="text-sm font-medium">{agent.label}</span>
    </button>
  );
}

function UniversalCard({
  selected,
  onClick,
}: {
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        selected
          ? "border-foreground bg-muted"
          : "border-border hover:bg-muted/50",
      )}
    >
      <Image
        src="/assets/agents/mcp.svg"
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium">MCP</span>
        <span className="text-xs text-muted-foreground">
          Use any MCP-compatible client with the raw URL or config.
        </span>
      </span>
    </button>
  );
}

function StepRow({ step, index, last }: { step: Step; index: number; last: boolean }) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-medium text-muted-foreground">
          {index + 1}
        </span>
        {!last && (
          <div className="mt-2 mb-2 min-h-4 flex-1 border-l border-dashed" />
        )}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-8")}>
        <h3 className="font-medium">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
        {step.code && <CodeBlock code={step.code} />}
        {step.note && (
          <div className="mt-3 text-sm text-muted-foreground">{step.note}</div>
        )}
      </div>
    </div>
  );
}

// ---- Main component ----

export function ConnectAgents({
  scrollable = false,
  onCommit,
}: {
  scrollable?: boolean;
  onCommit?: () => void;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlTarget = searchParams.get("agent");
  const urlMethod = searchParams.get("method");

  const [target, setTargetState] = useState<TargetId>(
    isTargetId(urlTarget) ? urlTarget : "claude-code",
  );
  const [method, setMethodState] = useState<MethodId>(
    isMethodId(urlMethod) ? urlMethod : "mcp",
  );
  const [promptCopied, setPromptCopied] = useState(false);
  const [showExperimental, setShowExperimental] = useState(false);

  function writeParams(next: { agent?: TargetId; method?: MethodId }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.agent !== undefined) params.set("agent", next.agent);
    if (next.method !== undefined) params.set("method", next.method);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setTarget(next: TargetId) {
    setTargetState(next);
    writeParams({ agent: next });
  }
  function setMethod(next: MethodId) {
    setMethodState(next);
    writeParams({ method: next });
  }

  const apiUrl = getApiUrl();
  const mcpUrl = `${apiUrl}/mcp`;
  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");
  const urlOpts = { apiUrl, mcpUrl, isLocal };

  const activeAgent = useMemo(
    () => (target === "mcp" ? null : AGENTS.find((a) => a.id === target)!),
    [target],
  );
  const availableMethods: MethodId[] = activeAgent
    ? activeAgent.methods
    : ["mcp-url", "mcp-json"];
  const activeMethod = availableMethods.includes(method)
    ? method
    : availableMethods[0];

  const steps = getSteps(target, activeMethod, urlOpts);
  const prompt = buildPrompt(target, activeMethod, urlOpts, STARTER_PROMPTS);

  function handleSelectTarget(next: TargetId) {
    setTargetState(next);
    const nextMethods: MethodId[] =
      next === "mcp"
        ? ["mcp-url", "mcp-json"]
        : AGENTS.find((a) => a.id === next)!.methods;
    const nextMethod = nextMethods.includes(method) ? method : nextMethods[0];
    setMethodState(nextMethod);
    writeParams({ agent: next, method: nextMethod });
    setPromptCopied(false);
  }

  function handleCopyPrompt() {
    if (!prompt) return;
    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
    onCommit?.();
  }

  const sectionTitle =
    target === "mcp"
      ? "Connect any MCP client"
      : `Set up ${activeAgent!.label}`;

  const visibleAgents = showExperimental
    ? AGENTS
    : AGENTS.filter((a) => !a.experimental);
  const hiddenCount = AGENTS.length - visibleAgents.length;

  const rightColRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollable && rightColRef.current) rightColRef.current.scrollTop = 0;
  }, [target, activeMethod, scrollable]);

  return (
    <CommitContext.Provider value={onCommit ?? null}>
    <div className={cn("flex flex-col", scrollable ? "h-full" : "pb-12")}>
      {/* Header */}
      <h1 className="text-xl font-semibold">Connect your agent to openarti</h1>

      {/* Two-column layout: agent list | install panel */}
      <div
        className={cn(
          "mt-6 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]",
          scrollable && "min-h-0 flex-1",
        )}
      >
        {/* Left: agent list */}
        <div className="flex flex-col gap-2">
          {visibleAgents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              selected={target === a.id}
              onClick={() => handleSelectTarget(a.id)}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowExperimental(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <span className="flex size-5 shrink-0 items-center justify-center text-base leading-none">
                +
              </span>
              <span className="text-sm font-medium">{hiddenCount} more</span>
            </button>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Or connect directly
            </p>
            <UniversalCard
              selected={target === "mcp"}
              onClick={() => handleSelectTarget("mcp")}
            />
          </div>
        </div>

        {/* Right: install panel */}
        <div
          ref={rightColRef}
          className={cn(
            "min-w-0",
            scrollable && "min-h-0 overflow-y-auto pr-2",
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-medium">{sectionTitle}</h2>
            {availableMethods.length > 1 && (
              <div className="inline-flex rounded-lg border p-0.5">
                {availableMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                      activeMethod === m
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Local-dev unreachable warning */}
          {activeAgent && isLocal && methodNeedsPublicUrl(activeAgent, activeMethod) && (
            <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
              <Info className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              <p>
                {activeAgent.label} can&apos;t reach{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900/50">
                  localhost
                </code>
                . Deploy openarti or use a tunnel for a public URL.
              </p>
            </div>
          )}

          {/* Copy-prompt shortcut */}
          {prompt && (
            <div className="mt-5 rounded-xl bg-muted/60 px-5 py-4">
              <p className="font-medium">Want your agent to do it?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste this prompt and {activeAgent!.label} will walk you
                through setup.
              </p>
              <Button
                size="default"
                className="mt-4 gap-1.5"
                onClick={handleCopyPrompt}
              >
                {promptCopied ? (
                  <Check className="size-4 text-green-300" />
                ) : (
                  <Copy className="size-4" />
                )}
                {promptCopied ? "Copied!" : "Copy prompt"}
              </Button>
            </div>
          )}

          {/* Steps */}
          <div className="mt-6">
            {steps.map((step, i) => (
              <StepRow
                key={`${target}-${activeMethod}-${i}`}
                step={step}
                index={i}
                last={i === steps.length - 1}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
    </CommitContext.Provider>
  );
}
