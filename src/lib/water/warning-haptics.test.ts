import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it("buzzes once for a batch of new Android warnings and persists ids across visits", async () => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value) });
  const vibrate = vi.fn().mockReturnValue(true);
  vi.stubGlobal("navigator", { userAgent: "Android", vibrate });
  let { buzzNewWarnings } = await import("./warning-haptics");
  buzzNewWarnings(["a", "b"]); buzzNewWarnings(["b", "a"]);
  expect(vibrate).toHaveBeenCalledExactlyOnceWith(35);
  vi.resetModules(); ({ buzzNewWarnings } = await import("./warning-haptics"));
  buzzNewWarnings(["a", "b"]); expect(vibrate).toHaveBeenCalledOnce();
  buzzNewWarnings(["b", "c"]); expect(vibrate).toHaveBeenCalledTimes(2);
});

it("survives denied storage and remembers ids for the visit", async () => {
  vi.stubGlobal("localStorage", { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } });
  const vibrate = vi.fn().mockReturnValue(true);
  vi.stubGlobal("navigator", { userAgent: "Android", vibrate });
  const { buzzNewWarnings } = await import("./warning-haptics");
  expect(() => { buzzNewWarnings(["a"]); buzzNewWarnings(["a"]); }).not.toThrow();
  expect(vibrate).toHaveBeenCalledOnce();
});

it("does nothing on iOS, without support, or without warnings", async () => {
  const vibrate = vi.fn();
  const { buzzNewWarnings } = await import("./warning-haptics");
  vi.stubGlobal("navigator", { userAgent: "iPhone", vibrate }); buzzNewWarnings(["a"]);
  vi.stubGlobal("navigator", { userAgent: "Android" }); buzzNewWarnings(["a"]);
  vi.stubGlobal("navigator", { userAgent: "Android", vibrate }); buzzNewWarnings([]);
  expect(vibrate).not.toHaveBeenCalled();
});
