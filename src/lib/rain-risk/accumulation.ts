const HOUR = 3_600_000;

export function accumulateRain(days: { hours: string[]; precip: ArrayLike<number>[] }[], fromMs: number, hours = 72):
  { values: Float32Array; toMs: number } | null {
  const end = fromMs + hours * HOUR;
  const seen = new Set<number>();
  let values: Float32Array | null = null;
  let toMs = fromMs;
  for (const day of days) {
    for (let index = 0; index < day.hours.length; index++) {
      const time = Date.parse(day.hours[index]);
      if (!Number.isFinite(time) || time <= fromMs || time > end || seen.has(time)) continue;
      const row = day.precip[index];
      if (!row?.length || (values && row.length !== values.length)) return null;
      if (!values) values = new Float32Array(row.length);
      for (let point = 0; point < row.length; point++) {
        if (!Number.isFinite(row[point])) return null;
        values[point] += row[point];
      }
      seen.add(time);
      toMs = Math.max(toMs, time);
    }
  }
  if (!values || seen.size < hours - 2) return null;
  return { values, toMs };
}

export function accumulationRgba(mm: number): [number, number, number, number] | null {
  if (mm >= 150) return [185, 28, 28, 140];
  if (mm >= 90) return [249, 115, 22, 110];
  return null;
}
