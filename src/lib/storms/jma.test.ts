import { describe, expect, it } from "vitest";
import targets from "./fixtures/jma-targetTc.json";
import forecast from "./fixtures/jma-forecast.json";
import specifications from "./fixtures/jma-specifications.json";
import { forecastSchema, parseJmaStorm, specificationsSchema, targetTcSchema } from "./jma";

describe("JMA fixtures", () => {
  it("parses every part with lenient schemas", () => {
    expect(targetTcSchema.parse(targets)).toHaveLength(1);
    expect(forecastSchema.parse(forecast)).toHaveLength(14);
    expect(specificationsSchema.parse(specifications)).toHaveLength(14);
    expect(targetTcSchema.parse([{ tropicalCyclone: "TC1", extra: true }])).toHaveLength(1);
  });

  it("filters the real current position outside the bbox", () => {
    expect(parseJmaStorm(targets[0], forecast, specifications)).toBeUndefined();
  });

  it("extracts wind, pressure, track and forecast when current point is inside", () => {
    const localSpecs = structuredClone(specifications);
    const localForecast = structuredClone(forecast);
    const currentSpecs = localSpecs.find((part) => part.advancedHours === 0);
    const currentForecast = localForecast.find((part) => part.advancedHours === 0);
    if (!currentSpecs?.position?.deg || !currentForecast?.center) throw new Error("Fixture current point missing");
    currentSpecs.position.deg[1] = 129.8;
    currentForecast.center[1] = 129.8;
    const storm = parseJmaStorm(targets[0], localForecast, localSpecs);
    expect(storm).toMatchObject({
      id: "TC2632", source: "jma", name: "Surigae (スリゲ)", category: "TY",
      position: { lat: 27, lon: 129.8 }, windKmh: 166.68, pressureHpa: 955,
    });
    expect(storm?.track.length).toBeGreaterThan(50);
    expect(storm?.forecast[1]).toMatchObject({ time: "2026-09-28T09:00:00Z", radiusKm: 35.188 });
  });
});
