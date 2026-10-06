"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useWaterWatch } from "@/hooks/use-favourites";
import { provinceWarnings } from "@/components/provinces/data";
import { waterPoints } from "@/components/sheet/home-data";
import type { FloodNowPayload } from "@/components/flood/home-data";
import type { DamsPayload } from "@/lib/dams/client";
import { provinces } from "@/lib/provinces";
import { warningKey, type TmdWarnings } from "@/lib/tmd";
import { readWatch, type WaterWatch } from "@/lib/water/watchlist";
import { diffFollowed, mergeFollowed, readSeen, saveFollowed, type FollowSnapshot, type FollowChange } from "@/lib/water/whats-new";

export type FollowSources = { dams: DamsPayload | null; flood: FloodNowPayload | null; warnings: TmdWarnings | null; warningDate?: string };

export function followedSnapshot(watch: WaterWatch, sources: FollowSources): FollowSnapshot {
  const snapshot: FollowSnapshot = {};
  for (const key of Object.keys(watch)) {
    if (key.startsWith("dam:")) {
      const dam = sources.dams?.dams.find((item) => item.id === key.slice(4));
      if (!dam) continue;
      const metric = (value: number) => ({ value, date: dam.date, source: "กรมชลประทาน" });
      snapshot[key] = { ...(Number.isFinite(dam.storagePct) ? { pct: metric(dam.storagePct) } : {}),
        ...(dam.releaseCms !== null && Number.isFinite(dam.releaseCms) ? { release: metric(dam.releaseCms) } : {}) };
    } else if (key.startsWith("province:")) {
      const province = provinces.find((item) => item.id === key.slice(9));
      if (!province) continue;
      const counts = sources.flood?.provinceCounts[province.id];
      const observed = counts && counts.sampled > counts.noData + counts.insufficientData;
      snapshot[key] = {
        ...(observed && sources.flood ? { water: { value: waterPoints(counts), date: sources.flood.date, source: "NASA VIIRS" } } : {}),
        ...(sources.warnings && sources.warningDate ? { warnings: {
          ids: provinceWarnings(sources.warnings.items, province).map(warningKey), date: sources.warningDate,
        } } : {}),
      };
    }
  }
  return snapshot;
}

const emptyChanges: FollowChange[] = [];
let baseline: FollowSnapshot | null | undefined;
let latest: FollowSnapshot = {};
let changes = emptyChanges;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => changes;
const getServerSnapshot = () => emptyChanges;

export function useFollowed(sources: FollowSources) {
  const { watch } = useWaterWatch();
  const news = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { dams, flood, warnings, warningDate } = sources;
  useEffect(() => {
    if (baseline === undefined) { baseline = readSeen()?.followed ?? null; latest = baseline ?? {}; }
    const active = readWatch();
    const keep = (snapshot: FollowSnapshot) => Object.fromEntries(Object.entries(snapshot).filter(([key]) => Object.hasOwn(active, key)));
    if (baseline) baseline = keep(baseline);
    latest = mergeFollowed(keep(latest), followedSnapshot(active, { dams, flood, warnings, warningDate }));
    // Keep the previous visit fixed across client navigation and partial source loads.
    // A newly followed item starts with today's report, rather than old unfollowed data.
    baseline = Object.fromEntries(Object.entries(latest).map(([key, entry]) => [key, { ...entry, ...baseline?.[key] }]));
    const next = diffFollowed(baseline, latest);
    saveFollowed(latest);
    if (JSON.stringify(next) !== JSON.stringify(changes)) { changes = next; listeners.forEach((listener) => listener()); }
  }, [watch, dams, flood, warnings, warningDate]);
  return news;
}
