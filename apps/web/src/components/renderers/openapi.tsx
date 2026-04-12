"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import type { RendererProps } from "./registry";

export default function OpenApiRenderer({ content }: RendererProps) {
  return (
    <div className="h-full">
      <ApiReferenceReact
        configuration={{
          content,
        }}
      />
    </div>
  );
}
