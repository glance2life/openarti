// Adapter between the pure Manyana Weave CRDT (weave.ts) and the DB-backed
// representation. Produces append-only ops (insert / toggle) that can be
// written to arti_weave_ops, and maintains an in-memory weave with stable
// line identities (lineId).

import { randomUUID } from "node:crypto";
import { getDeletionsAndInsertions } from "./weave.js";

export type LineId = string;

export interface IdentifiedLine {
  lineId: LineId;
  text: string;
  depth: number;
  anchoredRight: boolean;
  count: number; // alive when count % 2 === 1
}

export type IdentifiedWeave = IdentifiedLine[];

export interface InsertOp {
  type: "insert";
  lineId: LineId;
  text: string;
  depth: number;
  anchoredRight: boolean;
  insertSeq: number; // monotonic ordering within the commit
}

export interface ToggleOp {
  type: "toggle";
  lineId: LineId;
}

export type WeaveOp = InsertOp | ToggleOp;

export function emptyWeave(): IdentifiedWeave {
  return [];
}

export function serializeWeave(w: IdentifiedWeave): string {
  return JSON.stringify(
    w.map((l) => [l.lineId, l.text, l.depth, l.anchoredRight, l.count])
  );
}

export function deserializeWeave(raw: string): IdentifiedWeave {
  if (!raw) return [];
  const arr = JSON.parse(raw) as [string, string, number, boolean, number][];
  return arr.map(([lineId, text, depth, anchoredRight, count]) => ({
    lineId,
    text,
    depth,
    anchoredRight,
    count,
  }));
}

export function currentLines(w: IdentifiedWeave): string[] {
  return w.filter((l) => l.count % 2 === 1).map((l) => l.text);
}

function defaultGenLineId(): string {
  return randomUUID().replace(/-/g, "");
}

/**
 * Apply a content change: given the current weave and the target line
 * sequence, return the next weave and the ops describing the change.
 *
 * Mirrors `updateState` in weave.ts line-for-line so that weave-order,
 * depth, anchoredRight and count are produced identically; the only
 * extension is that each line carries a stable `lineId`.
 */
export function applyUpdate(
  current: IdentifiedWeave,
  newLines: string[],
  genLineId: () => LineId = defaultGenLineId
): { next: IdentifiedWeave; ops: WeaveOp[] } {
  const ops: WeaveOp[] = [];

  // Empty state → initialState equivalent: every line is an insert at
  // depth=i, anchoredRight=false, count=1.
  if (current.length === 0) {
    const next: IdentifiedWeave = [];
    newLines.forEach((text, i) => {
      const lineId = genLineId();
      next.push({ lineId, text, depth: i, anchoredRight: false, count: 1 });
      ops.push({
        type: "insert",
        lineId,
        text,
        depth: i,
        anchoredRight: false,
        insertSeq: i,
      });
    });
    return { next, ops };
  }

  const oldLines = current.map((l) => l.text); // full weave, dead included
  const { deletions, insertions } = getDeletionsAndInsertions(oldLines, newLines);

  // Mutable copy of current identified weave
  const mutable: IdentifiedLine[] = current.map((l) => ({ ...l }));

  // Apply deletions: flip count parity for alive lines in deletion list
  for (const del of deletions) {
    if (mutable[del].count % 2 === 1) {
      mutable[del].count += 1;
      ops.push({ type: "toggle", lineId: mutable[del].lineId });
    }
  }

  // Resurrect: lines NOT in deletions but currently dead
  const deletedSet = new Set(deletions);
  for (let i = 0; i < mutable.length; i++) {
    if (!deletedSet.has(i) && mutable[i].count % 2 === 0) {
      mutable[i].count += 1;
      ops.push({ type: "toggle", lineId: mutable[i].lineId });
    }
  }

  // Apply insertions, computing depth/anchor per original algorithm
  const result: IdentifiedLine[] = [];
  let posInInsertions = 0;
  let insertSeq = 0;
  for (let pos = 0; pos <= mutable.length; pos++) {
    if (
      posInInsertions < insertions.length &&
      insertions[posInInsertions][0] === pos
    ) {
      let up: boolean;
      if (pos === mutable.length) up = true;
      else if (pos === 0) up = false;
      else up = mutable[pos - 1].depth > mutable[pos].depth;

      const insertedTexts = insertions[posInInsertions][1];
      let firstDepth: number;
      let firstAnchor: boolean;
      if (up) {
        firstDepth = mutable[pos - 1].depth + 1;
        firstAnchor = false;
      } else {
        firstDepth = mutable[pos].depth + 1;
        firstAnchor = true;
      }

      const firstLineId = genLineId();
      result.push({
        lineId: firstLineId,
        text: insertedTexts[0],
        depth: firstDepth,
        anchoredRight: firstAnchor,
        count: 1,
      });
      ops.push({
        type: "insert",
        lineId: firstLineId,
        text: insertedTexts[0],
        depth: firstDepth,
        anchoredRight: firstAnchor,
        insertSeq: insertSeq++,
      });

      for (let k = 1; k < insertedTexts.length; k++) {
        const prev = result[result.length - 1];
        const lineId = genLineId();
        const depth = prev.depth + 1;
        result.push({
          lineId,
          text: insertedTexts[k],
          depth,
          anchoredRight: false,
          count: 1,
        });
        ops.push({
          type: "insert",
          lineId,
          text: insertedTexts[k],
          depth,
          anchoredRight: false,
          insertSeq: insertSeq++,
        });
      }
      posInInsertions++;
    }
    if (pos < mutable.length) {
      result.push(mutable[pos]);
    }
  }

  return { next: result, ops };
}
