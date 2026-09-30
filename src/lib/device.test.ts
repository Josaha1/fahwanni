import { describe, expect, it } from "vitest";
import { liteDefault } from "./device";

describe("liteDefault", () => {
  const normal = { reducedMotion: false, saveData: false, deviceMemory: 8, cores: 8 };

  it("enables lite mode for each constrained signal and at both hardware boundaries", () => {
    expect(liteDefault({ ...normal, reducedMotion: true })).toBe(true);
    expect(liteDefault({ ...normal, saveData: true })).toBe(true);
    expect(liteDefault({ ...normal, deviceMemory: 4 })).toBe(true);
    expect(liteDefault({ ...normal, cores: 4 })).toBe(true);
  });

  it("ignores unavailable hardware values and keeps capable devices in normal mode", () => {
    expect(liteDefault(normal)).toBe(false);
    expect(liteDefault({ reducedMotion: false, saveData: false })).toBe(false);
  });
});
