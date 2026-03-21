"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { RendererProps } from "./registry";

export function MarkdownRenderer({ content }: RendererProps) {
  return (
    <article className="prose prose-gray max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  );
}
