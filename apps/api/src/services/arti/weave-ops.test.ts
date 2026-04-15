import { describe, it, expect } from "vitest";
import {
  applyUpdate,
  currentLines,
  emptyWeave,
  serializeWeave,
  deserializeWeave,
  type IdentifiedWeave,
  type WeaveOp,
} from "./weave-ops.js";
import {
  initialState,
  updateState,
  deserialize as deserializeOld,
  currentLines as currentLinesOld,
} from "./weave.js";

// A deterministic line-id generator for reproducible tests
function makeGen(): () => string {
  let i = 0;
  return () => `L${++i}`;
}

describe("weave-ops", () => {
  describe("applyUpdate", () => {
    it("first write produces insert ops only, matching initialState", () => {
      const { next, ops } = applyUpdate(emptyWeave(), ["a", "b", "c"], makeGen());
      expect(ops.every((o) => o.type === "insert")).toBe(true);
      expect(ops.length).toBe(3);
      expect(currentLines(next)).toEqual(["a", "b", "c"]);
      // Depth/anchor should match weave.ts initialState
      const oldParsed = deserializeOld(initialState(["a", "b", "c"]));
      expect(next.map((l) => [l.text, l.depth, l.anchoredRight, l.count])).toEqual(
        oldParsed.map((w) => [w[0], w[1], w[2], w[3]])
      );
    });

    it("deletion emits toggle and hides the line", () => {
      const step1 = applyUpdate(emptyWeave(), ["a", "b"], makeGen());
      const step2 = applyUpdate(step1.next, ["a"], makeGen());
      expect(step2.ops).toEqual([{ type: "toggle", lineId: expect.any(String) }]);
      expect(currentLines(step2.next)).toEqual(["a"]);
      // b is still in the weave, but dead
      expect(step2.next.length).toBe(2);
      const b = step2.next.find((l) => l.text === "b");
      expect(b).toBeDefined();
      expect(b!.count % 2).toBe(0);
    });

    it("re-adding deleted text resurrects the same lineId", () => {
      const gen = makeGen();
      const step1 = applyUpdate(emptyWeave(), ["a", "b"], gen);
      const step2 = applyUpdate(step1.next, ["a"], gen);
      const step3 = applyUpdate(step2.next, ["a", "b"], gen);

      expect(step3.ops.length).toBe(1);
      expect(step3.ops[0].type).toBe("toggle");
      expect(currentLines(step3.next)).toEqual(["a", "b"]);
      // Same lineId for "b" across all three steps
      const bInStep1 = step1.next.find((l) => l.text === "b")!.lineId;
      const bInStep3 = step3.next.find((l) => l.text === "b")!.lineId;
      expect(bInStep3).toBe(bInStep1);
    });

    it("insert in the middle produces anchored insert", () => {
      const step1 = applyUpdate(emptyWeave(), ["a", "c"], makeGen());
      const step2 = applyUpdate(step1.next, ["a", "b", "c"], makeGen());
      expect(currentLines(step2.next)).toEqual(["a", "b", "c"]);
      const inserts = step2.ops.filter((o): o is Extract<WeaveOp, { type: "insert" }> => o.type === "insert");
      expect(inserts.length).toBe(1);
      expect(inserts[0].text).toBe("b");
    });

    it("serialize / deserialize round-trip", () => {
      const { next } = applyUpdate(emptyWeave(), ["x", "y"], makeGen());
      const raw = serializeWeave(next);
      const back = deserializeWeave(raw);
      expect(back).toEqual(next);
    });

    it("matches weave.ts updateState over a random sequence (ignoring lineId)", () => {
      const sequences: string[][] = [
        ["a", "b", "c"],
        ["a", "c"],
        ["a", "b", "c"],
        ["a", "b"],
        ["a", "b", "c", "d"],
        ["d", "a", "b", "c"],
        [],
        ["z"],
      ];
      let identified: IdentifiedWeave = emptyWeave();
      let oldRaw = "";
      for (const target of sequences) {
        const res = applyUpdate(identified, target, makeGen());
        identified = res.next;
        oldRaw = oldRaw === "" ? initialState(target) : updateState(oldRaw, target);

        // Compare visible content
        expect(currentLines(identified)).toEqual(currentLinesOld(oldRaw));

        // Compare full weave structure (text/depth/anchor/count), ignoring lineId
        const oldWeave = deserializeOld(oldRaw);
        expect(
          identified.map((l) => [l.text, l.depth, l.anchoredRight, l.count])
        ).toEqual(oldWeave.map((w) => [w[0], w[1], w[2], w[3]]));
      }
    });
  });
});
