"use client";

import { useMemo } from "react";
import { JsonView, darkStyles, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import type { RendererProps } from "./registry";

export default function JsonRenderer({ content }: RendererProps) {
  const { data, error } = useMemo(() => {
    try {
      return { data: JSON.parse(content), error: null };
    } catch (e) {
      return { data: null, error: (e as Error).message };
    }
  }, [content]);

  if (error) {
    return <div className="p-4 text-destructive">JSON parse error: {error}</div>;
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
