"use client";

import { useState, useCallback } from "react";
import { Streamdown } from "streamdown";
import "streamdown/styles.css";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import { cjk } from "@streamdown/cjk";
import { Link, Check } from "lucide-react";
import type { RendererProps } from "./registry";
import type { ComponentPropsWithoutRef } from "react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^\w一-龥-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (children && typeof children === "object" && "props" in (children as object)) {
    return extractText((children as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}

function HeadingWithCopy({
  as: Tag,
  children,
  ...props
}: ComponentPropsWithoutRef<"h1"> & { as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }) {
  const [copied, setCopied] = useState(false);

  const id = slugify(extractText(children));

  const handleCopy = useCallback(() => {
    const url = `${window.location.href.split("#")[0]}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [id]);

  return (
    <Tag id={id || undefined} className="group flex items-center gap-1.5" {...props}>
      {children}
      <button
        onClick={handleCopy}
        aria-label="Copy link to heading"
        className="inline-flex items-center justify-center rounded px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-green-600" />
        ) : (
          <Link className="size-3.5" />
        )}
      </button>
    </Tag>
  );
}

const headingComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => <HeadingWithCopy as="h1" {...props} />,
  h2: (props: ComponentPropsWithoutRef<"h2">) => <HeadingWithCopy as="h2" {...props} />,
  h3: (props: ComponentPropsWithoutRef<"h3">) => <HeadingWithCopy as="h3" {...props} />,
  h4: (props: ComponentPropsWithoutRef<"h4">) => <HeadingWithCopy as="h4" {...props} />,
  h5: (props: ComponentPropsWithoutRef<"h5">) => <HeadingWithCopy as="h5" {...props} />,
  h6: (props: ComponentPropsWithoutRef<"h6">) => <HeadingWithCopy as="h6" {...props} />,
};

export function MarkdownRenderer({ content }: RendererProps) {
  return (
    <article className="max-w-none p-6 font-serif">
      <Streamdown plugins={{ code, math, mermaid, cjk }} components={headingComponents}>
        {content}
      </Streamdown>
    </article>
  );
}
