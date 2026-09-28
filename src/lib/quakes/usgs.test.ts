import { describe, expect, it } from "vitest";
import fixture from "./fixture-usgs.json";
import { nearbyQuakes, parseUsgs, type Quake } from "./usgs";

describe("parseUsgs", () => {
  it("parses the real USGS feed shape", () => {
    const quakes = parseUsgs(fixture);
    expect(quakes).toHaveLength(fixture.features.length);
    expect(quakes[0]).toMatchObject({ mag: 4.5, place: "78 km N of Daocheng, China", lat: 29.7444, lon: 100.2661, depthKm: 10, tsunami: false });
    expect(quakes[0].time).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("skips malformed features, null magnitudes and non-earthquakes", () => {
    const raw = { features: [
      { id: "a", properties: { mag: null, time: 0 }, geometry: { coordinates: [100, 13, 5] } },
      { id: "b", properties: { mag: 4.2, time: 0, type: "quarry blast" }, geometry: { coordinates: [100, 13, 5] } },
      { id: "c", nope: true },
      { id: "d", properties: { mag: 4.24, time: 0, place: "x", tsunami: 1 }, geometry: { coordinates: [100, 13, 5.6] } },
    ] };
    expect(parseUsgs(raw)).toEqual([{ id: "d", mag: 4.2, place: "x", time: "1970-01-01T00:00:00.000Z", lat: 13, lon: 100, depthKm: 6, tsunami: true, url: undefined }]);
    expect(parseUsgs("oops")).toEqual([]);
  });
});

describe("nearbyQuakes", () => {
  const q = (id: string, lat: number, lon: number, time: string): Quake => ({ id, mag: 4.5, place: "", time, lat, lon, depthKm: 10, tsunami: false });
  const bangkok = { lat: 13.75, lon: 100.5 };

  it("keeps recent quakes within the radius, newest first, with distance and bearing", () => {
    const list = nearbyQuakes([
      q("myanmar", 21.0, 96.0, "2026-09-27T00:00:00Z"),   // ~937 km NNW
      q("china", 29.7, 100.3, "2026-09-28T00:00:00Z"),    // ~1,770 km N — too far
      q("old", 18.8, 99.0, "2026-09-10T00:00:00Z"),       // too old
      q("north", 18.8, 99.0, "2026-09-28T01:00:00Z"),     // Chiang Mai ~580 km
    ], bangkok, "2026-09-28T05:00:00Z");
    expect(list.map((x) => x.id)).toEqual(["north", "myanmar"]);
    expect(list[0].distanceKm).toBeGreaterThan(550);
    expect(list[0].distanceKm).toBeLessThan(620);
    expect(list[1].bearingDeg).toBeGreaterThan(300); // ~330° (NNW)
    expect(list[1].bearingDeg).toBeLessThan(340);
  });
});
