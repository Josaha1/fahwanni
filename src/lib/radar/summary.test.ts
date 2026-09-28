import { describe, expect, it } from "vitest";
import { classifyPixel, globalPixel, kmPerPixel, summarizeRadar, type RadarSample } from "./summary";

const s = (eastKm: number, northKm: number, rain = true, heavy = false): RadarSample => ({ eastKm, northKm, rain, heavy });

describe("classifyPixel", () => {
  it.each([
    [[0, 0, 0, 0], false, false],
    [[80, 150, 240, 30], false, false],
    [[80, 150, 240, 255], true, false],
    [[255, 210, 60, 255], true, true],
    [[230, 70, 60, 255], true, true],
  ])("%j", (rgba, rain, heavy) => expect(classifyPixel(...(rgba as [number, number, number, number]))).toEqual({ rain, heavy }));
});

describe("summarizeRadar", () => {
  it("is dry when nothing is raining in range", () => {
    expect(summarizeRadar([s(10, 10, false), s(150, 0)])).toEqual({ overhead: false, heavyNearby: false });
  });

  it("finds the nearest rain and its compass bearing", () => {
    expect(summarizeRadar([s(-40, 0), s(0, 80)])).toEqual({ overhead: false, nearestKm: 40, bearingDeg: 270, heavyNearby: false });
    expect(summarizeRadar([s(30, 30)]).bearingDeg).toBe(45);
  });

  it("flags rain overhead and heavy cells within 30 km", () => {
    expect(summarizeRadar([s(2, 1), s(20, 0, true, true)])).toMatchObject({ overhead: true, heavyNearby: true });
    expect(summarizeRadar([s(50, 0, true, true)]).heavyNearby).toBe(false);
  });
});

describe("tile math", () => {
  it("puts Bangkok in the z6 tile the map requests (49, 29)", () => {
    const { x, y } = globalPixel(100.5, 13.75, 6);
    expect(Math.floor(x / 256)).toBe(49);
    expect(Math.floor(y / 256)).toBe(29);
  });

  it("gives ~2.4 km per pixel at z6 over Thailand", () => {
    expect(kmPerPixel(13.75, 6)).toBeCloseTo(2.37, 1);
  });
});
