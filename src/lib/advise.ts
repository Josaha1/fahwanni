import { TZDate } from "@date-fns/tz";
import type { WeatherHour, WeatherSnapshot } from "./weather/types";

export interface Advice {
  id: string;
  severity: "warn" | "tip";
  params?: Record<string, string | number>;
}

export type HeatBand = "none" | "caution" | "warning" | "danger" | "extreme";

export function heatBand(c: number): HeatBand {
  if (c < 27) return "none";
  if (c < 33) return "caution";
  if (c < 42) return "warning";
  if (c < 52) return "danger";
  return "extreme";
}

function upcoming(hours: WeatherHour[], nowMs: number, count: number): WeatherHour[] {
  const end = nowMs + count * 60 * 60 * 1000;
  return hours.filter((hour) => {
    const start = hour.startTime ? Date.parse(hour.startTime) : NaN;
    const hourEnd = hour.endTime ? Date.parse(hour.endTime) : start + 60 * 60 * 1000;
    return hourEnd > nowMs && start < end;
  }).sort((a, b) => Date.parse(a.startTime!) - Date.parse(b.startTime!));
}

function localHour(iso: string, timeZone: string): number {
  return new TZDate(iso, timeZone).getHours();
}

function hourLabel(iso: string, timeZone: string): string {
  return `${String(localHour(iso, timeZone)).padStart(2, "0")}:00`;
}

export function advise(snapshot: WeatherSnapshot, air: { pm25?: number } = {}, now: string): Advice[] {
  const nowMs = Date.parse(now);
  const timeZone = snapshot.timeZone ?? "UTC";
  const next3 = upcoming(snapshot.hours, nowMs, 3);
  const next6 = upcoming(snapshot.hours, nowMs, 6);
  const next24 = upcoming(snapshot.hours, nowMs, 24);
  const result: Advice[] = [];
  const add = (id: string, severity: Advice["severity"], params?: Advice["params"]) => {
    result.push(params ? { id, severity, params } : { id, severity });
  };

  if (next6.some((hour) => (hour.rainChance ?? 0) >= 40)) add("umbrella", "tip");
  if (next6.some((hour) => (hour.thunderChance ?? 0) >= 50)) add("storm", "warn");

  const band = snapshot.heatIndexC === undefined ? "none" : heatBand(snapshot.heatIndexC);
  if (band === "warning" || band === "danger" || band === "extreme") {
    add("heat", band === "warning" ? "tip" : "warn", { band });
  }
  if (snapshot.uvIndex !== undefined && snapshot.uvIndex >= 6) {
    add("uv", snapshot.uvIndex >= 8 ? "warn" : "tip");
  }
  if (snapshot.gustKmh !== undefined && snapshot.gustKmh >= 50) add("wind", "warn");

  const [today, tomorrow] = snapshot.days;
  if (today?.maxTempC !== undefined && tomorrow?.maxTempC !== undefined && today.maxTempC - tomorrow.maxTempC >= 3) {
    add("cooler", "tip");
  }
  if (snapshot.humidity !== undefined && snapshot.humidity >= 85 && snapshot.tempC !== undefined && snapshot.tempC >= 32) {
    add("sticky", "tip");
  }

  const rainStart = next24.find((hour) => (hour.rainChance ?? 0) >= 50 && hour.startTime);
  if (rainStart?.startTime) add("rain-start", "tip", { hour: hourLabel(rainStart.startTime, timeZone) });

  const commuteRain = next24.find((hour) => {
    if (!hour.startTime || (hour.rainChance ?? 0) < 40) return false;
    const h = localHour(hour.startTime, timeZone);
    return (h >= 6 && h <= 9) || (h >= 16 && h <= 19);
  });
  if (commuteRain?.startTime) add("commute-rain", "tip", { hour: hourLabel(commuteRain.startTime, timeZone) });

  const nowHour = localHour(now, timeZone);
  const daytime = snapshot.isDaytime !== false && nowHour >= 6 && nowHour < 18;
  if (daytime) {
    const laundryOk = snapshot.humidity !== undefined && snapshot.humidity < 75 &&
      next6.length > 0 && next6.every((hour) => hour.rainChance !== undefined && hour.rainChance < 20);
    add(laundryOk ? "laundry-ok" : "laundry-no", "tip");
  }

  const exerciseRisk = (air.pm25 !== undefined && air.pm25 > 37.5) ||
    band === "danger" || band === "extreme" || next3.some((hour) => (hour.rainChance ?? 0) >= 60);
  if (exerciseRisk) add("exercise-no", "warn");
  else if (daytime && air.pm25 !== undefined) add("exercise-ok", "tip");

  const first3Days = snapshot.days.slice(0, 3);
  const rainTotal = (day: WeatherSnapshot["days"][number]) =>
    (day.day.rainMm ?? 0) + (day.night.rainMm ?? 0);
  if (first3Days.some((day) => rainTotal(day) >= 35) ||
    (first3Days.length === 3 && first3Days.every((day) => rainTotal(day) >= 10))) {
    add("flood", "warn");
  }

  if (air.pm25 !== undefined && air.pm25 > 25) {
    const band = air.pm25 > 75 ? "very-unhealthy" : air.pm25 > 37.5 ? "unhealthy" : "sensitive";
    add("pm25", air.pm25 > 37.5 ? "warn" : "tip", { band });
  }

  const unique = result.filter((item, index) => result.findIndex((other) => other.id === item.id) === index);
  return [...unique.filter((item) => item.severity === "warn"), ...unique.filter((item) => item.severity === "tip").slice(0, 3)];
}
