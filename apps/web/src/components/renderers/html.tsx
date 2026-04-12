"use client";

import type { RendererProps } from "./registry";

export default function HtmlRenderer({ content }: RendererProps) {
  return (
    <iframe
      srcDoc={content}
      sandbox="allow-scripts"
      className="h-full w-full border-0"
      title="HTML Preview"
    />
  );
}
