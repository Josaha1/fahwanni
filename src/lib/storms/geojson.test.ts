import { describe, expect, it } from "vitest";
import targets from "./fixtures/jma-targetTc.json";
import forecast from "./fixtures/jma-forecast.json";
import specifications from "./fixtures/jma-specifications.json";
import { circle, stormsToGeoJSON } from "./geojson";
import { distanceKm, type Storm } from "./normalize";
import { parseJmaStorm } from "./jma";

const storm: Storm = {
  id: "S1", source: "jma", name: "Test", category: "TS",
  position: { lat: 15, lon: 115 },
  track: [{ lat: 13, lon: 120 }, { lat: 14, lon: 117 }],
  forecast: [{ lat: 16, lon: 112, time: "2026-09-29T00:00:00Z", radiusKm: 150 }, { lat: 17, lon: 109, time: "2026-09-30T00:00:00Z" }],
};

describe("circle", () => {
  it("is closed and has the requested radius", () => {
    const ring = circle({ lat: 15, lon: 110 }, 200);
    expect(ring[0][0]).toBeCloseTo(ring.at(-1)![0]);
    expect(ring[0][1]).toBeCloseTo(ring.at(-1)![1]);
    for (const [lon, lat] of ring) expect(distanceKm({ lat: 15, lon: 110 }, { lat, lon })).toBeCloseTo(200, -1);
  });
});

describe("stormsToGeoJSON", () => {
  it("builds track, forecast, cones and centre", () => {
    const kinds = stormsToGeoJSON([storm]).features.map((f) => f.properties.kind);
    expect(kinds).toEqual(["track", "forecast", "cone", "center"]);
  });

  it("ends the past track and starts the forecast at the current position", () => {
    const [track, ahead] = stormsToGeoJSON([storm]).features;
    expect(track.geometry.coordinates.at(-1)).toEqual([115, 15]);
    expect((ahead.geometry.coordinates as number[][])[0]).toEqual([115, 15]);
  });

  it("skips lines with fewer than two points", () => {
    const lone = { ...storm, track: [], forecast: [] };
    expect(stormsToGeoJSON([lone]).features.map((f) => f.properties.kind)).toEqual(["center"]);
  });

  it("is empty when there are no storms", () => {
    expect(stormsToGeoJSON([])).toEqual({ type: "FeatureCollection", features: [] });
  });

  it("handles the real JMA fixture moved inside the area", () => {
    const localSpecs = structuredClone(specifications);
    const localForecast = structuredClone(forecast);
    const currentSpecs = localSpecs.find((part) => part.advancedHours === 0);
    const currentForecast = localForecast.find((part) => part.advancedHours === 0);
    if (!currentSpecs?.position?.deg || !currentForecast?.center) throw new Error("Fixture current point missing");
    currentSpecs.position.deg[1] = 129.8;
    currentForecast.center[1] = 129.8;
    const real = parseJmaStorm(targets[0], localForecast, localSpecs)!;
    const collection = stormsToGeoJSON([real]);
    expect(collection.features.some((f) => f.properties.kind === "forecast")).toBe(true);
    expect(collection.features.at(-1)!.geometry).toEqual({ type: "Point", coordinates: [129.8, real.position.lat] });
  });
});
