import { describe, expect, it } from "vitest";
import { imageToLevels, levelsToRgba, levelToRgba, rainFraction, rgbaToLevel } from "./intensity";
import { classifyPixel } from "../radar/summary";


/** A graded blob (level 4 core → 1 edge) centred at (cx, cy). */

describe("intensity", () => {
  it("agrees with classifyPixel on rain / heavy", () => {
    const samples: [number, number, number, number][] = [[0, 0, 0, 0], [80, 150, 240, 30], [156, 219, 255, 255], [51, 131, 219, 255], [255, 225, 100, 255], [232, 71, 63, 255]];
    for (const px of samples) {
      const level = rgbaToLevel(...px);
      const { rain, heavy } = classifyPixel(...px);
      expect(level > 0).toBe(rain);
      expect(level >= 3).toBe(heavy);
    }
  });

  it("orders blues and warm colours by intensity", () => {
    expect(rgbaToLevel(156, 219, 255, 255)).toBe(1);
    expect(rgbaToLevel(51, 131, 219, 255)).toBe(2);
    expect(rgbaToLevel(255, 225, 100, 255)).toBe(3);
    expect(rgbaToLevel(232, 71, 63, 255)).toBe(4);
  });

  it("classifies radar pixels and paints levels with the radar ramp", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, 232, 71, 63, 200]);
    const levels = imageToLevels({ data, width: 2, height: 1 });
    expect([...levels]).toEqual([0, 4]);
    expect([...levelsToRgba(levels, 150)]).toEqual([0, 0, 0, 0, 0xff, 0x44, 0, 150]);
    expect(levelToRgba(4)).toEqual([0xff, 0x44, 0, 200]);
    expect(rainFraction(levels)).toBe(0.5);
  });
});
