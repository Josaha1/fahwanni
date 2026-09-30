import type { DamTrend } from "../dams/trend";
import type { ObservedRelease, RiverTrend } from "./types";

type DamRelease = { id: string; date: string; releaseCms: number | null };

const round = (value: number) => Math.round(value * 10) / 10;

/** Sums the upstream dams' release; never treats a dam that did not report as 0. */
export function sumRelease(damIds: string[], dams: DamRelease[], trend: DamTrend | null): ObservedRelease | null {
  if (!damIds.length) return null;
  const byId = new Map(dams.map((dam) => [dam.id, dam]));
  const perDam = damIds.map((damId) => {
    const dam = byId.get(damId);
    const releaseCms = dam && dam.releaseCms !== null && Number.isFinite(dam.releaseCms) ? dam.releaseCms : null;
    return { damId, releaseCms, date: releaseCms === null ? null : dam!.date };
  });
  const present = perDam.filter((dam): dam is typeof dam & { releaseCms: number; date: string } => dam.releaseCms !== null);
  const today = present.length ? {
    date: present.map((dam) => dam.date).sort()[0],
    totalCms: round(present.reduce((sum, dam) => sum + dam.releaseCms, 0)),
    missing: perDam.filter((dam) => dam.releaseCms === null).map((dam) => dam.damId),
  } : null;
  const days = (trend?.dates ?? []).map((date, index) => {
    const values = damIds.map((damId) => trend?.release?.[damId]?.[index] ?? null);
    return { date, totalCms: values.every((value): value is number => value !== null && Number.isFinite(value))
      ? round(values.reduce((sum, value) => sum + value, 0)) : null };
  });
  return { today, trend: releaseTrend(today, days), dams: perDam, days };
}

function releaseTrend(today: ObservedRelease["today"], days: ObservedRelease["days"]): RiverTrend | null {
  const first = days.find((day) => day.totalCms !== null);
  if (!today || today.missing.length || !first || first.date >= today.date) return null;
  const base = first.totalCms!;
  if (base === 0) return today.totalCms > 0 ? "rising" : "steady";
  if (today.totalCms > base * 1.1) return "rising";
  if (today.totalCms < base * 0.9) return "falling";
  return "steady";
}

/** The number a watched river point is compared by: model discharge, or the observed point's summed release. */
export function riverWatchValue(point: { summary: { today: { value: number; date: string } } | null; release?: ObservedRelease | null }):
  { value: number; date: string } | null {
  if (point.summary) return { value: point.summary.today.value, date: point.summary.today.date };
  const today = point.release?.today;
  return today && !today.missing.length ? { value: today.totalCms, date: today.date } : null;
}
