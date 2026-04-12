"use client";

import { useMemo } from "react";
import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { parse as parseYaml } from "yaml";
import { parse as parseToml } from "smol-toml";
import type { RendererProps } from "./registry";

export default function StructuredDataRenderer({
  content,
  filename,
}: RendererProps) {
  const { data, error } = useMemo(() => {
    try {
      const isToml = filename.endsWith(".toml");
      const parsed = isToml ? parseToml(content) : parseYaml(content);
      return { data: parsed, error: null };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }, [content, filename]);

  if (error) {
    return <div className="p-4 text-destructive">Parse error: {error}</div>;
  }

  return (
    <div className="p-4">
      <JsonView
        data={data}
        shouldExpandNode={(level) => level < 2}
        style={defaultStyles}
      />
    </div>
  );
}
