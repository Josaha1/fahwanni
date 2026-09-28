import { describe, expect, it } from "vitest";
import { toMarine, waveLevel } from "./marine";

const response = (lat: number, lon: number, waves: (number | null)[], periods?: (number | null)[]) => ({
  latitude: lat, longitude: lon,
  hourly: { time: waves.map((_, i) => `2026-09-28T${String(i).padStart(2, "0")}:00`), wave_height: waves, wave_period: periods },
});

describe("waveLevel", () => {
  it.each([[0.2, "calm"], [0.5, "moderate"], [1.49, "moderate"], [1.5, "high"], [2.5, "very-high"]])("%s m → %s", (m, level) => {
    expect(waveLevel(m)).toBe(level);
  });
});

describe("toMarine", () => {
  it("summarises a coastal place (real Phuket shape)", () => {
    const marine = toMarine(response(7.875, 98.29167, [0.84, 0.9, 1.62], [7.6, 7.65, 8]), 7.89, 98.3);
    expect(marine).toMatchObject({ available: true, cellKm: 2, nowWaveM: 0.8, maxWaveM: 1.6, periodS: 8, level: "high" });
  });

  it("is unavailable inland where the API returns nulls (real Bangkok shape)", () => {
    expect(toMarine(response(13.79, 100.46, [null, null]), 13.75, 100.5).available).toBe(false);
  });

  it("is unavailable when the nearest sea cell is too far", () => {
    const marine = toMarine(response(12.0, 100.5, [0.6]), 12.5, 100.5); // ~56 km
    expect(marine.available).toBe(false);
    expect(marine.cellKm).toBeGreaterThan(30);
  });

  it("is unavailable for malformed data", () => {
    expect(toMarine({ nope: true }, 7, 98).available).toBe(false);
  });
});
