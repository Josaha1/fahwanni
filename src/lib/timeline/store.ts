import { TZDate } from "@date-fns/tz";
import { bracket, DAY, HOUR } from "./time";

export type WindVar = "u" | "v" | "precip" | "prob" | "temp" | "feels";
export type Pm25Var = "pm25";

export interface HourlySeries {
  times: number[];
  grids: Record<string, Float32Array[]>;
}

type DayGrids = { hours: string[]; [variable: string]: string[] | ArrayLike<number>[] };

/** Preserve already converted day chunks when merging loaded days. */
export function mergeDays(days: DayGrids[], vars: string[]): HourlySeries {
  const hours = days.flatMap((day) => day.hours.map((hour, index) => ({ day, index, time: Date.parse(hour) })))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => a.time - b.time);
  const times: number[] = [];
  const grids: Record<string, Float32Array[]> = Object.fromEntries(vars.map((variable) => [variable, []]));
  for (const hour of hours) {
    if (times.at(-1) === hour.time) continue;
    times.push(hour.time);
    for (const variable of vars) {
      const row = (hour.day[variable] as ArrayLike<number>[])[hour.index];
      grids[variable].push(row instanceof Float32Array ? row : Float32Array.from(row));
    }
  }
  return { times, grids };
}

export function sampleSeries(series: HourlySeries, variable: string, t: number):
  { a: Float32Array; b: Float32Array; f: number; exact: boolean } | null {
  const { times } = series;
  if (!times.length || t < times[0] - HOUR || t > times[times.length - 1] + HOUR) return null;
  const position = bracket(t, times);
  if (!position) return null;
  const a = series.grids[variable]?.[position.i];
  const b = series.grids[variable]?.[Math.min(position.i + 1, times.length - 1)];
  if (!a || !b) return null;
  return { a, b, f: position.f, exact: position.f === 0 };
}

export function localDayIndex(t: number, nowMs: number): number {
  const date = new TZDate(t, "Asia/Bangkok");
  const today = new TZDate(nowMs, "Asia/Bangkok");
  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.min(6, Math.round((dateDay - todayDay) / DAY)));
}

export function daysToLoad(focusDay: number, loaded: Set<number>, failed: Set<number>, max = 6): number[] {
  return [focusDay, focusDay + 1].filter((day) => day >= 0 && day <= max && !loaded.has(day) && !failed.has(day));
}
