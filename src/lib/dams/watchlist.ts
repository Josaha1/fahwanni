import type { Dam } from "./types";

const KEY = "fah-dam-watch";

export type DamWatch = Record<string, { pct: number; date: string; prevPct?: number; prevDate?: string }>;

export function readWatch(): DamWatch {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const item = entry as DamWatch[string];
      return Number.isFinite(item.pct) && typeof item.date === "string" &&
        (item.prevPct === undefined || Number.isFinite(item.prevPct)) &&
        (item.prevDate === undefined || typeof item.prevDate === "string");
    })) as DamWatch;
  } catch { return {}; }
}

export function writeWatch(watch: DamWatch): void {
  try { localStorage.setItem(KEY, JSON.stringify(watch)); } catch { /* Keep the watch list for this visit. */ }
}

export function toggleWatch(watch: DamWatch, dam: Dam): DamWatch {
  if (Object.hasOwn(watch, dam.id)) {
    const next = { ...watch };
    delete next[dam.id];
    return next;
  }
  return { ...watch, [dam.id]: { pct: dam.storagePct, date: dam.date } };
}

export function refreshWatch(watch: DamWatch, dams: Dam[]): DamWatch {
  const byId = new Map(dams.map((dam) => [dam.id, dam]));
  let next = watch;
  for (const [id, entry] of Object.entries(watch)) {
    const dam = byId.get(id);
    if (dam && dam.date > entry.date) {
      if (next === watch) next = { ...watch };
      next[id] = { pct: dam.storagePct, date: dam.date, prevPct: entry.pct, prevDate: entry.date };
    }
  }
  return next;
}

export function watchRows(watch: DamWatch, dams: Dam[]): { dam: Dam; change: number | null; since: string | null }[] {
  const byId = new Map(dams.map((dam) => [dam.id, dam]));
  return Object.entries(watch).flatMap(([id, entry]) => {
    const dam = byId.get(id);
    return dam ? [{ dam, change: entry.prevPct === undefined ? null : entry.pct - entry.prevPct, since: entry.prevDate ?? null }] : [];
  });
}
