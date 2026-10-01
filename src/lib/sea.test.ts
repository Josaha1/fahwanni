import { describe, expect, it } from "vitest";
import { bleachingLevel, erddapUrl, inThaiSeas, nearestSeaReading } from "./sea";

const table = { table: { columnNames: ["time", "latitude", "longitude", "CRW_SST", "CRW_DHW", "CRW_BAA"], rows: [
  ["2026-09-29T12:00:00Z", 10.125, 99.875, 29.6, 0, 0],
  ["2026-09-29T12:00:00Z", 10.075, 99.825, null, null, null],
  ["2026-09-29T12:00:00Z", 10.175, 99.925, 30.12, 4.36, 3],
] } };

describe("sea heat", () => {
  it("picks the nearest sea pixel and skips land", () => {
    expect(nearestSeaReading(table, 10.1, 99.84)).toEqual({ date: "2026-09-29", lat: 10.125, lon: 99.875, sstC: 29.6, dhw: 0, level: 0 });
    expect(nearestSeaReading(table, 10.18, 99.93)).toMatchObject({ sstC: 30.1, dhw: 4.4, level: 3 });
    expect(nearestSeaReading({ table: { columnNames: table.table.columnNames, rows: [table.table.rows[1]] } }, 10, 99)).toBeNull();
  });

  it("maps alert areas and keeps queries inside Thai seas", () => {
    expect([0, 1, 2, 3, 4, 6].map(bleachingLevel)).toEqual([0, 1, 2, 3, 4, 4]);
    expect(inThaiSeas(10.1, 99.84)).toBe(true);
    expect(inThaiSeas(35, 139)).toBe(false);
    expect(erddapUrl(10.1, 99.84)).toContain("CRW_DHW%5Blast%5D%5B(9.950):(10.250)%5D%5B(99.690):(99.990)%5D");
  });
});
