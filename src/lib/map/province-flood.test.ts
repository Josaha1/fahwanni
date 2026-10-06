import { expect, it } from "vitest";
import type { PixelCounts } from "@/lib/flood/viirs";
import { isCloudy, provinceFillOpacity, provinceFloodRatio } from "./province-flood";

const counts = (patch: Partial<PixelCounts> = {}): PixelCounts => ({
  flood: 0, recurringFlood: 0, water: 0, dry: 100, insufficientData: 0, noData: 0, sampled: 100, ...patch,
});

it("scales flood and recurring-flood ratios by the national maximum using sqrt", () => {
  expect(provinceFloodRatio(counts({ flood: 10, recurringFlood: 15 }))).toBe(0.25);
  expect(provinceFillOpacity(counts({ flood: 10, recurringFlood: 15 }), 1)).toBe(0.5);
  expect(provinceFillOpacity(counts({ flood: 25 }), 0.25)).toBe(1);
  expect(provinceFillOpacity(counts({ flood: 25, sampled: 200 }), 0.5))
    .toBe(provinceFillOpacity(counts({ flood: 50, sampled: 400 }), 0.5));
  expect(provinceFillOpacity(counts({ flood: 100 }), 0.5)).toBe(1);
});

it("leaves zero flood, permanent water and unsampled provinces unfilled", () => {
  for (const value of [null, undefined, counts(), counts({ water: 100 }), counts({ sampled: 0 })]) {
    expect(provinceFillOpacity(value, 0.5)).toBe(0);
  }
  expect(provinceFillOpacity(counts({ flood: 10 }), 0)).toBe(0);
});

it("hatches missing observations at the inclusive 50% boundary, including zero samples", () => {
  expect(isCloudy(counts({ insufficientData: 25, noData: 24 }))).toBe(false);
  expect(isCloudy(counts({ insufficientData: 25, noData: 25 }))).toBe(true);
  expect(isCloudy(counts({ noData: 100 }))).toBe(true);
  expect(isCloudy(counts({ sampled: 0 }))).toBe(true);
  expect(isCloudy(null)).toBe(true);
});
