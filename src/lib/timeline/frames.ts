import type { PrimaryLayer } from "@/lib/map/legend";

export type { PrimaryLayer } from "@/lib/map/legend";

export interface TimelineStop {
  kind: "radar" | "model";
  time: string;
  index: number;
}

export function buildTimeline(radarTimes: string[], modelHours: string[], nowIso: string): TimelineStop[] {
  const radar: TimelineStop[] = radarTimes.map((time, index): TimelineStop => ({
    kind: "radar", time: new Date(time).toISOString(), index,
  })).sort((a, b) => a.time.localeCompare(b.time));
  const newestRadar = radar.length ? Date.parse(radar[radar.length - 1].time) : -Infinity;
  const cutoff = Date.parse(nowIso) - 30 * 60 * 1000;
  const model: TimelineStop[] = modelHours.map((time, index): TimelineStop => ({
    kind: "model", time: new Date(time).toISOString(), index,
  })).filter((stop) => {
    const time = Date.parse(stop.time);
    return time > newestRadar && time > cutoff;
  }).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 12);

  return [...radar, ...model];
}

export function buildLayerTimeline(
  primary: PrimaryLayer,
  input: { radarTimes: string[]; modelHours: string[]; hourly?: string[] },
  nowIso: string,
): TimelineStop[] {
  if (primary === "rain") return buildTimeline(input.radarTimes, input.modelHours, nowIso);

  const currentHour = Math.floor(Date.parse(nowIso) / 3_600_000) * 3_600_000;
  return (input.hourly ?? []).map((time, index): TimelineStop => ({
    kind: "model", time: new Date(time).toISOString(), index,
  })).filter((stop) => Date.parse(stop.time) >= currentHour)
    .sort((a, b) => a.time.localeCompare(b.time)).slice(0, 13);
}

export function defaultIndex(stops: TimelineStop[]): number {
  for (let index = stops.length - 1; index >= 0; index--) {
    if (stops[index].kind === "radar") return index;
  }
  return 0;
}

export function defaultIndexFor(primary: PrimaryLayer, stops: TimelineStop[], nowIso: string): number {
  if (primary === "rain") return defaultIndex(stops);
  for (let index = stops.length - 1; index >= 0; index--) {
    if (Date.parse(stops[index].time) <= Date.parse(nowIso)) return index;
  }
  return 0;
}

export function nextPlayIndex(stops: TimelineStop[], current: number): number {
  if (current < 0 || current >= stops.length) return 0;
  return (current + 1) % stops.length;
}

export function playDelayMs(stops: TimelineStop[], current: number, defaultIdx: number): number {
  return current === defaultIdx || current === stops.length - 1 ? 1500 : 600;
}

export function windHourFor(stop: TimelineStop | undefined, windHours: string[], nowIso: string): number {
  const time = Date.parse(stop?.time ?? nowIso);
  let index = 0;
  windHours.forEach((hour, i) => { if (Date.parse(hour) <= time) index = i; });
  return index;
}

export function segmentShares(stops: TimelineStop[]): { radar: number; model: number } {
  if (!stops.length) return { radar: 0, model: 0 };
  const radar = stops.filter((stop) => stop.kind === "radar").length / stops.length;
  return { radar, model: 1 - radar };
}

export function stopLabelKey(stop: TimelineStop): "เรดาร์" | "แบบจำลอง" {
  return stop.kind === "radar" ? "เรดาร์" : "แบบจำลอง";
}
