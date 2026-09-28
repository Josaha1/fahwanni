import { describe, expect, it } from "vitest";
import { diffFromYesterday, recordDay } from "./yesterday";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    data,
  };
}

describe("yesterday comparison", () => {
  it("compares today's high with yesterday's recorded high", () => {
    const storage = memoryStorage();
    recordDay(storage, 13.75, 100.5, "2026-09-27", 31.4, 25);
    expect(diffFromYesterday(storage, 13.75, 100.5, "2026-09-28", 33.6)).toBe(2);
    expect(diffFromYesterday(storage, 13.75, 100.5, "2026-09-28", 29.6)).toBe(-2);
  });

  it("is undefined without a record for the previous day", () => {
    const storage = memoryStorage();
    recordDay(storage, 13.75, 100.5, "2026-09-25", 31, 25);
    expect(diffFromYesterday(storage, 13.75, 100.5, "2026-09-28", 33)).toBeUndefined();
    expect(diffFromYesterday(memoryStorage(), 13.75, 100.5, "2026-09-28", 33)).toBeUndefined();
  });

  it("crosses month and year boundaries", () => {
    const storage = memoryStorage();
    recordDay(storage, 18.79, 98.98, "2026-12-31", 28);
    expect(diffFromYesterday(storage, 18.79, 98.98, "2027-01-01", 25)).toBe(-3);
  });

  it("keys by rounded coordinates and keeps only the last three days", () => {
    const storage = memoryStorage();
    for (const d of ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]) recordDay(storage, 13.751, 100.499, d, 30);
    const saved = JSON.parse(storage.data.get("fah-history:13.75,100.50")!);
    expect(Object.keys(saved)).toEqual(["2026-09-25", "2026-09-26", "2026-09-27"]);
  });

  it("ignores corrupted storage", () => {
    const storage = memoryStorage();
    storage.setItem("fah-history:13.75,100.50", "{oops");
    expect(diffFromYesterday(storage, 13.75, 100.5, "2026-09-28", 33)).toBeUndefined();
  });
});
