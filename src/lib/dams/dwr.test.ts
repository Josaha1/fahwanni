import { describe, expect, it } from "vitest";
import fixture from "./fixture-dwr.json";
import { dwrKind, isStale, latestStorage, normalizeDwr } from "./dwr";

const medium = normalizeDwr(fixture.medium.info, fixture.medium.obs, "medium");
const small = normalizeDwr(fixture.small.info, fixture.small.obs, "small");

describe("DWR reservoirs", () => {
  it("keeps location, capacity and the latest storage for medium reservoirs (MCM)", () => {
    expect(medium).toHaveLength(2);
    expect(medium[0]).toMatchObject({ code: "G09006-REV-1-2564-060", name: "กุดวังซอ", size: "medium", kind: "pond", owner: "DWR",
      capacityMcm: 2.58, storageMcm: 1.03, measuredAt: "2025-08-05" });
    expect(medium[0].pct).toBeCloseTo(39.9, 1);
  });

  it("converts cubic metres, keeps the larger of two same-day values and never invents a percentage", () => {
    const huairaeng = small.find((item) => item.name === "อ่างเก็บน้ำห้วยแร้ง")!;
    expect(huairaeng).toMatchObject({ owner: "RID", capacityMcm: null, storageMcm: 37.9, pct: null, measuredAt: "2026-09-23" });
    const nongthung = small.find((item) => item.name === "หนองทุ่งช้างตาย")!;
    expect(nongthung).toMatchObject({ capacityMcm: 0.5, storageMcm: 0.51, pct: 102, measuredAt: "2025-08-05" });
  });

  it("keeps a reservoir without readings, with no storage", () => {
    expect(small.find((item) => item.name === "อ่างเก็บน้ำห้วยยาง 3")).toMatchObject({ storageMcm: null, pct: null, measuredAt: null });
  });

  it("drops rows without coordinates or outside Thailand and rejects impossible percentages", () => {
    const info = { waterResources: [
      { waterResourcesMetadata: { waterResourcesCode: "x1", waterResourcesName: "อ่างเก็บน้ำนอก", latitude: 35, longitude: 139, capacity: 1 } },
      { waterResourcesMetadata: { waterResourcesCode: "x2", waterResourcesName: "อ่างเก็บน้ำไม่มีพิกัด", latitude: null, longitude: null } },
      { waterResourcesMetadata: { waterResourcesCode: "x3", waterResourcesName: "อ่างเก็บน้ำผิด", latitude: 14, longitude: 100, capacity: 1 } },
    ] };
    const obs = { timeSeriesObservation: [{ waterResources: { waterResourcesCode: "x3" },
      measurementResults: [{ measureTime: "2026-09-30T00:00:00", variable: "Storage", value: 5, uom: "MCM" }] }] };
    expect(normalizeDwr(info, obs, "small")).toEqual([expect.objectContaining({ code: "x3", storageMcm: 5, pct: null })]);
  });

  it("classifies by name and flags readings older than 30 days", () => {
    expect([dwrKind("ฝายหัวเขา"), dwrKind("บึงแท่น"), dwrKind("อ่างเก็บน้ำคลองขวาง")]).toEqual(["weir", "pond", "reservoir"]);
    const now = Date.parse("2026-10-01T10:00:00+07:00");
    expect(isStale("2026-09-23", now)).toBe(false);
    expect(isStale("2025-08-05", now)).toBe(true);
    expect(isStale(null, now)).toBe(true);
    expect(latestStorage([{ measureTime: "2026-09-01T00:00:00", variable: "Storage", value: 1, uom: "??" }])).toBeNull();
  });
});
