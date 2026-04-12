"use client";

import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import type { RendererProps } from "./registry";

/**
 * Renders LaTeX content. Extracts math expressions ($...$, $$...$$, \[...\], \(...\))
 * and renders them with KaTeX. Non-math text is rendered as plain text.
 */
export default function LatexRenderer({ content }: RendererProps) {
  const html = useMemo(() => {
    // Extract content between \begin{document} and \end{document} if present
    const docMatch = content.match(
      /\\begin\{document\}([\s\S]*?)\\end\{document\}/
    );
    const body = docMatch ? docMatch[1] : content;

    // Split on math delimiters and render each segment
    // Matches: $$...$$, $...$, \[...\], \(...\)
    const parts = body.split(
      /(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/
    );

    return parts
      .map((part) => {
        // Display math: $$...$$ or \[...\]
        if (
          (part.startsWith("$$") && part.endsWith("$$")) ||
          (part.startsWith("\\[") && part.endsWith("\\]"))
        ) {
          const tex = part.startsWith("$$")
            ? part.slice(2, -2)
            : part.slice(2, -2);
          try {
            return katex.renderToString(tex, { displayMode: true });
          } catch {
            return `<pre class="text-destructive">${tex}</pre>`;
          }
        }

        // Inline math: $...$ or \(...\)
        if (
          (part.startsWith("$") && part.endsWith("$")) ||
          (part.startsWith("\\(") && part.endsWith("\\)"))
        ) {
          const tex = part.startsWith("$")
            ? part.slice(1, -1)
            : part.slice(2, -2);
          try {
            return katex.renderToString(tex, { displayMode: false });
          } catch {
            return `<code class="text-destructive">${tex}</code>`;
          }
        }

        // Plain text — preserve whitespace and line breaks
        return part
          .split("\n")
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return "";
            // Skip common LaTeX preamble commands
            if (/^\\(documentclass|usepackage|title|author|date|maketitle|begin|end)\b/.test(trimmed)) {
              return "";
            }
            // Render \section, \subsection etc. as headings
            const sectionMatch = trimmed.match(
              /^\\(section|subsection|subsubsection)\{(.+?)\}$/
            );
            if (sectionMatch) {
              const tag =
                sectionMatch[1] === "section"
                  ? "h2"
                  : sectionMatch[1] === "subsection"
                    ? "h3"
                    : "h4";
              return `<${tag} class="font-bold mt-4 mb-2">${sectionMatch[2]}</${tag}>`;
            }
            return `<p>${trimmed}</p>`;
          })
          .join("");
      })
      .join("");
  }, [content]);

  return (
    <article
      className="prose prose-gray max-w-none p-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
