import { afterEach, describe, expect, it, vi } from "vitest";
import { completeMenuTip, shouldShowMenuTip } from "./menu-tip";

afterEach(() => vi.unstubAllGlobals());

describe("menu tip storage", () => {
  it("shows once and stays dismissed after completion", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    });

    expect(shouldShowMenuTip()).toBe(true);
    completeMenuTip();
    expect(shouldShowMenuTip()).toBe(false);
  });

  it("does not show if storage cannot be read", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(shouldShowMenuTip()).toBe(false);
  });

  it("can close when storage cannot be written", () => {
    vi.stubGlobal("localStorage", { setItem: () => { throw new Error("blocked"); } });
    expect(() => completeMenuTip()).not.toThrow();
  });
});
