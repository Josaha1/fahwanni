import { describe, expect, it } from "vitest";
import { highTides, parseTide } from "./tide";

const hourly = {
  time: ["2026-09-29T04:00", "2026-09-29T05:00", "2026-09-29T06:00", "2026-09-29T07:00", "2026-09-29T08:00",
    "2026-09-29T16:00", "2026-09-29T17:00", "2026-09-29T18:00", "2026-09-29T19:00"],
  sea_level_height_msl: [0.8, 1.5, 1.96, 1.5, -0.72, 0.7, 1.4, 1.8, 1.3],
};

describe("tide model", () => {
  it("parses Bangkok hourly sea levels into ISO instants", () => {
    const series = parseTide({ hourly });
    expect(series?.times[2]).toBe("2026-09-28T23:00:00.000Z");
    expect(series?.heights).toEqual(hourly.sea_level_height_msl);
    expect(highTides(series!)).toEqual([
      { time: "2026-09-28T23:00:00.000Z", height: 1.96 },
      { time: "2026-09-29T11:00:00.000Z", height: 1.8 },
    ]);
  });

  it("rejects malformed or missing model values", () => {
    expect(parseTide({ hourly: { ...hourly, sea_level_height_msl: [1] } })).toBeNull();
    expect(parseTide({ hourly: { ...hourly, sea_level_height_msl: [0, null] } })).toBeNull();
    expect(parseTide({ hourly: { ...hourly, time: ["bad"] } })).toBeNull();
  });

  it("requires a peak to exceed both neighboring hours by 0.1 m", () => {
    const series = { times: [0, 1, 2, 3, 4].map((hour) => new Date(Date.UTC(2026, 8, 29, hour)).toISOString()),
      heights: [0, 0.2, 0.25, 0.1, 0] };
    expect(highTides(series)).toEqual([]);
    expect(highTides({ ...series, heights: [0, 0.1, 0.3, 0.1, 0] }, 2)).toEqual([]);
    expect(highTides({ ...series, heights: [0, 0.1, 0.3, 0.1, 0] })).toEqual([{ time: series.times[2], height: 0.3 }]);
  });
});
