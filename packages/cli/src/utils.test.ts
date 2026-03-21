import { describe, it, expect } from "vitest";
import { parsePath, parseRepoPath } from "./utils.js";

describe("parsePath", () => {
  it("parses owner/repo/file", () => {
    expect(parsePath("nestor/docs/hello.md")).toEqual({
      owner: "nestor",
      repo: "docs",
      path: "hello.md",
    });
  });

  it("parses nested path", () => {
    expect(parsePath("nestor/docs/src/lib/index.ts")).toEqual({
      owner: "nestor",
      repo: "docs",
      path: "src/lib/index.ts",
    });
  });

  it("throws on owner only", () => {
    expect(() => parsePath("nestor")).toThrow("owner/repo/path");
  });

  it("throws on owner/repo without file", () => {
    expect(() => parsePath("nestor/docs")).toThrow("owner/repo/path");
  });
});

describe("parseRepoPath", () => {
  it("parses owner/repo", () => {
    expect(parseRepoPath("nestor/docs")).toEqual({
      owner: "nestor",
      repo: "docs",
      path: undefined,
    });
  });

  it("parses owner/repo/path", () => {
    expect(parseRepoPath("nestor/docs/src/lib")).toEqual({
      owner: "nestor",
      repo: "docs",
      path: "src/lib",
    });
  });

  it("throws on single segment", () => {
    expect(() => parseRepoPath("nestor")).toThrow("owner/repo");
  });
});
