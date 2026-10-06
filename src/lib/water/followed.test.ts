import { afterEach, describe, expect, it, vi } from "vitest";
import { diffFollowed, mergeFollowed, readSeen, saveFollowed, markSeen, type FollowSnapshot } from "./whats-new";
import { readWatch, toggleWatch, writeWatch } from "./watchlist";
import { followedSnapshot } from "@/hooks/use-followed";
import type { FloodNowPayload } from "@/components/flood/home-data";
import type { DamsPayload } from "@/lib/dams/client";

const metric = (value: number, date = "2026-10-06") => ({ value, date, source: "RID" });
afterEach(() => vi.unstubAllGlobals());

describe("diffFollowed", () => {
  it.each([[50, 60, true], [50, 59.9, false], [99, 100, true], [100, 99, false], [0, 1, true], [0, 0, false]])(
    "release %s → %s alerts: %s", (from, to, expected) => {
      const changes = diffFollowed({ "dam:a": { release: metric(from) } }, { "dam:a": { release: metric(to) } });
      expect(changes.length > 0).toBe(expected);
      if (expected) expect(changes[0]).toMatchObject({ kind: "release", from, to, source: "RID", date: "2026-10-06" });
    });
  it.each([[79, 80, true], [99, 100, true], [100, 99, true], [80, 79, true], [81, 90, false], [80, 80, false]])(
    "capacity %s → %s crosses a threshold: %s", (from, to, expected) => {
      expect(diffFollowed({ "dam:a": { pct: metric(from) } }, { "dam:a": { pct: metric(to) } }).length > 0).toBe(expected);
    });
  it.each([[0, 1, true], [10, 15, true], [10, 14, false], [10, 0, false]])(
    "satellite water %s → %s alerts: %s", (from, to, expected) => {
      expect(diffFollowed({ "province:bangkok": { water: metric(from) } }, { "province:bangkok": { water: metric(to) } }).length > 0).toBe(expected);
    });
  it("reports only new warnings with their published date and title", () => {
    const id = "2026-10-06T09:00:00+07:00|ฝนหนัก";
    const changes = diffFollowed({ "province:bangkok": { warnings: { ids: ["old"], date: "2026-10-05" } } },
      { "province:bangkok": { warnings: { ids: ["old", id], date: "2026-10-06" } } });
    expect(changes).toEqual([{ key: "province:bangkok", kind: "warning", from: 0, to: 1, source: "TMD", date: "2026-10-06T09:00:00+07:00", warningId: id, title: "ฝนหนัก" }]);
  });
  it("needs a baseline, ignores missing/older reports, and preserves previous values", () => {
    const prev: FollowSnapshot = { "dam:a": { release: metric(100), pct: metric(90) }, "province:bangkok": { water: metric(10) } };
    expect(diffFollowed(null, prev)).toEqual([]);
    expect(diffFollowed({}, prev)).toEqual([]);
    expect(diffFollowed(prev, { "dam:a": {}, "province:bangkok": {} })).toEqual([]);
    expect(diffFollowed(prev, { "dam:a": { release: metric(200, "2026-10-05") } })).toEqual([]);
    expect(mergeFollowed(prev, { "dam:a": { release: metric(200, "2026-10-05") }, "province:bangkok": {} })).toEqual(prev);
    expect(mergeFollowed(prev, { "dam:a": { pct: metric(100) } })["dam:a"]).toEqual({ release: metric(100), pct: metric(100) });
  });
});

describe("follow storage and reports", () => {
  it("extends the existing watch/seen keys and preserves legacy news when storing follow snapshots", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    const item = { kind: "province" as const, id: "bangkok", value: 0, unit: "points" as const, date: "2026-10-06" };
    writeWatch(toggleWatch({}, item));
    expect(readWatch()).toEqual({ "province:bangkok": { value: 0, unit: "points", date: item.date } });
    markSeen([{ key: "dam:a", label: "A", value: 80, unit: "pct", date: item.date }]);
    const followed = { "province:bangkok": { water: metric(0) } };
    saveFollowed(followed);
    expect(readSeen()?.items["dam:a"].value).toBe(80);
    expect(readSeen()?.followed).toEqual(followed);
    markSeen([]);
    expect(readSeen()?.followed).toEqual(followed);
    expect([...data.keys()].sort()).toEqual(["fah-water-seen", "fah-water-watch"]);
    writeWatch(toggleWatch(readWatch(), item));
    expect(readWatch()).toEqual({});
  });
  it("tolerates corrupt or unavailable storage", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{", setItem: () => { throw new Error("denied"); } });
    expect(readSeen()).toBeNull();
    expect(readWatch()).toEqual({});
    expect(() => saveFollowed({})).not.toThrow();
    expect(() => writeWatch({})).not.toThrow();
  });
  it("uses observed satellite counts and the existing province coverage for warnings", () => {
    const watch = toggleWatch(toggleWatch({}, { kind: "province", id: "bangkok", value: 0, unit: "points", date: "" }),
      { kind: "dam", id: "a", value: 0, unit: "pct", date: "" });
    const flood = { date: "2026-10-06", provinceCounts: { bangkok: {
      flood: 2, recurringFlood: 3, water: 99, dry: 5, insufficientData: 0, noData: 0, sampled: 109,
    } } } as unknown as FloodNowPayload;
    const sources = { flood, dams: { dams: [{ id: "a", releaseCms: null, storagePct: 80, date: flood.date }] } as DamsPayload,
      warnings: { items: [{ title: "ภาคกลาง", description: "ฝนหนัก" }, { title: "ภาคเหนือ", description: "ฝนหนัก" }] }, warningDate: flood.date };
    const snapshot = followedSnapshot(watch, sources);
    expect(snapshot["province:bangkok"].water?.value).toBe(5);
    expect(snapshot["province:bangkok"].warnings?.ids).toEqual(["|ภาคกลาง"]);
    expect(snapshot["dam:a"].release).toBeUndefined();
    flood.provinceCounts.bangkok.noData = 109;
    expect(followedSnapshot(watch, sources)["province:bangkok"].water).toBeUndefined();
    expect(followedSnapshot(watch, { dams: null, flood: null, warnings: null })).toEqual({ "province:bangkok": {} });
  });
});
