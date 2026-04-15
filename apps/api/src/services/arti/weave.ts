// Manyana Weave CRDT — ported from manyana.py
// External API: initialState, currentLines, updateState, mergeStates

// ---- Data structures ----

export type WeaveLine = [text: string, depth: number, anchoredRight: boolean, count: number];
export type WeaveState = WeaveLine[];

export const CONFLICT_ADDED_LEFT = 0;
export const CONFLICT_ADDED_RIGHT = 1;
export const CONFLICT_ADDED_BOTH = 2;
export const CONFLICT_DELETED_LEFT = 3;
export const CONFLICT_DELETED_RIGHT = 4;
export const PEACE = 5;

const CONFLICT_STRINGS = [
  "added left",
  "added right",
  "added both",
  "deleted left",
  "deleted right",
  "deleted both",
];

const END = ">>>>>>> end conflict";

// ---- Serialization ----

export function serialize(state: WeaveState): string {
  return state
    .map(([text, depth, anchoredRight, count]) => `${depth} ${anchoredRight ? ">" : "<"} ${count} ${text}`)
    .join("\n");
}

export function deserialize(raw: string): WeaveState {
  if (raw === "") return [];
  return raw.split("\n").map((line) => {
    const vals = line.split(" ");
    return [vals.slice(3).join(" "), parseInt(vals[0]), vals[1] === ">", parseInt(vals[2])];
  });
}

// ---- Public API ----

export function initialState(lines: string[]): string {
  return serialize(lines.map((line, i) => [line, i, false, 1]));
}

export function currentLines(rawState: string): string[] {
  const state = deserialize(rawState);
  return state.filter(([, , , count]) => count % 2 === 1).map(([text]) => text);
}

export function updateState(rawState: string, lines: string[]): string {
  const state = deserialize(rawState);
  if (state.length === 0) {
    return initialState(lines);
  }

  const oldLines = state.map((s) => s[0]);
  const { deletions, insertions } = getDeletionsAndInsertions(oldLines, lines);

  // Mutable copy
  const mutable: [string, number, boolean, number][] = state.map((s) => [...s]);

  // Apply deletions
  for (const del of deletions) {
    if (mutable[del][3] % 2 === 1) {
      mutable[del][3] += 1;
    }
  }

  // Resurrect lines that are now present but were deleted
  const deletedSet = new Set(deletions);
  for (let i = 0; i < mutable.length; i++) {
    if (!deletedSet.has(i) && mutable[i][3] % 2 === 0) {
      mutable[i][3] += 1;
    }
  }

  // Apply insertions
  const result: WeaveLine[] = [];
  let posInInsertions = 0;
  for (let pos = 0; pos <= mutable.length; pos++) {
    if (posInInsertions < insertions.length && insertions[posInInsertions][0] === pos) {
      let up: boolean;
      if (pos === mutable.length) {
        up = true;
      } else if (pos === 0) {
        up = false;
      } else {
        up = mutable[pos - 1][1] > mutable[pos][1];
      }

      const newlines = insertions[posInInsertions][1];
      if (up) {
        result.push([newlines[0], mutable[pos - 1][1] + 1, false, 1]);
      } else {
        result.push([newlines[0], mutable[pos][1] + 1, true, 1]);
      }

      for (let k = 1; k < newlines.length; k++) {
        result.push([newlines[k], result[result.length - 1][1] + 1, false, 1]);
      }
      posInInsertions++;
    }
    if (pos < mutable.length) {
      result.push(mutable[pos]);
    }
  }

  return serialize(result);
}

type StatusLine = [
  text: string,
  depth: number,
  anchoredRight: boolean,
  count: number,
  onLeft: boolean,
  onRight: boolean,
];

export function mergeStates(
  state1: string,
  state2: string
): [string, string[]] {
  const tree1 = stateToTree(deserialize(state1));
  const tree2 = stateToTree(deserialize(state2));
  const statusLines: StatusLine[] = [];
  mergeTrees(statusLines, tree1, tree2, false);

  // Conflict detection
  const resultLines: [string, number][] = [];
  let begin = 0;

  for (let i = 0; i <= statusLines.length; i++) {
    if (
      i === statusLines.length ||
      (statusLines[i][4] && statusLines[i][5] && statusLines[i][0].trim() !== "")
    ) {
      let foundAdd = false;
      let hitLeft = false;
      let hitRight = false;

      for (let j = begin; j < i; j++) {
        const [, , , , onLeft, onRight] = statusLines[j];
        const inChild = statusLines[j][3] > 0; // count > 0 means alive (but we use index 3 for count in StatusLine)
        // Actually, in_child in the Python code means count%2 == 1... but wait, let me re-read.
        // Looking at the Python code more carefully:
        // statusLines format from merge_trees: (line, depth, anchored_right, count, on_left, on_right)
        // where count is already max(count1, count2) % 2
        // "in_child" in conflict detection = count (which is 0 or 1, representing alive/dead)
        const alive = statusLines[j][3]; // 0 or 1
        if (onLeft !== onRight) {
          if (alive === (onLeft ? 1 : 0)) {
            hitLeft = true;
          } else {
            hitRight = true;
          }
          // Wait, let me re-read the Python more carefully.
          // if on_left != on_right:
          //     if in_child == on_left:
          //         hit_left = True
          //     else:
          //         hit_right = True
          // Here in_child is the boolean from the output format, which corresponds to the count field
          // being truthy (non-zero). But in the merge output, count = max(c1,c2) % 2.
          // Actually no. Let me look at merge_trees output format:
          // output.append((line1, depth1, anchored_right, max(count1, count2) % 2, count1 % 2, count2 % 2))
          // So index 3 = max(c1,c2)%2 = "the merged alive state"
          // on_left = count1%2, on_right = count2%2
          // in_child = the merged alive bit
          // But in conflict detection, "in_child" refers to... let me look at the Python again.
          // The Python code has:
          //   for j in range(begin, i):
          //       line, depth, anchored_right, in_child, on_left, on_right = status_lines[j]
          // So in_child = the 4th element = max(c1,c2)%2
          // Wait no. In merge_trees/insert_tree output:
          // merge_trees: output.append((line1, depth1, anchored_right, max(count1, count2) % 2, count1 % 2, count2 % 2))
          // insert_tree: output.append((line, depth, anchored_right, count % 2, not from_right, from_right))
          // So the 4th element (index 3) is the alive bit after merge.
          // And in the conflict detection code, it's called "in_child".
          // This seems wrong naming but let me just match the behavior.
        }
        if (alive && onLeft !== onRight) {
          foundAdd = true;
        }
      }

      // Re-do the conflict detection properly matching Python
      hitLeft = false;
      hitRight = false;
      foundAdd = false;
      for (let j = begin; j < i; j++) {
        const inChild = statusLines[j][3]; // merged alive bit
        const onLeft = statusLines[j][4];
        const onRight = statusLines[j][5];
        if (onLeft !== onRight) {
          if (inChild === (onLeft ? 1 : 0)) {
            hitLeft = true;
          } else {
            hitRight = true;
          }
        }
        if (inChild && onLeft !== onRight) {
          foundAdd = true;
        }
      }

      if (hitLeft && hitRight && foundAdd) {
        for (let j = begin; j < i; j++) {
          const inChild = statusLines[j][3];
          const onLeft = statusLines[j][4];
          const onRight = statusLines[j][5];
          if (onLeft || onRight) {
            resultLines.push([statusLines[j][0], conflictCode(!!inChild, onLeft, onRight)]);
          }
        }
      } else {
        for (let j = begin; j < i; j++) {
          if (statusLines[j][3]) {
            // in_child (alive)
            resultLines.push([statusLines[j][0], PEACE]);
          }
        }
      }

      if (i < statusLines.length) {
        resultLines.push([statusLines[i][0], PEACE]);
      }
      begin = i + 1;
    }
  }

  const stateOut = serialize(
    statusLines.map(([text, depth, anchoredRight, count]) => [text, depth, anchoredRight, count])
  );
  return [stateOut, showConflicts(resultLines)];
}

// ---- Diff ----

export type Opcode = ["equal" | "delete" | "insert" | "replace", number, number, number, number];

function lcs(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const result: [number, number][] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

export function getOpcodes(a: string[], b: string[]): Opcode[] {
  const matching = lcs(a, b);
  const opcodes: Opcode[] = [];
  let ai = 0;
  let bi = 0;

  for (const [am, bm] of matching) {
    if (ai < am && bi < bm) opcodes.push(["replace", ai, am, bi, bm]);
    else if (ai < am) opcodes.push(["delete", ai, am, bi, bi]);
    else if (bi < bm) opcodes.push(["insert", ai, ai, bi, bm]);
    opcodes.push(["equal", am, am + 1, bm, bm + 1]);
    ai = am + 1;
    bi = bm + 1;
  }

  if (ai < a.length && bi < b.length) opcodes.push(["replace", ai, a.length, bi, b.length]);
  else if (ai < a.length) opcodes.push(["delete", ai, a.length, bi, bi]);
  else if (bi < b.length) opcodes.push(["insert", ai, ai, bi, b.length]);

  return opcodes;
}

export function getDeletionsAndInsertions(
  lines1: string[],
  lines2: string[]
): { deletions: number[]; insertions: [number, string[]][] } {
  const deletions: number[] = [];
  const insertions: [number, string[]][] = [];

  for (const [tag, l1Begin, l1End, l2Begin, l2End] of getOpcodes(lines1, lines2)) {
    if (tag === "delete" || tag === "replace") {
      for (let i = l1Begin; i < l1End; i++) deletions.push(i);
    }
    if (tag === "insert" || tag === "replace") {
      insertions.push([l1Begin, lines2.slice(l2Begin, l2End)]);
    }
  }

  return { deletions, insertions };
}

// ---- Tree operations ----

type WeaveTree = [
  line: string | null,
  count: number,
  lowTrees: WeaveTree[],
  highTrees: WeaveTree[],
  depth: number,
];

function stateToTree(state: WeaveState): WeaveTree {
  const n = state.length;
  const rootChildrenAbove: number[] = [];
  const childrenAbove: number[][] = Array.from({ length: n }, () => []);
  const lastByDepth: (number | null)[] = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    const [, depth, anchoredRight] = state[i];
    if (!anchoredRight) {
      if (depth === 0) {
        rootChildrenAbove.push(i);
      } else {
        childrenAbove[lastByDepth[depth - 1]!].push(i);
      }
    }
    lastByDepth[depth] = i;
  }

  const childrenBelow: number[][] = Array.from({ length: n }, () => []);
  lastByDepth.fill(null);

  for (let i = n - 1; i >= 0; i--) {
    const [, depth, anchoredRight] = state[i];
    if (anchoredRight) {
      childrenBelow[lastByDepth[depth - 1]!].push(i);
    }
    lastByDepth[depth] = i;
  }

  for (const cb of childrenBelow) {
    cb.reverse();
  }

  return [
    null,
    -1,
    [],
    rootChildrenAbove.map((i) => pullOutTree(i, state, childrenAbove, childrenBelow)),
    -1,
  ];
}

function pullOutTree(
  pos: number,
  state: WeaveState,
  childrenAbove: number[][],
  childrenBelow: number[][]
): WeaveTree {
  const [line, , , count] = state[pos];
  const depth = state[pos][1];
  return [
    line,
    count,
    childrenBelow[pos].map((x) => pullOutTree(x, state, childrenAbove, childrenBelow)),
    childrenAbove[pos].map((x) => pullOutTree(x, state, childrenAbove, childrenBelow)),
    depth,
  ];
}

function mergeTrees(
  output: StatusLine[],
  tree1: WeaveTree,
  tree2: WeaveTree,
  anchoredRight: boolean
): void {
  const [line1, count1, lowTrees1, highTrees1, depth1] = tree1;
  const [, count2, lowTrees2, highTrees2] = tree2;

  mergeTreeLists(output, lowTrees1, lowTrees2, true);
  if (line1 !== null) {
    output.push([
      line1,
      depth1,
      anchoredRight,
      Math.max(count1, count2) % 2,
      count1 % 2 === 1,
      count2 % 2 === 1,
    ]);
  }
  mergeTreeLists(output, highTrees1, highTrees2, false);
}

function mergeTreeLists(
  output: StatusLine[],
  leftTrees: WeaveTree[],
  rightTrees: WeaveTree[],
  anchoredRight: boolean
): void {
  let pos1 = 0;
  let pos2 = 0;
  while (pos1 < leftTrees.length || pos2 < rightTrees.length) {
    if (pos2 === rightTrees.length) {
      insertTree(output, leftTrees[pos1], false, anchoredRight);
      pos1++;
    } else if (pos1 === leftTrees.length) {
      insertTree(output, rightTrees[pos2], true, anchoredRight);
      pos2++;
    } else if (leftTrees[pos1][0] === rightTrees[pos2][0]) {
      mergeTrees(output, leftTrees[pos1], rightTrees[pos2], anchoredRight);
      pos1++;
      pos2++;
    } else if (leftTrees[pos1][0]! < rightTrees[pos2][0]!) {
      insertTree(output, leftTrees[pos1], false, anchoredRight);
      pos1++;
    } else {
      insertTree(output, rightTrees[pos2], true, anchoredRight);
      pos2++;
    }
  }
}

function insertTree(
  output: StatusLine[],
  tree: WeaveTree,
  fromRight: boolean,
  anchoredRight: boolean
): void {
  const [line, count, lowTrees, highTrees, depth] = tree;
  for (const newTree of lowTrees) {
    insertTree(output, newTree, fromRight, true);
  }
  output.push([line!, depth, anchoredRight, count % 2, !fromRight, fromRight]);
  for (const newTree of highTrees) {
    insertTree(output, newTree, fromRight, false);
  }
}

// ---- Conflict display ----

function conflictCode(inChild: boolean, onLeft: boolean, onRight: boolean): number {
  if (inChild) {
    if (onLeft && onRight) return CONFLICT_ADDED_BOTH;
    if (onLeft) return CONFLICT_ADDED_LEFT;
    return CONFLICT_ADDED_RIGHT;
  }
  if (onRight) return CONFLICT_DELETED_LEFT;
  return CONFLICT_DELETED_RIGHT;
}

function showConflicts(resultLines: [string, number][]): string[] {
  const finalResult: string[] = [];
  let lastState = PEACE;

  for (const [line, newState] of resultLines) {
    if (newState === PEACE) {
      if (lastState !== PEACE) {
        finalResult.push(END);
      }
    } else if (lastState === PEACE) {
      finalResult.push(`<<<<<<< begin ${CONFLICT_STRINGS[newState]}`);
    } else if (lastState !== newState) {
      finalResult.push(`======= begin ${CONFLICT_STRINGS[newState]}`);
    }
    finalResult.push(line);
    lastState = newState;
  }

  if (lastState !== PEACE) {
    finalResult.push(END);
  }

  return finalResult;
}
