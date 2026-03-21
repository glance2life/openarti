import type { RendererProps } from "./registry";

export function CodeRenderer({ content }: RendererProps) {
  const lines = content.split("\n");
  return (
    <pre className="overflow-x-auto text-sm">
      <code>
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="select-none text-gray-400 w-12 text-right pr-4 shrink-0">
              {i + 1}
            </span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </code>
    </pre>
  );
}
