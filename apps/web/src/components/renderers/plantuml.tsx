"use client";

import { useMemo } from "react";
import plantumlEncoder from "plantuml-encoder";
import type { RendererProps } from "./registry";

const PLANTUML_SERVER = "https://www.plantuml.com/plantuml/svg";

export default function PlantUmlRenderer({ content }: RendererProps) {
  const url = useMemo(() => {
    const encoded = plantumlEncoder.encode(content);
    return `${PLANTUML_SERVER}/${encoded}`;
  }, [content]);

  return (
    <div className="flex justify-center p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="PlantUML Diagram" className="max-w-full" />
    </div>
  );
}
