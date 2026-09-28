import { describe, expect, it } from "vitest";
import fixture from "./fixture-open-meteo.json";
import { buildGrid, gridPoints, sampleAt, toUV, WIND_NX, WIND_NY } from "./grid";

function location(speed: number, dir: number, hours = 24) {
  return {
    latitude: 0,
    longitude: 0,
    hourly: {
      time: Array.from({ length: hours }, (_, h) => `2026-09-28T${String(h).padStart(2, "0")}:00`),
      wind_speed_10m: Array(hours).fill(speed),
      wind_direction_10m: Array(hours).fill(dir),
    },
  };
}

describe("toUV", () => {
  it.each([
    [0, 0, -1, "from north blows south"],
    [90, -1, 0, "from east blows west"],
    [180, 0, 1, "from south blows north"],
    [270, 1, 0, "from west blows east"],
  ])("direction %i", (dir, uSign, vSign) => {
    const { u, v } = toUV(36, dir);
    // `|| 0` folds -0 into 0 for the zero component.
    expect(Math.sign(Math.round(u)) || 0).toBe(uSign);
    expect(Math.sign(Math.round(v)) || 0).toBe(vSign);
    expect(Math.hypot(u, v)).toBeCloseTo(10);
  });
});

describe("gridPoints", () => {
  it("runs north to south, west to east", () => {
    const points = gridPoints();
    expect(points).toHaveLength(WIND_NX * WIND_NY);
    expect(points[0]).toEqual({ lat: 22, lon: 92 });
    expect(points[WIND_NX - 1]).toEqual({ lat: 22, lon: 110 });
    expect(points.at(-1)).toEqual({ lat: 4, lon: 110 });
  });
});

describe("buildGrid", () => {
  it("rejects anything but a full grid", () => {
    expect(buildGrid(fixture)).toBeNull();
    expect(buildGrid([])).toBeNull();
  });

  it("maps results by request order and normalises hours to UTC ISO", () => {
    const locations = gridPoints().map((_, i) => location(i === 0 ? 36 : 0, 90));
    const grid = buildGrid(locations)!;
    expect(grid.hours[0]).toBe("2026-09-28T00:00:00.000Z");
    expect(grid.hours[1]).toBe("2026-09-28T03:00:00.000Z");
    expect(grid.hours).toHaveLength(8);
    expect(grid.u[0][0]).toBe(-10);
    expect(grid.u[0][1]).toBe(0);
  });

  it("parses the real Open-Meteo fixture shape", () => {
    const [first] = fixture;
    const locations = gridPoints().map(() => first);
    const grid = buildGrid(locations, 1)!;
    expect(grid.hours).toHaveLength(first.hourly.time.length);
    expect(grid.u[0]).toHaveLength(WIND_NX * WIND_NY);
  });

  it("stays under 60 KB of JSON for 24 hours", () => {
    const locations = gridPoints().map((_, i) => location(10 + (i % 37) * 1.37, (i * 17) % 360));
    const size = JSON.stringify(buildGrid(locations)).length;
    expect(size).toBeLessThan(60_000);
  });
});

describe("sampleAt", () => {
  const locations = gridPoints().map(({ lon }) => location(lon === 92 ? 36 : 0, 270));
  const grid = buildGrid(locations)!;

  it("interpolates between grid columns", () => {
    expect(sampleAt(grid, 0, 92, 10)!.u).toBeCloseTo(10);
    expect(sampleAt(grid, 0, 92.5, 10)!.u).toBeCloseTo(5);
    expect(sampleAt(grid, 0, 110, 4)!.u).toBeCloseTo(0);
  });

  it("returns undefined outside the grid or hours", () => {
    expect(sampleAt(grid, 0, 91, 10)).toBeUndefined();
    expect(sampleAt(grid, 99, 100, 10)).toBeUndefined();
  });
});

describe("buildGrid precipitation", () => {
  const withRain = (mm: number, pct: number, hours = 24) => ({
    hourly: {
      time: Array.from({ length: hours }, (_, h) => `2026-09-28T${String(h).padStart(2, "0")}:00`),
      wind_speed_10m: Array(hours).fill(10),
      wind_direction_10m: Array(hours).fill(180),
      precipitation: Array(hours).fill(mm),
      precipitation_probability: Array(hours).fill(pct),
    },
  });

  it("keeps 12 hourly rain steps for every grid point", () => {
    const grid = buildGrid(gridPoints().map((_, i) => withRain(i === 0 ? 3.44 : 0, i === 0 ? 87 : 5)))!;
    expect(grid.precipHours).toHaveLength(12);
    expect(grid.precipHours![1]).toBe("2026-09-28T01:00:00.000Z");
    expect(grid.precip).toHaveLength(12);
    expect(grid.precip![0]).toHaveLength(361);
    expect(grid.precip![0][0]).toBe(3.4);
    expect(grid.prob![11][0]).toBe(87);
    expect(grid.prob![0][1]).toBe(5);
  });

  it("omits rain fields when the response has no precipitation (old shape)", () => {
    const [first] = fixture;
    const hourly: Record<string, unknown> = { ...first.hourly };
    delete hourly.precipitation;
    delete hourly.precipitation_probability;
    const grid = buildGrid(gridPoints().map(() => ({ ...first, hourly })), 1)!;
    expect(grid.precip).toBeUndefined();
    expect(grid.precipHours).toBeUndefined();
  });

  it("parses the real fixture with rain", () => {
    const [first] = fixture;
    const grid = buildGrid(gridPoints().map(() => first), 1)!;
    expect(grid.precipHours).toHaveLength(first.hourly.time.length);
  });

  it("stays under 60 KB with 8 wind steps and 12 rain steps", () => {
    const grid = buildGrid(gridPoints().map((_, i) => ({ hourly: { ...withRain((i % 17) * 0.73, (i * 7) % 100).hourly, wind_speed_10m: Array(24).fill(10 + (i % 37) * 1.37), wind_direction_10m: Array(24).fill((i * 17) % 360) } })))!;
    expect(JSON.stringify(grid).length).toBeLessThan(60_000);
  });
});
