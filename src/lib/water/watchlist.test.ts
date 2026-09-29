import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../dams/fixture-rid.json";
import { parseRidDams } from "../dams/rid";
import { readWatch, refreshWatch, toggleWatch, watchRows, writeWatch, type WatchItem } from "./watchlist";

const [bhumibol, second] = parseRidDams(fixture).dams;
const dam = (source = bhumibol): WatchItem => ({ kind: "dam", id: source.id, value: source.storagePct, unit: "pct", date: source.date });
const river: WatchItem = { kind: "river", id: bhumibol.id, value: 100, unit: "cms", date: bhumibol.date };

afterEach(() => vi.unstubAllGlobals());

describe("water watch list", () => {
  it("toggles dam and river independently and preserves insertion order", () => {
    const first = toggleWatch({}, dam());
    const both = toggleWatch(toggleWatch(first, river), dam(second));
    expect(Object.keys(both)).toEqual([`dam:${bhumibol.id}`, `river:${bhumibol.id}`, `dam:${second.id}`]);
    expect(watchRows(both, [dam(second), river, dam()]).map(({ item }) => item.kind)).toEqual(["dam", "river", "dam"]);
    expect(Object.keys(toggleWatch(both, dam()))).toEqual([`river:${bhumibol.id}`, `dam:${second.id}`]);
  });

  it("records previous value only for a newer date", () => {
    const watch = toggleWatch({}, dam());
    const newer = { ...dam(), date: "2099-01-01", value: dam().value + 3.2 };
    const refreshed = refreshWatch(watch, [newer]);
    expect(refreshed[`dam:${bhumibol.id}`]).toEqual({ value: newer.value, unit: "pct", date: newer.date, prevValue: dam().value, prevDate: dam().date });
    expect(watchRows(refreshed, [newer])[0].change).toBeCloseTo(3.2);
    expect(watchRows(refreshed, [newer])[0].since).toBe(dam().date);
    expect(refreshWatch(refreshed, [newer])).toBe(refreshed);
    expect(refreshWatch(watch, [{ ...dam(), value: 99 }])).toBe(watch);
    expect(refreshWatch(watch, [{ ...dam(), date: "2000-01-01" }])).toBe(watch);
  });

  it("migrates legacy storage once without deleting it", () => {
    const data = new Map<string, string>([["fah-dam-watch", JSON.stringify({ [bhumibol.id]: { pct: 64, date: "2026-09-01", prevPct: 60, prevDate: "2026-08-31" } })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    expect(readWatch()).toEqual({ [`dam:${bhumibol.id}`]: { value: 64, unit: "pct", date: "2026-09-01", prevValue: 60, prevDate: "2026-08-31" } });
    expect(data.has("fah-dam-watch")).toBe(true);
    expect(JSON.parse(data.get("fah-water-watch")!)).toEqual(readWatch());
    writeWatch(toggleWatch(readWatch(), river));
    expect(Object.keys(readWatch())).toEqual([`dam:${bhumibol.id}`, `river:${bhumibol.id}`]);
  });

  it("prefers existing new storage and ignores malformed entries", () => {
    const data = new Map<string, string>([["fah-dam-watch", JSON.stringify({ [bhumibol.id]: { pct: 64, date: "2026-09-01" } })],
      ["fah-water-watch", JSON.stringify({ "dam:bad": { value: "no", unit: "pct", date: "2026-09-01" }, "river:ok": { value: 20, unit: "cms", date: "2026-09-01" } })]]);
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    expect(readWatch()).toEqual({ "river:ok": { value: 20, unit: "cms", date: "2026-09-01" } });
    data.set("fah-water-watch", "{");
    expect(readWatch()).toEqual({});
  });
});
