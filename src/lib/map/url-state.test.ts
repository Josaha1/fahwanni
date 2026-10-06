import { describe, expect, it } from "vitest";
import { formatUrlView, parseUrlView as parseView } from "./url-state";

const parseUrlView = (search: string) => parseView(search, "all");

describe("flood URLs", () => {
  it("opens a hidden legacy layer as rain in weather mode", () => {
    expect(parseView("?layer=pm25")).toEqual({ layer: "rain", hiddenLayer: true, mode: "weather" });
  });
  it("preserves explicit weather mode when sharing and lets empty URLs use defaults", () => {
    expect(parseView("")).toEqual({});
    expect(parseView("?mode=weather").mode).toBe("weather");
  });
});

describe("map URL view", () => {
  it("round trips the view and keeps overlay order", () => {
    const view = { lat: 13.7, lon: 100.5, z: 8, layer: "temp" as const, t: Date.parse("2026-09-28T08:37:00.000Z"),
      ov: { wind: true, storms: true, quakes: true, dams: false, terrain: true } };
    expect(formatUrlView(view)).toBe("?lat=13.70&lon=100.50&z=8.0&layer=temp&t=29843077&ov=wind,storms,quakes,3d");
    expect(parseUrlView(formatUrlView(view))).toEqual({ ...view, mode: "weather" });
  });

  it("reads t as epoch minutes, still accepts old ISO links and the temporary focus name", () => {
    const minute = Date.parse("2026-09-28T08:37:00.000Z");
    expect(parseUrlView("?t=29843077").t).toBe(minute);
    expect(parseUrlView("?t=2026-09-28T08:37:20.000Z").t).toBe(minute);
    expect(parseUrlView("?focus=2026-09-28T08:37:00.000Z").t).toBe(minute);
    expect(parseUrlView("?t=29843077&focus=2020-01-01T00:00:00Z").t).toBe(minute);
    for (const invalid of ["12", "1e9", "-29843077", "2026-99-99", "now"]) expect(parseUrlView(`?t=${invalid}`).t).toBeUndefined();
  });

  it("accepts inclusive bounds and rejects each invalid field independently", () => {
    expect(parseUrlView("?lat=5.6&lon=105.7&z=17&layer=pm25")).toEqual({ lat: 5.6, lon: 105.7, z: 17, layer: "pm25", mode: "weather" });
    expect(parseUrlView("?lat=5.59&lon=105.71&z=17.1&layer=other&t=not-a-date")).toEqual({});
    expect(parseUrlView("?lat=20.5&lon=97.3&z=3&layer=rain")).toEqual({ lat: 20.5, lon: 97.3, z: 3, layer: "rain", mode: "weather" });
    expect(parseUrlView("?layer=satellite")).toEqual({ layer: "satellite", mode: "weather" });
  });

  it("ignores malformed numbers and unknown overlays", () => {
    expect(parseUrlView("?lat=1e2&lon=Infinity&z=&ov=wind,unknown,3d")).toEqual({
      ov: { wind: true, storms: false, quakes: false, dams: false, terrain: true },
    });
  });

  it("treats an empty ov as all off and a missing ov as unspecified", () => {
    expect(parseUrlView("?ov=").ov).toEqual({ wind: false, storms: false, quakes: false, dams: false, terrain: false });
    expect(parseUrlView("").ov).toBeUndefined();
  });

  it("round trips a downstream dam and rejects invalid IDs", () => {
    const view = { lat: 16.6, lon: 99, z: 8, layer: "rain" as const,
      ov: { wind: false, storms: false, quakes: false, dams: true, terrain: false }, dam: "chao-phraya", mode: "water" as const };
    expect(parseUrlView(formatUrlView(view)).dam).toBe("chao-phraya");
    expect(parseUrlView("?dam=1").dam).toBe("1");
    for (const invalid of ["", "A", "a_b", "a.b", "น้ำ", "a/b"]) {
      expect(parseUrlView(`?dam=${encodeURIComponent(invalid)}`).dam).toBeUndefined();
    }
  });

  it("writes water mode and its dam only in water mode, and reads old dam links as water mode", () => {
    const base = { lat: 16.6, lon: 99, z: 8, layer: "rain" as const,
      ov: { wind: true, storms: false, quakes: false, dams: true, terrain: false }, dam: "200101" };
    expect(formatUrlView({ ...base, mode: "water" })).toBe("?lat=16.60&lon=99.00&z=8.0&layer=rain&mode=water&dam=200101&ov=wind");
    expect(formatUrlView({ ...base, mode: "weather" })).toBe("?lat=16.60&lon=99.00&z=8.0&layer=rain&mode=weather&ov=wind");
    expect(parseUrlView("?mode=water").mode).toBe("water");
    expect(parseUrlView("?mode=other").mode).toBeUndefined();
    expect(parseUrlView("?ov=wind,dams").mode).toBe("water");
    expect(parseUrlView("?dam=200101").mode).toBe("water");
    expect(parseUrlView("?ov=wind").mode).toBeUndefined();
  });

  it("round trips a river card in water mode and rejects malformed river IDs", () => {
    const base = { lat: 13.7, lon: 100.5, z: 8, layer: "rain" as const,
      ov: { wind: false, storms: false, quakes: false, dams: true, terrain: false }, river: "chaophraya-ayutthaya" };
    expect(formatUrlView({ ...base, mode: "water" })).toContain("river=chaophraya-ayutthaya");
    expect(formatUrlView({ ...base, mode: "weather" })).not.toContain("river=");
    expect(parseUrlView("?river=chaophraya-ayutthaya")).toEqual({ river: "chaophraya-ayutthaya", mode: "water" });
    for (const invalid of ["", "A", "a_b", "a.b", "น้ำ", "a/b"]) {
      expect(parseUrlView(`?river=${encodeURIComponent(invalid)}`).river).toBeUndefined();
    }
  });

  it("keeps only future water days in water URLs", () => {
    const base = { lat: 13.7, lon: 100.5, z: 8, layer: "rain" as const,
      ov: { wind: false, storms: false, quakes: false, dams: true, terrain: false } };
    expect(formatUrlView({ ...base, mode: "water", wd: 3 })).toContain("wd=3");
    expect(formatUrlView({ ...base, mode: "water", wd: 0 })).not.toContain("wd=");
    expect(formatUrlView({ ...base, mode: "weather", wd: 3 })).not.toContain("wd=");
    expect(parseUrlView("?mode=water&wd=7").wd).toBe(7);
    for (const value of ["0", "8", "2.5", "-1", "foo"]) expect(parseUrlView(`?mode=water&wd=${value}`).wd).toBeUndefined();
    expect(parseUrlView("?wd=3").wd).toBeUndefined();
  });

  it("keeps the all-routes overview in water links only", () => {
    const base = { lat: 15, lon: 101, z: 6, layer: "rain" as const, ov: { wind: false, storms: false, quakes: false, dams: true, terrain: false } };
    expect(formatUrlView({ ...base, mode: "water", routes: true })).toContain("routes=1");
    expect(formatUrlView({ ...base, mode: "weather", routes: true })).not.toContain("routes");
    expect(parseUrlView("?mode=water&routes=1").routes).toBe(true);
    expect(parseUrlView(formatUrlView({ ...base, mode: "water", routes: false })).routes).toBe(false);
    expect(parseUrlView("?routes=1").routes).toBeUndefined();
  });
});
