import { roundCoord } from "./geo";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type DayRecord = { maxC: number; minC?: number };
type History = Record<string, DayRecord>; // keyed by local date YYYY-MM-DD

const KEEP_DAYS = 3;
const key = (lat: number, lon: number) => `fah-history:${roundCoord(lat).toFixed(2)},${roundCoord(lon).toFixed(2)}`;

function load(storage: StorageLike, lat: number, lon: number): History {
  try {
    const value: unknown = JSON.parse(storage.getItem(key(lat, lon)) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as History : {};
  } catch {
    return {};
  }
}

/** Remembers today's forecast high/low for a place (the device keeps the last few days). */
export function recordDay(storage: StorageLike, lat: number, lon: number, date: string, maxC: number, minC?: number): void {
  const history = { ...load(storage, lat, lon), [date]: { maxC, minC } };
  const kept = Object.keys(history).sort().slice(-KEEP_DAYS);
  try {
    storage.setItem(key(lat, lon), JSON.stringify(Object.fromEntries(kept.map((d) => [d, history[d]]))));
  } catch { /* storage full or blocked: comparison is optional */ }
}

function previousDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Today's high minus yesterday's recorded high, rounded; undefined if yesterday was not seen. */
export function diffFromYesterday(storage: StorageLike, lat: number, lon: number, today: string, maxC: number): number | undefined {
  const yesterday = load(storage, lat, lon)[previousDate(today)];
  if (!yesterday || !Number.isFinite(yesterday.maxC)) return undefined;
  return Math.round(maxC - yesterday.maxC);
}
