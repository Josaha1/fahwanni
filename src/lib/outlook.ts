import type { WeatherDay } from "./weather/types";

export interface Outlook {
  days: number;
  rainyDays: number;
  hottest?: { date: string; maxC: number };
  coolest?: { date: string; minC: number };
  /** Change in average daily max between the first and last three days. */
  trend: "warmer" | "cooler" | "steady";
}

const rainy = (day: WeatherDay) =>
  Math.max(day.day.rainChance ?? 0, day.night.rainChance ?? 0) >= 50 ||
  (day.day.rainMm ?? 0) + (day.night.rainMm ?? 0) >= 5;

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** Summarises the next seven forecast days for a one-line weekly outlook. */
export function weeklyOutlook(forecast: WeatherDay[]): Outlook | undefined {
  const week = forecast.slice(0, 7).filter((day) => day.date);
  if (week.length < 3) return undefined;
  let hottest: Outlook["hottest"];
  let coolest: Outlook["coolest"];
  for (const day of week) {
    if (day.maxTempC !== undefined && (!hottest || day.maxTempC > hottest.maxC)) hottest = { date: day.date!, maxC: day.maxTempC };
    if (day.minTempC !== undefined && (!coolest || day.minTempC < coolest.minC)) coolest = { date: day.date!, minC: day.minTempC };
  }
  const maxes = week.map((day) => day.maxTempC).filter((v): v is number => v !== undefined);
  let trend: Outlook["trend"] = "steady";
  if (maxes.length >= 6) {
    const change = mean(maxes.slice(-3)) - mean(maxes.slice(0, 3));
    if (change >= 2) trend = "warmer";
    else if (change <= -2) trend = "cooler";
  }
  return { days: week.length, rainyDays: week.filter(rainy).length, hottest, coolest, trend };
}
