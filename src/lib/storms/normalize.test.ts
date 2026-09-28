import { describe, expect, it } from "vitest";
import { bearingDeg, distanceKm, inStormBbox, mergeStorms, type Storm } from "./normalize";

const jma: Storm = {
  id: "TC1", source: "jma", name: "One", position: { lat: 18, lon: 100 },
  issuedAt: "2026-09-28T05:00:00Z", track: [], forecast: [],
};

describe("storm geography", () => {
  it("measures Bangkok to Manila", () => {
    const bangkok = { lat: 13.7563, lon: 100.5018 };
    const manila = { lat: 14.5995, lon: 120.9842 };
    expect(distanceKm(bangkok, manila)).toBeGreaterThan(2100);
    expect(distanceKm(bangkok, manila)).toBeLessThan(2300);
    expect(bearingDeg(bangkok, manila)).toBeGreaterThan(80);
    expect(bearingDeg(bangkok, manila)).toBeLessThan(90);
  });

  it("keeps the bbox boundaries", () => {
    expect(inStormBbox({ lat: 0, lon: 80 })).toBe(true);
    expect(inStormBbox({ lat: 30, lon: 130 })).toBe(true);
    expect(inStormBbox({ lat: 18, lon: -114 })).toBe(false);
  });
});

describe("mergeStorms", () => {
  it("prefers JMA within 300 km on the same day", () => {
    const gdacs: Storm = { ...jma, id: "10", source: "gdacs", position: { lat: 18.5, lon: 101 }, issuedAt: "2026-09-28T10:00:00Z" };
    expect(mergeStorms([jma], [gdacs])).toEqual([jma]);
    expect(mergeStorms([jma], [{ ...gdacs, issuedAt: "2026-09-29T00:01:00Z" }])).toHaveLength(2);
    expect(mergeStorms([jma], [{ ...gdacs, issuedAt: "2026-09-26T10:00:00Z" }])).toHaveLength(2);
    expect(mergeStorms([jma], [{ ...gdacs, position: { lat: 18, lon: 110 } }])).toHaveLength(2);
  });
});
