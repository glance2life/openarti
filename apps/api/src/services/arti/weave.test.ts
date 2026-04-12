import { describe, it, expect } from "vitest";
import {
  initialState,
  currentLines,
  updateState,
  mergeStates,
} from "./weave.js";

// ---- Helpers ported from manyana.py ----

function swapLeftRight(s: string): string {
  return s.replace(/left/g, "SWAP").replace(/right/g, "left").replace(/SWAP/g, "right");
}

function checkMerges(
  thing1: string,
  thing2: string,
  expectedResult: string[],
  expectedConflicts?: string[]
) {
  const [state1, conflicts1] = mergeStates(thing1, thing2);
  const [state2, conflicts2] = mergeStates(thing2, thing1);
  expect(state1).toBe(state2);

  if (expectedConflicts === undefined) {
    expect(conflicts1).toEqual(conflicts2);
    expect(conflicts1).toEqual(expectedResult);
  } else {
    expect(conflicts1).toEqual(expectedConflicts);
    expect(conflicts2).toEqual(expectedConflicts.map(swapLeftRight));
  }
  expect(currentLines(state1)).toEqual(expectedResult);
}

// Conflict marker shortcuts
const SAL = "<<<<<<< begin added left";
const SAR = "<<<<<<< begin added right";
const SAB = "<<<<<<< begin added both";
const SDL = "<<<<<<< begin deleted left";
const SDR = "<<<<<<< begin deleted right";
const MAL = "======= begin added left";
const MAR = "======= begin added right";
const MAB = "======= begin added both";
const MDL = "======= begin deleted left";
const MDR = "======= begin deleted right";
const END = ">>>>>>> end conflict";

// ---- Tests ----

describe("weave", () => {
  it("initial", () => {
    expect(initialState([])).toBe("");
    expect(currentLines("")).toEqual([]);

    const v1 = initialState(["line 1", "line 4"]);
    const v2 = initialState(["line 2", "line 3"]);
    const [state1, output1] = mergeStates(v1, v2);
    const [state2, output2] = mergeStates(v2, v1);
    expect(state1).toBe(state2);
    expect(currentLines(state1)).toEqual(["line 1", "line 4", "line 2", "line 3"]);
  });

  it("bottom and top", () => {
    const initial = initialState(["A"]);
    const insertBelow = updateState(initial, ["B", "A"]);
    const replaceBelow = updateState(insertBelow, ["B"]);
    const insertAbove = updateState(initial, ["A", "B"]);
    const replaceAbove = updateState(insertAbove, ["B"]);
    const del = updateState(initial, []);

    checkMerges(initial, initial, ["A"]);
    checkMerges(initial, insertBelow, ["B", "A"]);
    checkMerges(initial, replaceBelow, ["B"]);
    checkMerges(initial, insertAbove, ["A", "B"]);
    checkMerges(initial, replaceAbove, ["B"]);
    checkMerges(initial, del, []);

    checkMerges(insertBelow, insertBelow, ["B", "A"]);
    checkMerges(insertBelow, replaceBelow, ["B"]);
    checkMerges(insertBelow, insertAbove, ["B", "A", "B"]);
    checkMerges(insertBelow, replaceAbove, ["B", "B"], [SAL, "B", MDR, "A", MAR, "B", END]);
    checkMerges(insertBelow, del, ["B"], [SAL, "B", MDR, "A", END]);

    checkMerges(replaceBelow, replaceBelow, ["B"]);
    checkMerges(replaceBelow, insertAbove, ["B", "B"], [SAL, "B", MDL, "A", MAR, "B", END]);
    checkMerges(replaceBelow, replaceAbove, ["B", "B"], [SAL, "B", MAR, "B", END]);
    checkMerges(replaceBelow, del, ["B"]);

    checkMerges(insertAbove, insertAbove, ["A", "B"]);
    checkMerges(insertAbove, replaceAbove, ["B"]);
    checkMerges(insertAbove, del, ["B"], [SDR, "A", MAL, "B", END]);

    checkMerges(replaceAbove, replaceAbove, ["B"]);
    checkMerges(replaceAbove, del, ["B"]);

    checkMerges(del, del, []);
  });

  it("bottom", () => {
    const initial = initialState(["A", "X"]);
    const insertBelow = updateState(initial, ["B", "A", "X"]);
    const replaceBelow = updateState(insertBelow, ["B", "X"]);
    const insertAbove = updateState(initial, ["A", "B", "X"]);
    const replaceAbove = updateState(insertAbove, ["B", "X"]);
    const del = updateState(initial, ["X"]);

    checkMerges(initial, initial, ["A", "X"]);
    checkMerges(initial, insertBelow, ["B", "A", "X"]);
    checkMerges(initial, replaceBelow, ["B", "X"]);
    checkMerges(initial, insertAbove, ["A", "B", "X"]);
    checkMerges(initial, replaceAbove, ["B", "X"]);
    checkMerges(initial, del, ["X"]);

    checkMerges(insertBelow, insertBelow, ["B", "A", "X"]);
    checkMerges(insertBelow, replaceBelow, ["B", "X"]);
    checkMerges(insertBelow, insertAbove, ["B", "A", "B", "X"]);
    checkMerges(insertBelow, replaceAbove, ["B", "B", "X"], [SAL, "B", MDR, "A", MAR, "B", END, "X"]);
    checkMerges(insertBelow, del, ["B", "X"], [SAL, "B", MDR, "A", END, "X"]);

    checkMerges(replaceBelow, replaceBelow, ["B", "X"]);
    checkMerges(replaceBelow, insertAbove, ["B", "B", "X"], [SAL, "B", MDL, "A", MAR, "B", END, "X"]);
    checkMerges(replaceBelow, replaceAbove, ["B", "B", "X"], [SAL, "B", MAR, "B", END, "X"]);
    checkMerges(replaceBelow, del, ["B", "X"]);

    checkMerges(insertAbove, insertAbove, ["A", "B", "X"]);
    checkMerges(insertAbove, replaceAbove, ["B", "X"]);
    checkMerges(insertAbove, del, ["B", "X"], [SDR, "A", MAL, "B", END, "X"]);

    checkMerges(replaceAbove, replaceAbove, ["B", "X"]);
    checkMerges(replaceAbove, del, ["B", "X"]);

    checkMerges(del, del, ["X"]);
  });

  it("top", () => {
    const initial = initialState(["X", "A"]);
    const insertBelow = updateState(initial, ["X", "B", "A"]);
    const replaceBelow = updateState(insertBelow, ["X", "B"]);
    const insertAbove = updateState(initial, ["X", "A", "B"]);
    const replaceAbove = updateState(insertAbove, ["X", "B"]);
    const del = updateState(initial, ["X"]);

    checkMerges(initial, initial, ["X", "A"]);
    checkMerges(initial, insertBelow, ["X", "B", "A"]);
    checkMerges(initial, replaceBelow, ["X", "B"]);
    checkMerges(initial, insertAbove, ["X", "A", "B"]);
    checkMerges(initial, replaceAbove, ["X", "B"]);
    checkMerges(initial, del, ["X"]);

    checkMerges(insertBelow, insertBelow, ["X", "B", "A"]);
    checkMerges(insertBelow, replaceBelow, ["X", "B"]);
    checkMerges(insertBelow, insertAbove, ["X", "B", "A", "B"]);
    checkMerges(insertBelow, replaceAbove, ["X", "B", "B"], ["X", SAL, "B", MDR, "A", MAR, "B", END]);
    checkMerges(insertBelow, del, ["X", "B"], ["X", SAL, "B", MDR, "A", END]);

    checkMerges(replaceBelow, replaceBelow, ["X", "B"]);
    checkMerges(replaceBelow, insertAbove, ["X", "B", "B"], ["X", SAL, "B", MDL, "A", MAR, "B", END]);
    checkMerges(replaceBelow, replaceAbove, ["X", "B", "B"], ["X", SAL, "B", MAR, "B", END]);
    checkMerges(replaceBelow, del, ["X", "B"]);

    checkMerges(insertAbove, insertAbove, ["X", "A", "B"]);
    checkMerges(insertAbove, replaceAbove, ["X", "B"]);
    checkMerges(insertAbove, del, ["X", "B"], ["X", SDR, "A", MAL, "B", END]);

    checkMerges(replaceAbove, replaceAbove, ["X", "B"]);
    checkMerges(replaceAbove, del, ["X", "B"]);

    checkMerges(del, del, ["X"]);
  });

  it("generation counting", () => {
    const count0 = initialState([]);
    const count1 = updateState(count0, ["A"]);
    const count2 = updateState(count1, []);
    const count3 = updateState(count2, ["A"]);
    const count4 = updateState(count3, []);

    checkMerges(count0, count1, ["A"]);
    checkMerges(count0, count2, []);
    checkMerges(count0, count3, ["A"]);
    checkMerges(count0, count4, []);
    checkMerges(count1, count1, ["A"]);
    checkMerges(count1, count2, []);
    checkMerges(count1, count3, ["A"]);
    checkMerges(count1, count4, []);
    checkMerges(count2, count2, []);
    checkMerges(count2, count3, ["A"]);
    checkMerges(count2, count4, []);
    checkMerges(count3, count3, ["A"]);
    checkMerges(count3, count4, []);
    checkMerges(count4, count4, []);
  });

  it("insertions (permutations)", () => {
    const mylist = ["A", "B", "C", "D"].map((x) => initialState([x]));
    // Test one ordering (all permutations would be too many)
    const [s1] = mergeStates(mylist[0], mylist[1]);
    const [s2] = mergeStates(mylist[2], mylist[3]);
    const [s3] = mergeStates(s1, s2);
    expect(currentLines(s3)).toEqual(["A", "B", "C", "D"]);
  });

  it("insertions below (permutations)", () => {
    const initial = initialState(["X"]);
    const mylist = ["A", "B", "C", "D"].map((x) => updateState(initial, [x, "X"]));
    const [s1] = mergeStates(mylist[0], mylist[1]);
    const [s2] = mergeStates(mylist[2], mylist[3]);
    const [s3] = mergeStates(s1, s2);
    expect(currentLines(s3)).toEqual(["A", "B", "C", "D", "X"]);
  });

  it("space separated insert-insert", () => {
    const initial = initialState([""]);
    const insertLeft = updateState(initial, ["A", ""]);
    const insertRight = updateState(initial, ["", "B"]);
    checkMerges(insertLeft, insertRight, ["A", "", "B"], [SAL, "A", MAB, "", MAR, "B", END]);
  });

  it("space separated insert-delete", () => {
    const initial = initialState(["", "B"]);
    const insertLeft = updateState(initial, ["A", "", "B"]);
    const deleteRight = updateState(initial, [""]);
    checkMerges(insertLeft, deleteRight, ["A", ""], [SAL, "A", MAB, "", MDR, "B", END]);
  });

  it("space separated delete-insert", () => {
    const initial = initialState(["A", ""]);
    const deleteLeft = updateState(initial, [""]);
    const insertRight = updateState(initial, ["A", "", "B"]);
    checkMerges(deleteLeft, insertRight, ["", "B"], [SDL, "A", MAB, "", MAR, "B", END]);
  });

  it("space separated delete-delete", () => {
    const initial = initialState(["A", "", "B"]);
    const deleteLeft = updateState(initial, ["", "B"]);
    const deleteRight = updateState(initial, ["A", ""]);
    checkMerges(deleteLeft, deleteRight, [""]);
  });

  it("deleted both", () => {
    const initial = initialState(["", "X", ""]);
    const left = updateState(initial, ["A", "", ""]);
    const right = updateState(initial, ["", "", "B"]);
    checkMerges(left, right, ["A", "", "", "B"], [SAL, "A", MAB, "", "", MAR, "B", END]);
  });

  it("deleted both 2", () => {
    const initial = initialState(["A"]);
    let left = updateState(initial, ["X", "A"]);
    left = updateState(left, ["X"]);
    const right = updateState(initial, ["Y"]);
    checkMerges(left, right, ["X", "Y"], [SAL, "X", MAR, "Y", END]);
  });

  it("update insert multiple", () => {
    const initial = initialState(["A", "B"]);
    const updated = updateState(initial, ["A", "X", "Y", "B"]);
    expect(currentLines(updated)).toEqual(["A", "X", "Y", "B"]);
  });

  it("insert low tree", () => {
    const initial = initialState(["A"]);
    let updated = updateState(initial, ["Y", "A"]);
    updated = updateState(updated, ["X", "Y", "A"]);
    const right = updateState(initial, ["A", "B"]);
    checkMerges(updated, right, ["X", "Y", "A", "B"]);
  });
});
