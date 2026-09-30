import type { Dam } from "./types";

export interface DamTrend {
  dates: string[];
  pct: Record<string, (number | null)[]>;
  /** Release m³/s per report date; null when the dam did not report that day (never a back-filled value). */
  release: Record<string, (number | null)[]>;
}

export function trendDates(dataDate: string, days = 7): string[] {
  const start = Date.parse(`${dataDate}T00:00:00Z`);
  if (!Number.isFinite(start)) return [];
  return Array.from({ length: days }, (_, index) =>
    new Date(start - (days - index) * 86_400_000).toISOString().slice(0, 10));
}

export function buildTrend(reports: { date: string; dams: Dam[] }[]): DamTrend {
  const ordered = [...reports].sort((a, b) => a.date.localeCompare(b.date));
  const dates = ordered.map(({ date }) => date);
  const ids = new Set(ordered.flatMap(({ dams }) => dams.map(({ id }) => id)));
  const pct: DamTrend["pct"] = {};
  const release: DamTrend["release"] = {};
  for (const id of ids) {
    pct[id] = ordered.map(({ dams }) => dams.find((dam) => dam.id === id)?.storagePct ?? null);
    release[id] = ordered.map(({ date, dams }) => {
      const dam = dams.find((entry) => entry.id === id);
      return dam && dam.date === date ? dam.releaseCms : null;
    });
  }
  return { dates, pct, release };
}

export function trendDelta(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length < 2 ? null : present.at(-1)! - present[0];
}
