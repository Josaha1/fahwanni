import { describe, expect, it } from "vitest";
import fixture from "./fixture-open-meteo-aq.json";
import { buildPm25Grid } from "./grid";
import { gridPoints, WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";

const locations = () => gridPoints().map((_, index) => fixture[index % fixture.length]);

describe("buildPm25Grid", () => {
  it("keeps 24 hourly values in grid order from the seven-day fixture", () => {
    const grid = buildPm25Grid(locations())!;
    expect(grid).toMatchObject({
      bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY, source: "open-meteo-cams",
      attribution: { text: "Air quality: Open-Meteo.com (CAMS, CC BY 4.0)", url: "https://open-meteo.com" },
    });
    expect(grid.hours).toHaveLength(24);
    expect(grid.hours[0]).toBe("2026-09-27T17:00:00.000Z");
    expect(grid.hours[23]).toBe("2026-09-28T16:00:00.000Z");
    expect(grid.pm25).toHaveLength(24);
    expect(grid.pm25[0]).toHaveLength(361);
    expect(grid.pm25[0].slice(0, 4)).toEqual([44.4, 4.1, 6.6, 44.4]);
  });

  it("fills gaps from the previous hour, or the next value at the start", () => {
    const data = locations().map((location) => ({ ...location, hourly: { ...location.hourly, pm2_5: [...location.hourly.pm2_5] as (number | null)[] } }));
    const first = { ...data[0], hourly: { ...data[0].hourly, pm2_5: [null, null, 3.46, null, ...data[0].hourly.pm2_5.slice(4)] } };
    data[0] = first;
    const grid = buildPm25Grid(data)!;
    expect(grid.pm25.slice(0, 4).map((row) => row[0])).toEqual([3.5, 3.5, 3.5, 3.5]);
    expect(grid.pm25[0][1]).toBe(4.1);
  });

  it("rejects a point with no values, missing hours, or the wrong location count", () => {
    expect(buildPm25Grid(fixture)).toBeNull();
    const allNull = locations().map((location) => ({ ...location, hourly: { ...location.hourly, pm2_5: [...location.hourly.pm2_5] as (number | null)[] } }));
    allNull[2] = { ...allNull[2], hourly: { ...allNull[2].hourly, pm2_5: Array(24).fill(null) } };
    expect(buildPm25Grid(allNull)).toBeNull();
    const short = locations();
    short[0] = { ...short[0], hourly: { ...short[0].hourly, pm2_5: [] } };
    expect(buildPm25Grid(short)).toBeNull();
  });
});
