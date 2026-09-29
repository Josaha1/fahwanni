import { describe, expect, it } from "vitest";
import { RAIN_RAMP } from "../map/palette";
import { MAP_MIN_PROB, MIN_PROB, precipLevel, probabilityRgba, radarFilteredColor, rainModeAt, rainRgba } from "./render";

describe("rain mode", () => {
  it.each([
    [0, "blend"], [60 * 60_000, "blend"], [60 * 60_000 + 1, "intensity"],
    [48 * 60 * 60_000, "intensity"], [48 * 60 * 60_000 + 1, "probability"],
  ] as const)("selects %s ms as %s", (lead, mode) => expect(rainModeAt(lead)).toBe(mode));
});

describe("radar-matched colours", () => {
  it("applies MapLibre's saturation and contrast factors to each ramp stop", () => {
    const expected = [[98, 252, 255], [0, 132, 224], [255, 255, 0], [255, 32, 0]];
    RAIN_RAMP.slice(1).forEach((hex, index) => expect(radarFilteredColor(hex)).toEqual(expected[index]));
  });

  it("interpolates RGB continuously between radar-filtered stops", () => {
    const lower = radarFilteredColor(RAIN_RAMP[1]);
    const upper = radarFilteredColor(RAIN_RAMP[2]);
    expect(rainRgba(0.65, 80, "intensity").slice(0, 3))
      .toEqual(lower.map((channel, index) => Math.round((channel + upper[index]) / 2)));
    expect(rainRgba(1, 80, "intensity").slice(0, 3)).toEqual(upper);
    expect(rainRgba(4, 80, "intensity").slice(0, 3)).toEqual(radarFilteredColor(RAIN_RAMP[3]));
    expect(rainRgba(20, 80, "intensity").slice(0, 3)).toEqual(radarFilteredColor(RAIN_RAMP[4]));
  });
});

describe("map rain alpha", () => {
  it("keeps the strip threshold and hides map rain below 40 percent or 0.3 mm/h", () => {
    expect(MIN_PROB).toBe(30);
    expect(MAP_MIN_PROB).toBe(40);
    expect(rainRgba(2, 39.99, "intensity")).toEqual([0, 0, 0, 0]);
    expect(rainRgba(0.3, 80, "intensity")).toEqual([0, 0, 0, 0]);
  });

  it("fades intensity from zero at 0.3 to 60 percent at 0.8 mm/h and caps it", () => {
    expect(rainRgba(0.55, 40, "blend")[3]).toBe(Math.round(0.3 * 255));
    expect(rainRgba(0.8, 40, "intensity")[3]).toBe(Math.round(0.6 * 255));
    expect(rainRgba(10, 100, "intensity")[3]).toBe(Math.round(0.6 * 255));
  });

  it("uses one blue hue with three probability alpha steps", () => {
    const blue = radarFilteredColor(RAIN_RAMP[2]);
    expect(probabilityRgba(39.99)).toEqual([0, 0, 0, 0]);
    for (const [chance, alpha] of [[40, 0.15], [70, 0.325], [100, 0.5], [120, 0.5]]) {
      expect(probabilityRgba(chance)).toEqual([...blue, Math.round(alpha * 255)]);
      expect(rainRgba(0, chance, "probability")).toEqual(probabilityRgba(chance));
    }
  });
});

describe("existing strip bins", () => {
  it.each([[0.05, 0], [0.29, 0], [0.5, 1], [2, 2], [6, 3], [15, 4]])("%s mm → level %s", (mm, level) => expect(precipLevel(mm)).toBe(level));
});
