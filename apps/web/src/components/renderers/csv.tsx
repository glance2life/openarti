"use client";

import { useMemo } from "react";
import Papa from "papaparse";
import type { RendererProps } from "./registry";

export default function CsvRenderer({ content, filename }: RendererProps) {
  const { headers, rows, error } = useMemo(() => {
    const delimiter = filename.endsWith(".tsv") ? "\t" : ",";
    const result = Papa.parse<string[]>(content, {
      delimiter,
      skipEmptyLines: true,
    });

    if (result.errors.length > 0) {
      return { headers: [], rows: [], error: result.errors[0].message };
    }

    const [headers, ...rows] = result.data;
    return { headers: headers ?? [], rows, error: null };
  }, [content, filename]);

  if (error) {
    return <div className="p-4 text-destructive">Parse error: {error}</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="border-b px-3 py-2 text-right text-xs text-muted-foreground w-12">
              #
            </th>
            {headers.map((h, i) => (
              <th
                key={i}
                className="border-b px-3 py-2 text-left font-semibold whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-accent/50">
              <td className="border-b px-3 py-1.5 text-right text-xs text-muted-foreground">
                {ri + 1}
              </td>
              {headers.map((_, ci) => (
                <td key={ci} className="border-b px-3 py-1.5 whitespace-nowrap">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
