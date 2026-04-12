"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Eye, Code, Download } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getRenderer,
  hasPreview,
  getFileTypeLabel,
  isOpenApiContent,
  OpenApiRenderer,
} from "@/components/renderers/registry";
import { CodeRenderer } from "@/components/renderers/code";

interface PublicArtifactViewerProps {
  owner: string;
  collection: string;
  filePath: string;
  filename: string;
  initialContent: string;
}

export function PublicArtifactViewer({
  owner,
  collection,
  filePath,
  filename,
  initialContent,
}: PublicArtifactViewerProps) {
  const openApi = /\.ya?ml$|\.json$/.test(filename) && isOpenApiContent(initialContent);
  const canPreview = openApi || hasPreview(filename);
  const typeLabel = getFileTypeLabel(filename);
  const [mode, setMode] = useState<"preview" | "plain">(
    canPreview ? "preview" : "plain"
  );
  const [content] = useState(initialContent);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [content, filename]);

  const PreviewRenderer = openApi ? OpenApiRenderer : getRenderer(filename);
  const ActiveRenderer =
    mode === "preview" && canPreview ? PreviewRenderer : CodeRenderer;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        {/* Left: logo + file info */}
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo.svg" alt="OpenArti" width={90} height={15} />
          </Link>

          <div className="h-4 w-px bg-border shrink-0" />

          {canPreview && (
            <SegmentedControl
              id="public-artifact-mode"
              value={mode}
              onValueChange={setMode}
              items={[
                { value: "preview", label: <Eye className="size-3.5" /> },
                { value: "plain", label: <Code className="size-3.5" /> },
              ]}
            />
          )}

          <span className="truncate font-semibold">{filename}</span>
          {typeLabel && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {typeLabel}
            </span>
          )}
        </div>

        {/* Right: shared by + download */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground">
            Shared by {owner}
          </span>

          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    onClick={handleDownload}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  />
                }
              >
                <Download className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Download</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <ActiveRenderer content={content} filename={filePath} />
      </div>
    </div>
  );
}
