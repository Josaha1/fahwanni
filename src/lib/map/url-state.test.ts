import { describe, expect, it } from "vitest";
import { formatUrlView, parseUrlView } from "./url-state";

describe("map URL view", () => {
  it("round trips the view and keeps overlay order", () => {
    const view = { lat: 13.7, lon: 100.5, z: 8, layer: "temp" as const, t: "2026-09-28T08:00:00.000Z",
      ov: { wind: true, storms: true, quakes: false, terrain: true } };
    expect(formatUrlView(view)).toBe("?lat=13.70&lon=100.50&z=8.0&layer=temp&t=2026-09-28T08%3A00%3A00.000Z&ov=wind,storms,3d");
    expect(parseUrlView(formatUrlView(view))).toEqual(view);
  });

  it("accepts inclusive bounds and rejects each invalid field independently", () => {
    expect(parseUrlView("?lat=-5&lon=130&z=12&layer=pm25")).toEqual({ lat: -5, lon: 130, z: 12, layer: "pm25" });
    expect(parseUrlView("?lat=-5.01&lon=130.01&z=12.1&layer=other&t=not-a-date")).toEqual({});
    expect(parseUrlView("?lat=30&lon=80&z=3&layer=rain")).toEqual({ lat: 30, lon: 80, z: 3, layer: "rain" });
  });

  it("ignores malformed numbers and unknown overlays", () => {
    expect(parseUrlView("?lat=1e2&lon=Infinity&z=&ov=wind,unknown,3d")).toEqual({
      ov: { wind: true, storms: false, quakes: false, terrain: true },
    });
  });

  it("treats an empty ov as all off and a missing ov as unspecified", () => {
    expect(parseUrlView("?ov=").ov).toEqual({ wind: false, storms: false, quakes: false, terrain: false });
    expect(parseUrlView("").ov).toBeUndefined();
  });
});
