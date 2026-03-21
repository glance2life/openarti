import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveContext } from "./api-client.js";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveContext", () => {
  it("uses defaults when nothing is set", () => {
    const ctx = resolveContext({});
    expect(ctx.endpoint).toBe("https://api.openarti.dev");
    expect(ctx.token).toBeUndefined();
  });

  it("--endpoint takes highest priority", () => {
    vi.stubEnv("OPENARTI_ENDPOINT", "http://env.dev");

    const ctx = resolveContext({ endpoint: "http://flag.dev" });
    expect(ctx.endpoint).toBe("http://flag.dev");
  });

  it("OPENARTI_ENDPOINT takes priority over default", () => {
    vi.stubEnv("OPENARTI_ENDPOINT", "http://env.dev");

    const ctx = resolveContext({});
    expect(ctx.endpoint).toBe("http://env.dev");
  });

  it("--token takes highest priority", () => {
    vi.stubEnv("OPENARTI_TOKEN", "env_token");

    const ctx = resolveContext({ token: "flag_token" });
    expect(ctx.token).toBe("flag_token");
  });

  it("OPENARTI_TOKEN is used when no flag", () => {
    vi.stubEnv("OPENARTI_TOKEN", "env_token");

    const ctx = resolveContext({});
    expect(ctx.token).toBe("env_token");
  });
});
