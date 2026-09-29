import { describe, expect, it } from "vitest";
import fixture from "./fixture-tmd-today.json";
import { parseTmdRain, rainCategory } from "./tmd";

describe("TMD rain risk", () => {
  it("reads the real station report", () => {
    const result = parseTmdRain(fixture);
    expect(result.reporting).toBe(124);
    expect(result.stations).toHaveLength(6);
    expect(result.observedAt).toBe("2026-09-29T07:00:00+07:00");
    expect(result.stations.every((station) => station.lat >= 5 && station.lat <= 21 && station.lon >= 97 && station.lon <= 106)).toBe(true);
    expect(result.stations.map((station) => station.rainMm)).toEqual([...result.stations.map((station) => station.rainMm)].sort((a, b) => b - a));
  });

  it.each([[35, null], [35.1, "heavy"], [90, "heavy"], [90.1, "veryHeavy"]] as const)("categorizes %s mm", (mm, category) => {
    expect(rainCategory(mm)).toBe(category);
  });

  it("skips a missing or nonnumeric rainfall without losing other stations", () => {
    const row = fixture.Stations.Station[0];
    const result = parseTmdRain({ Stations: { Station: [
      { ...row, Observation: { ...row.Observation, Rainfall: "-" } },
      { ...row, Observation: { DateTime: row.Observation.DateTime } },
      { ...row, Observation: { ...row.Observation, Rainfall: "90.1" } },
    ] } });
    expect(result.reporting).toBe(1);
    expect(result.stations).toHaveLength(1);
    expect(result.stations[0].category).toBe("veryHeavy");
  });
});
