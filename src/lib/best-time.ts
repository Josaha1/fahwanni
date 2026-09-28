import { TZDate } from "@date-fns/tz";
import type { WeatherHour } from "./weather/types";

export type Activity = "outdoor" | "exercise";

export interface BestWindow {
  start: string; // ISO of the first hour
  end: string;   // ISO end of the last hour
  /** Worst hour in the window was still comfortable enough to recommend. */
  good: boolean;
}

const WINDOW = 2;

/**
 * Discomfort score for one hour (lower is better). Exercise is stricter on heat and UV
 * because exertion adds heat stress; PM2.5 above the Thai "moderate" band rules exercise out.
 */
export function hourPenalty(hour: WeatherHour, activity: Activity, pm25?: number): number {
  const feels = hour.heatIndexC ?? hour.feelsLikeC ?? hour.tempC ?? 30;
  const heatLimit = activity === "exercise" ? 30 : 33;
  const uvLimit = activity === "exercise" ? 3 : 5;
  let penalty = (hour.rainChance ?? 0) + (hour.thunderChance ?? 0);
  penalty += Math.max(0, feels - heatLimit) * 8;
  penalty += Math.max(0, (hour.uvIndex ?? 0) - uvLimit) * 6;
  if (activity === "exercise" && pm25 !== undefined && pm25 > 37.5) penalty += 100;
  return penalty;
}

/**
 * Best consecutive 2-hour window between 06:00 and 20:00 local time within the next 24 h.
 * Returns undefined when there are not enough daytime hours left.
 */
export function bestWindow(hours: WeatherHour[], timeZone: string, nowIso: string, activity: Activity, pm25?: number): BestWindow | undefined {
  const now = Date.parse(nowIso);
  const usable = hours.filter((hour) => {
    if (!hour.startTime) return false;
    const start = Date.parse(hour.startTime);
    if (start + 60 * 60 * 1000 <= now || start > now + 24 * 60 * 60 * 1000) return false;
    const local = new TZDate(hour.startTime, timeZone).getHours();
    return local >= 6 && local < 20;
  });
  let best: { index: number; score: number; worst: number } | undefined;
  for (let i = 0; i + WINDOW <= usable.length; i++) {
    const slice = usable.slice(i, i + WINDOW);
    // Consecutive hours only (skip across the night gap).
    if (Date.parse(slice[WINDOW - 1].startTime!) - Date.parse(slice[0].startTime!) !== (WINDOW - 1) * 3600_000) continue;
    const penalties = slice.map((hour) => hourPenalty(hour, activity, pm25));
    const score = penalties.reduce((a, b) => a + b, 0);
    if (!best || score < best.score) best = { index: i, score, worst: Math.max(...penalties) };
  }
  if (!best) return undefined;
  const first = usable[best.index];
  const last = usable[best.index + WINDOW - 1];
  return {
    start: first.startTime!,
    end: last.endTime ?? new Date(Date.parse(last.startTime!) + 3600_000).toISOString(),
    good: best.worst < 40,
  };
}
