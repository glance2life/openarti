import type { ComponentType } from "react";
import { MarkdownRenderer } from "./markdown";
import { CodeRenderer } from "./code";

export interface RendererProps {
  content: string;
  filename: string;
}

const rendererMap: Record<string, ComponentType<RendererProps>> = {
  ".md": MarkdownRenderer,
  ".markdown": MarkdownRenderer,
};

export function getRenderer(filename: string): ComponentType<RendererProps> {
  const ext = filename.includes(".")
    ? "." + filename.split(".").pop()!.toLowerCase()
    : "";
  return rendererMap[ext] || CodeRenderer;
}
