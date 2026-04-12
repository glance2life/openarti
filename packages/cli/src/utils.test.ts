import { describe, it, expect } from "vitest";
import { parsePath, parseCollectionPath } from "./utils.js";

describe("parsePath", () => {
  it("parses owner/collection/file", () => {
    expect(parsePath("nestor/docs/hello.md")).toEqual({
      owner: "nestor",
      collection: "docs",
      path: "hello.md",
    });
  });

  it("parses nested path", () => {
    expect(parsePath("nestor/docs/src/lib/index.ts")).toEqual({
      owner: "nestor",
      collection: "docs",
      path: "src/lib/index.ts",
    });
  });

  it("throws on owner only", () => {
    expect(() => parsePath("nestor")).toThrow("owner/collection/path");
  });

  it("throws on owner/collection without file", () => {
    expect(() => parsePath("nestor/docs")).toThrow("owner/collection/path");
  });
});

describe("parseCollectionPath", () => {
  it("parses owner/collection", () => {
    expect(parseCollectionPath("nestor/docs")).toEqual({
      owner: "nestor",
      collection: "docs",
      path: undefined,
    });
  });

  it("parses owner/collection/path", () => {
    expect(parseCollectionPath("nestor/docs/src/lib")).toEqual({
      owner: "nestor",
      collection: "docs",
      path: "src/lib",
    });
  });

  it("throws on single segment", () => {
    expect(() => parseCollectionPath("nestor")).toThrow("owner/collection");
  });
});
