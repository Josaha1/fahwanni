import { describe, expect, it } from "vitest";
import fixture from "./fixture-open-meteo.json";
import { buildDays, toLegacyGrid } from "./days";
import { gridPoints } from "./grid";

const locations = () => gridPoints().map((_, index) => structuredClone(fixture[index % fixture.length]));
const start = Date.parse("2026-09-28T00:00:00+07:00");

describe("buildDays", () => {
  it("creates seven local calendar days with hourly ISO times and grid values", () => {
    const days = buildDays(locations());
    expect(days).toHaveLength(7);
    for (const [index, day] of days.entries()) {
      expect(day.day).toBe(index);
      expect(day.date).toBe(`2026-${index < 3 ? "09" : "10"}-${String(index < 3 ? 28 + index : index - 2).padStart(2, "0")}`);
      expect(day.hours).toHaveLength(24);
      expect(day.u[0]).toHaveLength(361);
      for (const field of ["u", "v", "precip", "prob", "temp", "feels"] as const) {
        expect(day[field]).toHaveLength(24);
        expect(day[field][23]).toHaveLength(361);
      }
    }
    expect(days[0].hours[0]).toBe("2026-09-27T17:00:00.000Z");
    expect(days[1].hours[0]).toBe("2026-09-28T17:00:00.000Z");
    expect(days[0].precip[0][0]).toBe(0.1);
    expect(days[0].temp[0][0]).toBe(28);
  });

  it("fills nulls within each point and day, including the first hour", () => {
    const rows = locations();
    rows[0].hourly.wind_speed_10m[0] = null as unknown as number;
    rows[0].hourly.wind_direction_10m[0] = null as unknown as number;
    rows[0].hourly.precipitation[1] = null as unknown as number;
    rows[0].hourly.temperature_2m[25] = null as unknown as number;
    const days = buildDays(rows);
    expect(days).toHaveLength(7);
    expect(days[0].u[0][0]).toBe(days[0].u[1][0]);
    expect(days[0].precip[1][0]).toBe(days[0].precip[0][0]);
    expect(days[1].temp[1][0]).toBe(days[1].temp[0][0]);
  });

  it("drops a day when a point has no value for one variable that day", () => {
    const rows = locations();
    rows[0].hourly.apparent_temperature.fill(null as unknown as number, 24, 48);
    const days = buildDays(rows);
    expect(days.map(({ day }) => day)).toEqual([0, 2, 3, 4, 5, 6]);
    expect(buildDays([])).toEqual([]);
  });

  it("rejects misaligned location timestamps", () => {
    const rows = locations();
    rows[1].hourly.time[1] = rows[1].hourly.time[0];
    expect(buildDays(rows)).toEqual([]);
  });
});

describe("toLegacyGrid", () => {
  it("starts at the current hour, spanning local midnight without changing the old shape", () => {
    const days = buildDays(locations());
    const grid = toLegacyGrid(days, start + 23 * 3_600_000 + 20_000);
    expect(Object.keys(grid).sort()).toEqual([
      "attribution", "bbox", "feels", "hours", "nx", "ny", "precip", "precipHours",
      "prob", "source", "temp", "tempHours", "u", "v",
    ].sort());
    expect(grid.hours).toHaveLength(8);
    expect(grid.hours[0]).toBe(days[0].hours[23]);
    expect(grid.hours[1]).toBe(days[1].hours[2]);
    expect(grid.precipHours).toHaveLength(12);
    expect(grid.tempHours).toHaveLength(24);
    expect(grid.tempHours?.at(-1)).toBe(days[1].hours[22]);
  });
});
