import { describe, expect, it } from "vitest";
import { buildReservoirPoints, RESERVOIR_GREY, reservoirColor } from "./reservoirs";
import type { DwrReservoir } from "./dwr";

const base: DwrReservoir = { code: "A", name: "อ่างเก็บน้ำทดสอบ", lat: 14, lon: 100, size: "small", kind: "reservoir", owner: "RID",
  capacityMcm: 10, storageMcm: 9, pct: 90, measuredAt: "2026-09-29" };
const now = Date.parse("2026-10-01T10:00:00+07:00");

describe("reservoir points", () => {
  it("merges DWR and OSM with namespaced ids", () => {
    const points = buildReservoirPoints([base], [{ id: "way/1", nameTh: "เขื่อนแม่กลอง", nameEn: "Mae Klong Dam", lat: 13.95, lon: 99.62 }]);
    expect(points.map((point) => [point.id, point.source, point.kind])).toEqual([["dwr:A", "dwr", "reservoir"], ["osm:way/1", "osm", "dam"]]);
    expect(points[1]).toMatchObject({ storageMcm: null, pct: null, owner: null });
  });

  it("colours only current readings with a known capacity", () => {
    const [current] = buildReservoirPoints([base], []);
    expect(reservoirColor(current, now)).not.toBe(RESERVOIR_GREY);
    const [old] = buildReservoirPoints([{ ...base, measuredAt: "2025-08-05" }], []);
    expect(reservoirColor(old, now)).toBe(RESERVOIR_GREY);
    const [unknown] = buildReservoirPoints([{ ...base, pct: null, capacityMcm: null }], []);
    expect(reservoirColor(unknown, now)).toBe(RESERVOIR_GREY);
  });
});
