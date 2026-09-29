import { afterEach, describe, expect, it, vi } from "vitest";
import { diffSinceSeen, hasNews, markSeen, readSeen, type NewsItem, type Seen } from "./whats-new";

const current: NewsItem[] = [
  { key: "dam:one", label: "เขื่อนหนึ่ง", value: 50, unit: "pct", status: "ปกติ", date: "2026-09-01" },
  { key: "river:two", label: "แม่น้ำสอง", value: 100, unit: "cms", status: "ปกติ", date: "2026-09-01" },
];
const seen: Seen = { at: "2026-09-01T00:00:00.000Z", items: {
  "dam:one": { value: 50, status: "ปกติ", date: "2026-09-01" },
  "river:two": { value: 100, status: "ปกติ", date: "2026-09-01" },
} };

afterEach(() => vi.unstubAllGlobals());

describe("water news", () => {
  it("needs a previous visit and ignores changes at the thresholds", () => {
    expect(diffSinceSeen(null, current)).toEqual([]);
    expect(hasNews(null, current)).toBe(false);
    expect(diffSinceSeen(seen, [{ ...current[0], value: 53 }, { ...current[1], value: 115 }])).toEqual([]);
  });

  it("sorts status before change before newer data and reports one reason per item", () => {
    const news = diffSinceSeen(seen, [
      { ...current[0], date: "2026-09-02" },
      { ...current[1], value: 116, date: "2026-09-02" },
      { key: "dam:three", label: "เขื่อนสาม", value: 90, unit: "pct", status: "สูง", date: "2026-09-02" },
    ]);
    expect(news.map(({ kind }) => kind)).toEqual(["change", "new-data"]);
    expect(news[0].params).toMatchObject({ from: 100, to: 116, unit: "m³/s" });
    expect(diffSinceSeen(seen, [{ ...current[0], value: 54, status: "สูงกว่าปกติ", date: "2026-09-02" }])[0]).toMatchObject({ kind: "status", params: { label: "เขื่อนหนึ่ง", from: "ปกติ", to: "สูงกว่าปกติ" } });
  });

  it("orders mixed changes by priority and treats zero river baseline as a change", () => {
    const baseline: Seen = { ...seen, items: { ...seen.items, "river:two": { value: 0, status: "ปกติ", date: "2026-09-01" },
      "dam:three": { value: 20, status: "ปกติ", date: "2026-09-01" } } };
    const news = diffSinceSeen(baseline, [
      { ...current[0], date: "2026-09-02" },
      { ...current[1], value: 1, date: "2026-09-02" },
      { key: "dam:three", label: "เขื่อนสาม", value: 20, unit: "pct", status: "สูง", date: "2026-09-02" },
    ]);
    expect(news.map(({ kind }) => kind)).toEqual(["status", "change", "new-data"]);
  });

  it("marks and reads a snapshot", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    const snapshot = markSeen(current);
    expect(snapshot.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(readSeen()).toEqual(snapshot);
    expect(hasNews(readSeen(), current)).toBe(false);
    expect(hasNews(readSeen(), [{ ...current[0], value: 54 }])).toBe(true);
    data.set("fah-water-seen", "{");
    expect(readSeen()).toBeNull();
  });
});
