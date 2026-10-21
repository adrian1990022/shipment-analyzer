import { afterEach, describe, expect, it, vi } from "vitest";

describe("appVersion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("format: v<wersja> · <commit>", async () => {
    vi.stubGlobal("__APP_VERSION__", "1.2.3");
    vi.stubGlobal("__APP_RELEASE__", "a1b2c3d");
    const { APP_VERSION_LABEL, formatAppVersion } = await import("./appVersion");

    expect(formatAppVersion("0.1.0", "beeca42")).toBe("v0.1.0 · beeca42");
    expect(APP_VERSION_LABEL).toBe("v1.2.3 · a1b2c3d");
  });
});
