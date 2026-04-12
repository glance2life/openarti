import type { ComponentType } from "react";
import dynamic from "next/dynamic";
import { MarkdownRenderer } from "./markdown";
import { CodeRenderer } from "./code";

export interface RendererProps {
  content: string;
  filename: string;
}

const HtmlRenderer = dynamic(() => import("./html"));
const SvgRenderer = dynamic(() => import("./svg"));
const CsvRenderer = dynamic(() => import("./csv"));
const JsonRenderer = dynamic(() => import("./json"));
const StructuredDataRenderer = dynamic(() => import("./structured-data"));
const MermaidRenderer = dynamic(() => import("./mermaid"), { ssr: false });
const PlantUmlRenderer = dynamic(() => import("./plantuml"));
const OpenApiRenderer = dynamic(() => import("./openapi"), { ssr: false });
const LatexRenderer = dynamic(() => import("./latex"), { ssr: false });

/** Extensions that have a rich preview renderer (not just plain code). */
const rendererMap: Record<string, ComponentType<RendererProps>> = {
  // Markdown
  ".md": MarkdownRenderer,
  ".markdown": MarkdownRenderer,
  ".mdx": MarkdownRenderer,
  // HTML / SVG
  ".html": HtmlRenderer,
  ".htm": HtmlRenderer,
  ".svg": SvgRenderer,
  // Data tables
  ".csv": CsvRenderer,
  ".tsv": CsvRenderer,
  // Structured data (tree view)
  ".json": JsonRenderer,
  ".yaml": StructuredDataRenderer,
  ".yml": StructuredDataRenderer,
  ".toml": StructuredDataRenderer,
  // Diagrams
  ".mmd": MermaidRenderer,
  ".mermaid": MermaidRenderer,
  ".puml": PlantUmlRenderer,
  ".plantuml": PlantUmlRenderer,
  // Math / docs
  ".tex": LatexRenderer,
};

/** Common file-type abbreviation labels. */
const typeLabels: Record<string, string> = {
  ".md": "MD",
  ".markdown": "MD",
  ".mdx": "MDX",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".less": "LESS",
  ".js": "JS",
  ".jsx": "JSX",
  ".ts": "TS",
  ".tsx": "TSX",
  ".py": "PY",
  ".rb": "RB",
  ".go": "GO",
  ".rs": "RS",
  ".java": "JAVA",
  ".kt": "KT",
  ".swift": "SWIFT",
  ".c": "C",
  ".cpp": "CPP",
  ".h": "H",
  ".sh": "SH",
  ".bash": "BASH",
  ".zsh": "ZSH",
  ".sql": "SQL",
  ".graphql": "GQL",
  ".txt": "TXT",
  ".csv": "CSV",
  ".tsv": "TSV",
  ".svg": "SVG",
  ".env": "ENV",
  ".mmd": "MERMAID",
  ".mermaid": "MERMAID",
  ".puml": "PUML",
  ".plantuml": "PUML",
  ".tex": "TEX",
};

function getExt(filename: string): string {
  return filename.includes(".")
    ? "." + filename.split(".").pop()!.toLowerCase()
    : "";
}

export function getRenderer(filename: string): ComponentType<RendererProps> {
  return rendererMap[getExt(filename)] || CodeRenderer;
}

/** Whether the file type has a rich preview (beyond plain text). */
export function hasPreview(filename: string): boolean {
  return getExt(filename) in rendererMap;
}

/** Short uppercase label for the file type, e.g. "MD", "JSON". */
export function getFileTypeLabel(filename: string): string | null {
  return typeLabels[getExt(filename)] || null;
}

/** Check if content looks like an OpenAPI spec. */
export function isOpenApiContent(content: string): boolean {
  return /["']?openapi["']?\s*[:=]/.test(content.slice(0, 500));
}

/** Get OpenAPI renderer (for content-detected cases). */
export { OpenApiRenderer };
