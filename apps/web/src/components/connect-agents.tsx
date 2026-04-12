"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronDown, ChevronRight, Copy, Sparkles } from "lucide-react";

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

type ClientId = "claude-code" | "cursor" | "claude-web";
type MethodId = "mcp" | "skill";

interface Client {
  id: ClientId;
  label: string;
  methods: MethodId[];
  local: boolean;
}

const CLIENTS: Client[] = [
  { id: "claude-code", label: "Claude Code", methods: ["mcp", "skill"], local: true },
  { id: "cursor", label: "Cursor", methods: ["mcp", "skill"], local: true },
  { id: "claude-web", label: "Claude", methods: ["mcp"], local: false },
];

const METHOD_LABELS: Record<MethodId, string> = {
  mcp: "MCP",
  skill: "Skill",
};

interface Step {
  title: string;
  description: string;
  code?: string;
  note?: ReactNode;
  noteText?: string;
}

function getSteps(
  client: ClientId,
  method: MethodId,
  opts: { apiUrl: string; mcpUrl: string; isLocal: boolean },
): Step[] {
  const { apiUrl, mcpUrl, isLocal } = opts;
  if (method === "mcp") {
    switch (client) {
      case "claude-code":
        return [
          {
            title: "Add MCP server",
            description:
              "Add the OpenArti MCP server to your project config using the command line.",
            code: `claude mcp add --scope project --transport http openarti "${mcpUrl}"`,
          },
          {
            title: "Authenticate",
            description:
              "After configuring the MCP server, you need to authenticate. In a regular terminal (not the IDE extension) run:",
            code: "claude /mcp",
            note: "Select the openarti server, then Authenticate to begin the OAuth flow.",
          },
        ];
      case "cursor":
        return [
          {
            title: "Open MCP settings",
            description:
              "Go to Cursor Settings > Features > MCP, then click \"Add new MCP server\".",
          },
          {
            title: "Configure server",
            description:
              "Set the type to \"http\" and enter the server URL.",
            code: mcpUrl,
          },
          {
            title: "Authenticate",
            description:
              "Cursor will prompt you to authenticate via OAuth when you first use the server in a chat.",
          },
        ];
      case "claude-web":
        return [
          {
            title: "Open Integrations",
            description:
              "Go to claude.ai Settings > Integrations, then click \"Add Integration\".",
          },
          {
            title: "Add OpenArti",
            description:
              "Enter the MCP server URL and complete the OAuth authorization flow.",
            code: mcpUrl,
          },
        ];
    }
  }

  const skillClientLabel = client === "cursor" ? "Cursor" : "Claude Code";
  {
    const steps: Step[] = [
      {
        title: "Install CLI",
        description: "Install the OpenArti CLI globally.",
        code: "npm install -g openarti-cli",
      },
    ];

    if (isLocal) {
      steps.push({
        title: "Set endpoint",
        description: "Point the CLI to your server.",
        code: `export OPENARTI_ENDPOINT="${apiUrl}"`,
      });
    }

    steps.push(
      {
        title: "Login",
        description:
          "Log in to your OpenArti account. This will open a browser window for you to sign in.",
        code: "arti login",
        note: (
          <>
            Alternatively,{" "}
            <Link href="/settings/api-keys" target="_blank" className="underline underline-offset-2 hover:text-foreground">
              create an API key
            </Link>
            {" "}and set it via: export OPENARTI_TOKEN=&lt;key&gt;
          </>
        ),
        noteText: "Alternatively, create an API key at /settings/api-keys and set it via: export OPENARTI_TOKEN=<key>",
      },
      {
        title: "Install skill",
        description: `Add the OpenArti skill to ${skillClientLabel}.`,
        code: "npx skills add openarti",
      },
    );

    return steps;
  }
}

function buildPrompt(
  client: ClientId,
  method: MethodId,
  opts: { apiUrl: string; mcpUrl: string; isLocal: boolean },
): string {
  return getSteps(client, method, opts)
    .map((step, i) => {
      let text = `${i + 1}. ${step.title}\n${step.description}`;
      if (step.code) text += `\nCode:\n\`\`\`\n${step.code}\n\`\`\``;
      const noteStr = step.noteText ?? (typeof step.note === "string" ? step.note : undefined);
      if (noteStr) text += `\n${noteStr}`;
      return text;
    })
    .join("\n\n");
}

// ---- Starter prompts ----

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface Collection {
  id: string;
  name: string;
  owner: string;
}

function getStarterPrompts(collections: Collection[]): string[] {
  if (collections.length === 0) {
    return [
      'Create a new collection called "my-notes" and save a hello.md file with a short greeting',
      "Show me what OpenArti tools are available",
      "Create a collection and save a summary of our conversation",
    ];
  }

  const first = collections[0];
  const second = collections[1];

  const prompts: string[] = [
    `Show me what's in my ${first.owner}/${first.name} collection`,
  ];

  if (second) {
    prompts.push(
      `Search my ${second.owner}/${second.name} collection for all markdown files`,
    );
  } else {
    prompts.push(
      `Find all files in my ${first.owner}/${first.name} collection`,
    );
  }

  prompts.push(
    `Save a summary of our conversation to my ${first.owner}/${first.name} collection as notes.md`,
  );

  return prompts;
}

// ---- Copy button helper ----

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 gap-1.5 bg-muted text-muted-foreground"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="size-3.5 text-green-600" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

// ---- Main component ----

export function ConnectAgents() {
  const [activeClient, setActiveClient] = useState<ClientId>("claude-code");
  const [activeMethod, setActiveMethod] = useState<MethodId>("mcp");
  const [promptCopied, setPromptCopied] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState<boolean>(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/collections`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const own: Collection[] = Array.isArray(data.own) ? data.own : [];
        const shared: Collection[] = Array.isArray(data.shared) ? data.shared : [];
        setCollections([...own, ...shared]);
      })
      .catch(() => {});
  }, []);

  const apiUrl = getApiUrl();
  const mcpUrl = `${apiUrl}/mcp`;
  const isLocal = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1");

  const client = CLIENTS.find((c) => c.id === activeClient)!;
  const methods = client.methods;
  const method = methods.includes(activeMethod) ? activeMethod : methods[0];

  const urlOpts = { apiUrl, mcpUrl, isLocal };
  const steps = getSteps(activeClient, method, urlOpts);
  const prompt = buildPrompt(activeClient, method, urlOpts);

  function handleClientChange(val: string) {
    const next = val as ClientId;
    const nextClient = CLIENTS.find((c) => c.id === next)!;
    setActiveClient(next);
    if (!nextClient.methods.includes(activeMethod)) {
      setActiveMethod(nextClient.methods[0]);
    }
    setPromptCopied(false);
    setClientOpen(false);
  }

  function handleMethodChange(val: string) {
    setActiveMethod(val as MethodId);
    setPromptCopied(false);
    setMethodOpen(false);
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(prompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl pb-12">
      {/* Header */}
      <h1 className="flex flex-wrap items-center gap-1.5 text-lg font-medium text-muted-foreground">
        <span>Access artifacts from</span>
        <DropdownMenu modal={false} open={clientOpen} onOpenChange={setClientOpen}>
          <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-lg font-medium text-foreground outline-none transition-colors hover:bg-accent">
            {client.label}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[200px]">
            <DropdownMenuRadioGroup value={activeClient} onValueChange={handleClientChange}>
              {CLIENTS.map((c) => {
                const disabled = isLocal && !c.local;
                return (
                  <DropdownMenuRadioItem key={c.id} value={c.id} disabled={disabled} className="py-2 text-sm">
                    {c.label}
                    {disabled && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        needs public URL
                      </span>
                    )}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {methods.length > 1 ? (
          <>
            <span>via</span>
            <DropdownMenu modal={false} open={methodOpen} onOpenChange={setMethodOpen}>
              <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-lg font-medium text-foreground outline-none transition-colors hover:bg-accent">
                {METHOD_LABELS[method]}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[120px]">
                <DropdownMenuRadioGroup value={method} onValueChange={handleMethodChange}>
                  {methods.map((m) => (
                    <DropdownMenuRadioItem key={m} value={m} className="py-2 text-sm">
                      {METHOD_LABELS[m]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <span>via {METHOD_LABELS[method]}</span>
        )}
      </h1>

      {/* Copy prompt — primary action */}
      <div className="mt-8 rounded-xl bg-muted/60 px-5 py-4">
        <p className="font-medium">Copy this prompt to your agent</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your agent will handle the setup for you — just paste and run.
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

      {/* Manual steps — collapsed fallback */}
      <Collapsible open={stepsOpen} onOpenChange={setStepsOpen} className="mt-5">
        <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronRight className={`size-3.5 transition-transform ${stepsOpen ? "rotate-90" : ""}`} />
          Having trouble? Set up manually
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-6">
            {steps.map((step, i) => (
              <div key={`${method}-${i}`} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-sm font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <div className="flex-1 border-l border-dashed mt-2 mb-2 min-h-4" />
                  )}
                </div>

                <div className={`flex-1 ${i < steps.length - 1 ? "pb-8" : ""}`}>
                  <h3 className="font-medium">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.description}
                  </p>

                  {step.code && (
                    <div className="group/code relative mt-3 rounded-lg border bg-muted/40 px-4 py-3">
                      <code className="break-all font-mono text-[13px]">
                        {step.code}
                      </code>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/code:opacity-100 transition-opacity">
                        <CopyButton text={step.code} />
                      </div>
                    </div>
                  )}

                  {step.note && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {step.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Starter prompts */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="size-4" />
          <span className="text-sm font-medium">Once connected, try asking</span>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {getStarterPrompts(collections).map((p) => (
            <StarterPromptCard key={p} prompt={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StarterPromptCard({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <span className="flex-1 text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
        {prompt}
      </span>
      <span className="shrink-0">
        {copied ? (
          <Check className="size-3 text-green-600" />
        ) : (
          <Copy className="size-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </button>
  );
}
