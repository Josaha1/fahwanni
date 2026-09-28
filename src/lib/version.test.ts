import { describe, expect, it } from "vitest";
import { shouldReload } from "./version";

describe("shouldReload", () => {
  it("reloads when the server build differs and no sheet is open", () => {
    expect(shouldReload({ current: "a1", latest: "b2", sheetOpen: false })).toBe(true);
  });
  it("waits while a sheet is open", () => {
    expect(shouldReload({ current: "a1", latest: "b2", sheetOpen: true })).toBe(false);
  });
  it("does nothing for the same build or unknown ids", () => {
    expect(shouldReload({ current: "a1", latest: "a1", sheetOpen: false })).toBe(false);
    expect(shouldReload({ current: undefined, latest: "b2", sheetOpen: false })).toBe(false);
    expect(shouldReload({ current: "a1", latest: null, sheetOpen: false })).toBe(false);
  });
});
