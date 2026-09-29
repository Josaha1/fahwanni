import type { RareLevel, RiverBand, RiverForecast, RiverForecastDay, RiverPoint, RiverStatus, RiverTrend } from "./types";

/** Calendar dates keep February 29 at day 60 in every year's climatology. */
export function calendarDoy(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid calendar date: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new RangeError(`Invalid calendar date: ${date}`);
  }
  const dayOfYear = Math.floor((time - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  return dayOfYear + (!leap && month > 2 ? 1 : 0);
}

export function riverStatus(value: number, band: RiverBand): RiverStatus {
  if (value < band.p25) return "low";
  if (value <= band.p75) return "normal";
  if (value <= band.p90) return "high";
  return "veryHigh";
}

export function statusWord(status: RiverStatus): string {
  return { low: "ต่ำกว่าปกติ", normal: "ปกติ", high: "สูงกว่าปกติ", veryHigh: "สูงมาก" }[status];
}

export function rareLevel(value: number, annualMax: RiverPoint["annualMax"]): RareLevel | null {
  if (value >= annualMax.p80) return "about5y";
  if (value >= annualMax.p50) return "yearly";
  return null;
}

export function rareLevelWord(level: RareLevel): string {
  return { about5y: "สูงเท่าที่พบราว 5 ปีครั้ง", yearly: "สูงเท่าที่พบราวปีละครั้ง" }[level];
}

export function peakAhead(days: RiverForecastDay[], today: string, n = 7): Pick<RiverForecastDay, "date" | "value"> | null {
  if (n < 1) return null;
  const end = new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const upcoming = days.filter((day) => day.date > today && day.date <= end);
  if (!upcoming.length) return null;
  const peak = upcoming.reduce((best, day) => day.value > best.value ? day : best);
  return { date: peak.date, value: peak.value };
}

export function trend(days: RiverForecastDay[], today: string): RiverTrend | null {
  const current = days.find((day) => day.date === today);
  const peak = peakAhead(days, today, 3);
  if (!current || !peak) return null;
  if (peak.value > current.value * 1.1) return "rising";
  if (peak.value < current.value * 0.9) return "falling";
  return "steady";
}

export function summarizeRiver(point: RiverPoint, forecast: RiverForecast, todayDate: string) {
  if (forecast.id !== point.id) return null;
  const current = forecast.days.find((day) => day.date === todayDate);
  if (!current) return null;
  const doy = calendarDoy(todayDate);
  const doyBand = point.doy[doy];
  if (!doyBand) return null;
  const end = new Date(Date.parse(`${todayDate}T00:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const days = forecast.days.filter((day) => day.date > todayDate && day.date <= end).map((day) => {
    const band = point.doy[calendarDoy(day.date)];
    return { ...day, status: riverStatus(day.value, band), doyBand: band };
  });
  return {
    id: point.id,
    today: { date: current.date, value: current.value, status: riverStatus(current.value, doyBand), doyBand },
    trend: trend(forecast.days, todayDate),
    peak: peakAhead(forecast.days, todayDate),
    rare: rareLevel(current.value, point.annualMax),
    value2554Today: point.value2554[doy] ?? null,
    days,
  };
}
