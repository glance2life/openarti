"use client";

import { useEffect, useRef, useId } from "react";
import mermaid from "mermaid";
import type { RendererProps } from "./registry";

mermaid.initialize({ startOnLoad: false, theme: "default" });

export default function MermaidRenderer({ content }: RendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "_");

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    mermaid.render(`mermaid${id}`, content).then(
      ({ svg }) => {
        if (!cancelled && el) {
          el.innerHTML = svg;
        }
      },
      (err) => {
        if (!cancelled && el) {
          el.textContent = `Mermaid error: ${err.message ?? err}`;
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [content, id]);

  return (
    <div className="flex justify-center p-6">
      <div ref={containerRef} className="max-w-full overflow-auto" />
    </div>
  );
}
