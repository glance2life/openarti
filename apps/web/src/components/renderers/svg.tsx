"use client";

import { useRef, useEffect, useState } from "react";
import type { RendererProps } from "./registry";

export default function SvgRenderer({ content }: RendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc) {
          const svg = doc.querySelector("svg");
          if (svg) {
            setHeight(svg.getBoundingClientRect().height + 32);
          }
        }
      } catch {
        // cross-origin — keep default
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [content]);

  // Wrap SVG in a centered page with a checkerboard background for transparency
  const wrappedContent = `<!DOCTYPE html>
<html><head><style>
  body {
    margin: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: repeating-conic-gradient(#e5e5e5 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
  }
  svg { max-width: 100%; height: auto; }
</style></head><body>${content}</body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={wrappedContent}
      sandbox=""
      className="w-full border-0"
      style={{ height }}
      title="SVG Preview"
    />
  );
}
