import { describe, expect, it } from "vitest";
import fixture from "./fixture-open-meteo-aq.json";
import { buildPm25Days, toLegacyPm25Grid } from "./days";
import { gridPoints } from "@/lib/wind/grid";

const locations = () => gridPoints().map((_, index) => structuredClone(fixture[index % fixture.length]));
const start = Date.parse("2026-09-28T00:00:00+07:00");

describe("buildPm25Days", () => {
  it("creates seven Bangkok calendar days with 24 hourly grid values", () => {
    const days = buildPm25Days(locations());
    expect(days).toHaveLength(7);
    for (const [index, day] of days.entries()) {
      expect(day.day).toBe(index);
      expect(day.date).toBe(fixture[0].hourly.time[index * 24].slice(0, 10));
      expect(day.hours).toHaveLength(24);
      expect(day.pm25).toHaveLength(24);
      expect(day.pm25[23]).toHaveLength(361);
    }
    expect(days[0].hours[0]).toBe("2026-09-27T17:00:00.000Z");
    expect(days[1].hours[0]).toBe("2026-09-28T17:00:00.000Z");
    expect(days[0].pm25[0].slice(0, 3)).toEqual([44.4, 4.1, 6.6]);
  });

  it("fills nulls within each point and day, including the first hour", () => {
    const rows = locations();
    rows[0].hourly.pm2_5[0] = null as unknown as number;
    rows[0].hourly.pm2_5[1] = null as unknown as number;
    rows[0].hourly.pm2_5[3] = null as unknown as number;
    rows[0].hourly.pm2_5[25] = null as unknown as number;
    const days = buildPm25Days(rows);
    expect(days).toHaveLength(7);
    expect(days[0].pm25.slice(0, 4).map((hour) => hour[0])).toEqual([44.2, 44.2, 44.2, 44.2]);
    expect(days[1].pm25[1][0]).toBe(days[1].pm25[0][0]);
  });

  it("keeps internal gaps but removes hours where every point is null at the end", () => {
    const rows = locations();
    rows[0].hourly.pm2_5[150] = null as unknown as number;
    for (const row of rows) row.hourly.pm2_5.fill(null as unknown as number, 163);
    const days = buildPm25Days(rows);
    expect(days).toHaveLength(7);
    expect(days[6].hours).toHaveLength(19);
    expect(days[6].pm25).toHaveLength(19);
    expect(days[6].hours.at(-1)).toBe(new Date(`${rows[0].hourly.time[162]}+07:00`).toISOString());
    expect(days[6].pm25[6][0]).toBe(days[6].pm25[5][0]);

    for (const row of rows) row.hourly.pm2_5.fill(null as unknown as number, 144);
    expect(buildPm25Days(rows).map(({ day }) => day)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("drops a day with no values and rejects misaligned timestamps", () => {
    const rows = locations();
    rows[0].hourly.pm2_5.fill(null as unknown as number, 24, 48);
    expect(buildPm25Days(rows).map(({ day }) => day)).toEqual([0, 2, 3, 4, 5, 6]);
    expect(buildPm25Days([])).toEqual([]);
    const shifted = locations();
    shifted[1].hourly.time[1] = shifted[1].hourly.time[0];
    expect(buildPm25Days(shifted)).toEqual([]);
  });
});

it("rebuilds the exact legacy shape for 24 hours across local midnight", () => {
  const days = buildPm25Days(locations());
  const grid = toLegacyPm25Grid(days, start + 23 * 3_600_000 + 20_000);
  expect(Object.keys(grid).sort()).toEqual(["attribution", "bbox", "hours", "nx", "ny", "pm25", "source"].sort());
  expect(grid.hours).toHaveLength(24);
  expect(grid.hours[0]).toBe(days[0].hours[23]);
  expect(grid.hours.at(-1)).toBe(days[1].hours[22]);
  expect(grid.pm25).toHaveLength(24);
  expect(grid.pm25[0]).toHaveLength(361);
});
