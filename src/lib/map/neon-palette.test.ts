import { describe, expect, it } from "vitest";
import { contrastRatio, NEON, RAIN_RAMP, rainLegendGradient, windColor } from "./neon-palette";

describe("neon contrast", () => {
  it.each([
    ["label on halo", NEON.label, NEON.halo, 4.5],
    ["label on background", NEON.label, NEON.bg, 4.5],
    ["muted label on background", NEON.labelMuted, NEON.bg, 3],
    ["border on background", NEON.border, NEON.bg, 3],
  ])("keeps %s above %s:1", (_name, foreground, background, minimum) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(minimum);
  });

  it("uses WCAG relative luminance", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
    expect(contrastRatio("#123456", "#123456")).toBe(1);
  });
});

describe("rain ramp", () => {
  it("has transparent dry level and four visible levels", () => {
    expect(RAIN_RAMP).toHaveLength(5);
    expect(RAIN_RAMP[0]).toBe("rgba(0, 0, 0, 0)");
  });

  it("puts every visible level in the legend gradient", () => {
    const gradient = rainLegendGradient();
    expect(gradient).toMatch(/^linear-gradient\(to right, /);
    for (const stop of RAIN_RAMP.slice(1)) expect(gradient).toContain(stop);
  });
});

describe("windColor", () => {
  it.each([
    [0, "rgba(56, 232, 255, 0.45)"],
    [3, "rgba(56, 232, 255, 0.8)"],
    [8, "rgba(255, 201, 40, 0.9)"],
    [14, "rgba(255, 61, 242, 0.95)"],
  ])("uses the correct bucket at %s m/s", (speed, color) => {
    expect(windColor(speed)).toBe(color);
  });
});
