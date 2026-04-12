"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import type { ShikiTransformer } from "shiki";
import type { RendererProps } from "./registry";

/** Map file extensions to Shiki language IDs. */
const langMap: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "jsx",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".py": "python",
  ".rb": "ruby",
  ".go": "go",
  ".rs": "rust",
  ".java": "java",
  ".kt": "kotlin",
  ".swift": "swift",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".cs": "csharp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".graphql": "graphql",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".less": "less",
  ".md": "markdown",
  ".mdx": "mdx",
  ".svg": "xml",
  ".env": "dotenv",
  ".dockerfile": "dockerfile",
  ".tf": "hcl",
  ".tex": "latex",
  ".r": "r",
  ".lua": "lua",
  ".php": "php",
  ".vue": "vue",
  ".svelte": "svelte",
  ".zig": "zig",
  ".proto": "proto",
  ".prisma": "prisma",
};

function getLang(filename: string): string {
  const ext = filename.includes(".")
    ? "." + filename.split(".").pop()!.toLowerCase()
    : "";
  const base = filename.split("/").pop()?.toLowerCase() ?? "";
  if (base === "dockerfile") return "dockerfile";
  if (base === "makefile") return "makefile";
  return langMap[ext] || "text";
}

function lineNumbersTransformer(): ShikiTransformer {
  let counter = 0;
  return {
    line(node) {
      counter++;
      node.children.unshift({
        type: "element",
        tagName: "span",
        properties: {
          class: "line-number",
        },
        children: [{ type: "text", value: String(counter) }],
      });
    },
  };
}

export function CodeRenderer({ content, filename }: RendererProps) {
  const [html, setHtml] = useState<string>("");
  const lineCount = content.split("\n").length;
  const digits = String(lineCount).length;
  const gutterWidth = `${digits}ch`;

  useEffect(() => {
    let cancelled = false;
    codeToHtml(content, {
      lang: getLang(filename),
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
      transformers: [lineNumbersTransformer()],
    }).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [content, filename]);

  if (!html) {
    const lines = content.split("\n");
    return (
      <pre className="overflow-x-auto p-4 text-sm">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span
                className="select-none text-muted-foreground/40 text-right pr-6 shrink-0"
                style={{ width: gutterWidth }}
              >
                {i + 1}
              </span>
              <span className="whitespace-pre">{line}</span>
            </div>
          ))}
        </code>
      </pre>
    );
  }

  return (
    <div
      className="shiki-wrapper overflow-x-auto text-sm [&_pre]:p-4 [&_code]:block [&_.line]:min-h-[1.7em]"
      style={{ "--gutter-width": gutterWidth } as React.CSSProperties}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
