import { describe, expect, it } from "vitest";
import { comparisonValues } from "./favourites-comparison";
import { NEAR_RIVER_KM, nearestRiverWithStatus } from "./rivers/near";

describe("favourite comparison", () => {
  it("uses today's highest rain chance and cached PM2.5", () => {
    expect(comparisonValues({ tempC: 31.6, rainChance: 10, hours: [], alerts: [],
      days: [{ day: { rainChance: 0 }, night: { rainChance: 70 } }] }, { pm25: 25.43 }))
      .toEqual({ tempC: 32, rainChance: 70, pm25: 25.4 });
  });

  it("falls back to the snapshot rain chance and keeps missing values empty", () => {
    expect(comparisonValues({ rainChance: 0, hours: [], alerts: [], days: [] }))
      .toEqual({ tempC: null, rainChance: 0, pm25: null });
    expect(comparisonValues()).toEqual({ tempC: null, rainChance: null, pm25: null });
  });

  it("takes the nearest river with data within 120 km", () => {
    const place = { lat: 13, lon: 100 };
    const points = [
      { id: "missing", lat: 13, lon: 100, summary: null },
      { id: "near", lat: 13.1, lon: 100, summary: { today: { status: "high" as const } } },
      { id: "far", lat: 15, lon: 100, summary: { today: { status: "normal" as const } } },
    ];
    expect(NEAR_RIVER_KM).toBe(120);
    expect(nearestRiverWithStatus(place, points)?.id).toBe("near");
    expect(nearestRiverWithStatus({ lat: 0, lon: 0 }, points)).toBeNull();
    expect(nearestRiverWithStatus(place, [points[0]])).toBeNull();
  });
});
