import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixture-rid.json";
import { parseRidDams } from "./rid";
import { readWatch, refreshWatch, toggleWatch, watchRows, writeWatch } from "./watchlist";

const [bhumibol, second] = parseRidDams(fixture).dams;

afterEach(() => vi.unstubAllGlobals());

describe("dam watch list", () => {
  it("toggles a dam and preserves insertion order", () => {
    const first = toggleWatch({}, bhumibol);
    expect(first).toEqual({ [bhumibol.id]: { pct: bhumibol.storagePct, date: bhumibol.date } });
    const both = toggleWatch(first, second);
    expect(watchRows(both, [second, bhumibol]).map(({ dam }) => dam.id)).toEqual([bhumibol.id, second.id]);
    expect(toggleWatch(both, bhumibol)).toEqual({ [second.id]: { pct: second.storagePct, date: second.date } });
  });

  it("records the previous report when a newer date arrives", () => {
    const watch = toggleWatch({}, bhumibol);
    const newer = { ...bhumibol, date: "2099-01-01", storagePct: bhumibol.storagePct + 3.2 };
    const refreshed = refreshWatch(watch, [newer]);
    expect(refreshed[bhumibol.id]).toEqual({ pct: newer.storagePct, date: newer.date, prevPct: bhumibol.storagePct, prevDate: bhumibol.date });
    expect(watchRows(refreshed, [newer])[0]).toMatchObject({ change: newer.storagePct - bhumibol.storagePct, since: bhumibol.date });
    expect(refreshWatch(refreshed, [newer])).toBe(refreshed);
  });

  it("ignores the same or an older date", () => {
    const watch = toggleWatch({}, bhumibol);
    expect(refreshWatch(watch, [{ ...bhumibol, storagePct: 99 }])).toBe(watch);
    expect(refreshWatch(watch, [{ ...bhumibol, date: "2000-01-01" }])).toBe(watch);
    expect(watchRows(watch, [bhumibol])[0]).toMatchObject({ change: null, since: null });
  });

  it("reads and writes storage, returning an empty list for bad JSON", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    writeWatch(toggleWatch({}, bhumibol));
    expect(readWatch()).toEqual(toggleWatch({}, bhumibol));
    data.set("fah-dam-watch", "{");
    expect(readWatch()).toEqual({});
  });
});
