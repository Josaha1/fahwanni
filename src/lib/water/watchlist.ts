const KEY = "fah-water-watch";
const LEGACY_KEY = "fah-dam-watch";

export type WatchKey = `${"dam" | "river"}:${string}`;
export type WatchItem = { kind: "dam" | "river"; id: string; value: number; unit: "pct" | "cms"; date: string };
export type WaterWatch = Record<WatchKey, { value: number; unit: "pct" | "cms"; date: string; prevValue?: number; prevDate?: string }>;

function entries(value: unknown): [string, unknown][] {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : [];
}

export function readWatch(): WaterWatch {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored !== null) {
      return Object.fromEntries(entries(JSON.parse(stored)).filter(([key, entry]) => {
        if (!/^(dam|river):.+$/.test(key) || !entry || typeof entry !== "object" || Array.isArray(entry)) return false;
        const item = entry as WaterWatch[WatchKey];
        return Number.isFinite(item.value) && (item.unit === "pct" || item.unit === "cms") && typeof item.date === "string" &&
          (item.prevValue === undefined || Number.isFinite(item.prevValue)) &&
          (item.prevDate === undefined || typeof item.prevDate === "string");
      })) as WaterWatch;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === null) return {};
    const migrated = Object.fromEntries(entries(JSON.parse(legacy)).flatMap(([id, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const item = entry as { pct?: number; date?: string; prevPct?: number; prevDate?: string };
      if (!Number.isFinite(item.pct) || typeof item.date !== "string" ||
        (item.prevPct !== undefined && !Number.isFinite(item.prevPct)) ||
        (item.prevDate !== undefined && typeof item.prevDate !== "string")) return [];
      return [[`dam:${id}`, { value: item.pct, unit: "pct", date: item.date, ...(item.prevPct === undefined ? {} : { prevValue: item.prevPct }),
        ...(item.prevDate === undefined ? {} : { prevDate: item.prevDate }) }]];
    })) as WaterWatch;
    writeWatch(migrated);
    return migrated;
  } catch { return {}; }
}

export function writeWatch(watch: WaterWatch): void {
  try { localStorage.setItem(KEY, JSON.stringify(watch)); } catch { /* Keep the watch list for this visit. */ }
}

export function toggleWatch(watch: WaterWatch, item: WatchItem): WaterWatch {
  const key: WatchKey = `${item.kind}:${item.id}`;
  if (Object.hasOwn(watch, key)) {
    const next = { ...watch };
    delete next[key];
    return next;
  }
  return { ...watch, [key]: { value: item.value, unit: item.unit, date: item.date } };
}

export function refreshWatch(watch: WaterWatch, current: WatchItem[]): WaterWatch {
  const byKey = new Map(current.map((item) => [`${item.kind}:${item.id}`, item]));
  let next = watch;
  for (const [key, entry] of Object.entries(watch)) {
    const item = byKey.get(key);
    if (item && item.date > entry.date) {
      if (next === watch) next = { ...watch };
      next[key as WatchKey] = { value: item.value, unit: item.unit, date: item.date, prevValue: entry.value, prevDate: entry.date };
    }
  }
  return next;
}

export function watchRows<T extends WatchItem>(watch: WaterWatch, current: T[]): { item: T; change: number | null; since: string | null }[] {
  const byKey = new Map(current.map((item) => [`${item.kind}:${item.id}`, item]));
  return Object.entries(watch).flatMap(([key, entry]) => {
    const item = byKey.get(key);
    return item ? [{ item, change: entry.prevValue === undefined ? null : entry.value - entry.prevValue, since: entry.prevDate ?? null }] : [];
  });
}
