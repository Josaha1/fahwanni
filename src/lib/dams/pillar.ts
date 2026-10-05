import { DAM_REGISTRY, damRegistryById } from "./registry";
import type { Dam } from "./types";
import type { DamTrend } from "./trend";

export function previousDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

export function releaseTotal(values: (number | null | undefined)[]) {
  const reported = values.filter((value): value is number => value != null && Number.isFinite(value));
  return { value: reported.length ? reported.reduce((sum, value) => sum + value, 0) : null, missing: values.length - reported.length };
}

export function nationalDrainage(dams: Dam[], date: string, trend: DamTrend | null) {
  const byId = new Map(dams.filter((dam) => dam.date === date).map((dam) => [dam.id, dam]));
  const current = [...byId.values()];
  const yesterday = previousDate(date);
  const index = trend?.dates.indexOf(yesterday) ?? -1;
  const comparable = current.filter((dam) => dam.releaseCms !== null && dam.inflowCms !== null);
  return {
    today: releaseTotal(DAM_REGISTRY.map(({ id }) => byId.get(id)?.releaseCms)),
    yesterday: releaseTotal(DAM_REGISTRY.map(({ id }) => index < 0 ? null : trend?.release[id]?.[index])),
    yesterdayDate: yesterday,
    over80: current.filter((dam) => dam.storagePct > 80).length,
    over100: current.filter((dam) => dam.storagePct > 100).length,
    missingStorage: DAM_REGISTRY.length - current.length,
    releasingMore: comparable.filter((dam) => dam.releaseCms! > dam.inflowCms!).length,
    missingComparison: DAM_REGISTRY.length - comparable.length,
  };
}

/** Compare exact calendar endpoints; a shorter or interrupted history is not a seven-day change. */
export function sevenDayChange(trend: DamTrend | null, id: string, date: string): number | null {
  if (!trend) return null;
  const startDate = new Date(Date.parse(`${date}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
  const end = trend.pct[id]?.[trend.dates.indexOf(date)];
  const start = trend.pct[id]?.[trend.dates.indexOf(startDate)];
  return start == null || end == null ? null : end - start;
}

export function inProvince(dam: Dam, provinceId: string, downstream: Record<string, { provinces: { id: string }[] }>): boolean {
  return damRegistryById.get(dam.id)?.provinceId === provinceId || Boolean(downstream[dam.id]?.provinces.some((entry) => entry.id === provinceId));
}
