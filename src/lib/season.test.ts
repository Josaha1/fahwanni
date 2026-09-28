import { describe, expect, it } from "vitest";
import { thaiSeason } from "./season";

const bangkok = 13.75;
const phuket = 7.9;

describe("thaiSeason (north/central/northeast)", () => {
  it.each([
    ["2026-01-10T05:00:00Z", "cool", "pm25"],
    ["2026-02-14T05:00:00Z", "cool", "pm25"],
    ["2026-02-15T05:00:00Z", "hot", "heatstroke"],
    ["2026-05-14T05:00:00Z", "hot", "heatstroke"],
    ["2026-05-15T05:00:00Z", "rainy", "umbrella"],
    ["2026-08-15T05:00:00Z", "rainy", "storms"],
    ["2026-09-28T05:00:00Z", "rainy", "storms"],
    ["2026-10-15T05:00:00Z", "cool", "pm25"],
  ])("%s → %s/%s", (iso, season, tip) => expect(thaiSeason(iso, bangkok)).toEqual({ season, tip }));

  it("uses Bangkok local date, not UTC", () => {
    // 17:30 UTC on 14 Feb is already 15 Feb in Bangkok.
    expect(thaiSeason("2026-02-14T17:30:00Z", bangkok).season).toBe("hot");
  });
});

describe("thaiSeason (south)", () => {
  it.each([
    ["2026-03-01T05:00:00Z", "hot", "heatstroke"],
    ["2026-07-01T05:00:00Z", "rainy", "umbrella"],
    ["2026-11-20T05:00:00Z", "rainy", "south-monsoon"],
    ["2026-01-10T05:00:00Z", "rainy", "south-monsoon"],
  ])("%s → %s/%s", (iso, season, tip) => expect(thaiSeason(iso, phuket)).toEqual({ season, tip }));
});
