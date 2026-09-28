import { describe, expect, it } from "vitest";
import { levelToRgba, rgbaToLevel } from "../nowcast/intensity";
import { pm25Level } from "../air";
import { contrastRatio, DATA, PM25_COLORS, RAIN_RAMP, TEMP_STOPS, pm25Color, tempColor, windColor } from "./palette";

describe("rain ramp", () => {
  it("matches RainViewer scheme 2 and round-trips every intensity level", () => {
    expect(RAIN_RAMP).toEqual(["rgba(0, 0, 0, 0)", "#88ddee", "#0077aa", "#ffee00", "#ff4400"]);
    for (let level = 0; level <= 4; level++) {
      expect(rgbaToLevel(...levelToRgba(level))).toBe(level);
    }
  });
});

describe("temperature palette", () => {
  it("uses the agreed stops, clamps the ends, and interpolates RGB channels", () => {
    expect(TEMP_STOPS).toEqual([
      [15, "#4a7bd0"], [20, "#4fb3c9"], [25, "#7cc86f"],
      [30, "#f2d24b"], [35, "#f0913a"], [40, "#d6453d"],
    ]);
    for (const [temperature, color] of TEMP_STOPS) expect(tempColor(temperature)).toBe(color);
    expect(tempColor(-10)).toBe("#4a7bd0");
    expect(tempColor(50)).toBe("#d6453d");
    expect(tempColor(17.5)).toBe("#4d97cd");
  });
});

describe("PM2.5 palette", () => {
  it("uses pm25Level at every threshold", () => {
    expect(PM25_COLORS).toEqual({
      "very-good": "#3bccff", good: "#92d050", moderate: "#ffff00",
      "starting-to-affect": "#ffa200", "affects-health": "#f04646",
    });
    for (const [value, level] of [
      [0, "very-good"], [15, "very-good"], [15.1, "good"], [25, "good"],
      [25.1, "moderate"], [37.5, "moderate"], [37.6, "starting-to-affect"],
      [75, "starting-to-affect"], [75.1, "affects-health"],
    ] as const) {
      expect(pm25Level(value)).toBe(level);
      expect(pm25Color(value)).toBe(PM25_COLORS[level]);
    }
  });
});

describe("shared data colours", () => {
  it("uses the agreed storm, quake, and pin colours", () => {
    expect(DATA).toEqual({ storm: "#e5484d", stormHalo: "#ffffff", quake: "#f59e0b", quakeHalo: "#ffffff", pin: "#2563eb" });
  });

  it.each([
    [2.99, "rgba(90, 110, 140, 0.55)"], [3, "rgba(60, 90, 130, 0.8)"],
    [7.99, "rgba(60, 90, 130, 0.8)"], [8, "rgba(217, 119, 6, 0.9)"],
    [13.99, "rgba(217, 119, 6, 0.9)"], [14, "rgba(220, 38, 38, 0.95)"],
  ])("uses the agreed wind bucket at %s m/s", (speed, color) => {
    expect(windColor(speed)).toBe(color);
  });
});

describe("contrastRatio", () => {
  it("uses WCAG relative luminance", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });
});
