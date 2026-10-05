import { describe, expect, it } from "vitest";
import fixture from "./fixture-tmd-today.json";
import { parseTmdRain, rainCategory } from "./tmd";

describe("TMD rain risk", () => {
  it("reads the real station report", () => {
    const result = parseTmdRain(fixture);
    expect(result.reporting).toBe(124);
    expect(result.stations).toHaveLength(6);
    expect(result.all).toHaveLength(124);
    expect(result.all.some((station) => station.rainMm === 0)).toBe(true);
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

  it("keeps zero and light rain in all, excluding invalid rainfall and coordinates", () => {
    const row = fixture.Stations.Station[0];
    const result = parseTmdRain({ Stations: { Station: [
      ...["0", "12", "35", "35.1"].map((Rainfall, index) => ({ ...row, WmoStationNumber: String(index), Observation: { ...row.Observation, Rainfall } })),
      { ...row, Latitude: "", Observation: { ...row.Observation, Rainfall: "5" } },
      { ...row, Longitude: "110", Observation: { ...row.Observation, Rainfall: "5" } },
      { ...row, Observation: { ...row.Observation, Rainfall: "-1" } },
      { ...row, Observation: { ...row.Observation, Rainfall: "-" } },
    ] } });
    expect(result.all.map((station) => station.rainMm)).toEqual([0, 12, 35, 35.1]);
    expect(result.all.every((station) => !("category" in station))).toBe(true);
    expect(result.stations.map((station) => station.rainMm)).toEqual([35.1]);
    expect(parseTmdRain(null).all).toEqual([]);
  });
});
