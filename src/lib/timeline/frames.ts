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

export function defaultIndex(stops: TimelineStop[]): number {
  for (let index = stops.length - 1; index >= 0; index--) {
    if (stops[index].kind === "radar") return index;
  }
  return 0;
}

export function nextPlayIndex(stops: TimelineStop[], current: number): number {
  const firstRadar = stops.findIndex((stop) => stop.kind === "radar");
  if (firstRadar === -1) return 0;
  for (let index = current + 1; index < stops.length; index++) {
    if (stops[index].kind === "radar") return index;
  }
  return firstRadar;
}

export function segmentShares(stops: TimelineStop[]): { radar: number; model: number } {
  if (!stops.length) return { radar: 0, model: 0 };
  const radar = stops.filter((stop) => stop.kind === "radar").length / stops.length;
  return { radar, model: 1 - radar };
}

export function stopLabelKey(stop: TimelineStop): "เรดาร์" | "แบบจำลอง" {
  return stop.kind === "radar" ? "เรดาร์" : "แบบจำลอง";
}
