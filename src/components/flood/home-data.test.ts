import { describe, expect, it } from "vitest";
import { eventProvinces, nearestRainStation, previousRelease, recentFloodEvents, riskBbox, warningRegions } from "./home-data";
import type { FloodEvent } from "@/lib/water/flood-events";

const event = (extra: Partial<FloodEvent> = {}): FloodEvent => ({ id: "test", source: "gdacs", type: "flood", date: "2026-10-01", endDate: null,
  alert: null, lat: 13.7, lon: 100.5, place: "Thailand", summary: "", url: "https://example.org", glide: null, ...extra });

describe("FloodHome data", () => {
  it("uses the closest reporting station even when it reported zero rain", () => {
    const station = { id: "near", nameTh: "ใกล้", nameEn: "Near", provinceTh: "กรุงเทพมหานคร", lat: 13.7, lon: 100.5, rainMm: 0 };
    const nearest = nearestRainStation([{ ...station, id: "heavy", lat: 15, rainMm: 100 }, station], station);
    expect(nearest).toEqual({ station, km: 0 });
    expect(nearestRainStation([], station)).toBeNull();
  });
  it("compares only the previous calendar day's release, including zero", () => {
    const trend = { dates: ["2026-10-01", "2026-10-03"], pct: {}, release: { dam: [0, 20] } };
    expect(previousRelease(trend, "dam", "2026-10-02")).toBe(0);
    expect(previousRelease(trend, "dam", "2026-10-04")).toBe(20);
    expect(previousRelease(trend, "dam", "2026-10-03")).toBeNull();
    expect(previousRelease(null, "dam", "2026-10-04")).toBeNull();
  });
  it("includes floods ending within 14 days, excluding old events, future dates and storms", () => {
    const items = [event({ date: "2026-08-01", endDate: "2026-10-04" }), event({ date: "2026-09-20" }),
      event({ date: "2026-10-06" }), event({ type: "storm" }), event({ type: "flash-flood" })];
    expect(recentFloodEvents(items, Date.parse("2026-10-05T12:00:00+07:00"))).toEqual([items[0], items[4]]);
  });
  it("counts published province names rather than a national event's centroid", () => {
    expect(eventProvinces(event())).toEqual([]);
    expect(eventProvinces(event({ place: "Chonburi, Bangkok, Nan" })).map((p) => p.id)).toEqual(["bangkok", "chon-buri", "nan"]);
    expect(eventProvinces(event({ place: "Nanning" }))).toEqual([]);
  });
  it("does not infer an east warning from the northeast prefix", () => {
    expect(warningRegions("ฝนหนักภาคตะวันออกเฉียงเหนือและภาคเหนือ")).toEqual(["north", "northeast"]);
    expect(warningRegions("ทั่วประเทศไทย")).toEqual([]);
  });
  it("requests a roughly ten kilometre bbox around the location", () => {
    const [west, south, east, north] = riskBbox({ lat: 13.7, lon: 100.5 }).split(",").map(Number);
    expect((west + east) / 2).toBeCloseTo(100.5);
    expect((south + north) / 2).toBeCloseTo(13.7);
    expect((north - 13.7) * 111.2).toBeCloseTo(10);
  });
});
