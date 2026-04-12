"use client";

import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import type { RendererProps } from "./registry";

export function MarkdownRenderer({ content }: RendererProps) {
  return (
    <article className="max-w-none p-6 font-serif">
      <Streamdown plugins={{ code, math, mermaid, cjk }}>
        {content}
      </Streamdown>
    </article>
  );
}
