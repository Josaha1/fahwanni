export type TideSeries = { times: string[]; heights: number[] };

/** Open-Meteo returns local wall-clock hours when a timezone is requested. */
export function parseTide(raw: unknown): TideSeries | null {
  if (!raw || typeof raw !== "object") return null;
  const hourly = (raw as { hourly?: unknown }).hourly;
  if (!hourly || typeof hourly !== "object") return null;
  const { time, sea_level_height_msl: heights } = hourly as { time?: unknown; sea_level_height_msl?: unknown };
  if (!Array.isArray(time) || !Array.isArray(heights) || time.length !== heights.length || time.length < 3) return null;
  const times = time.map((value) => {
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null;
    const instant = new Date(`${value}+07:00`);
    return Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
  });
  if (times.some((value) => value === null) || heights.some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  if (times.some((value, index) => index > 0 && value! <= times[index - 1]!)) return null;
  return { times: times as string[], heights: heights as number[] };
}

export function highTides(series: TideSeries, hours = 48): { time: string; height: number }[] {
  const start = Date.parse(series.times[0]);
  const end = start + hours * 3_600_000;
  const peaks: { time: string; height: number }[] = [];
  for (let index = 1; index < series.times.length - 1; index++) {
    if (Date.parse(series.times[index]) >= end) break;
    const height = series.heights[index];
    if (height - series.heights[index - 1] >= 0.1 && height - series.heights[index + 1] >= 0.1) {
      peaks.push({ time: series.times[index], height });
    }
  }
  return peaks;
}
