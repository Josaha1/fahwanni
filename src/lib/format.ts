import { TZDate } from "@date-fns/tz";
import type { Locale } from "../i18n/core";

function clock(iso: string, timeZone: string, locale: Locale): string {
  const date = new TZDate(iso, timeZone);
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-nu-latn" : "en-GB", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone,
  }).format(date);
}

export function formatHour(iso: string, timeZone: string, locale: Locale): string {
  return clock(iso, timeZone, locale);
}

export function formatTime(iso: string, timeZone: string, locale: Locale): string {
  return clock(iso, timeZone, locale);
}

export function formatDayLabel(dateStr: string, todayIso: string, timeZone: string, locale: Locale): string {
  const today = new TZDate(todayIso, timeZone);
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new TZDate(year, month - 1, day, timeZone);
  const todayDate = new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), timeZone);
  const tomorrowDate = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + 1, timeZone);
  if (date.getTime() === todayDate.getTime()) return locale === "th" ? "วันนี้" : "Today";
  if (date.getTime() === tomorrowDate.getTime()) return locale === "th" ? "พรุ่งนี้" : "Tomorrow";
  if (locale === "th") return ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][date.getDay()];
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(date);
}

export function formatFullDate(iso: string, timeZone: string, locale: Locale): string {
  const date = new TZDate(iso, timeZone);
  const tag = locale === "th" ? "th-TH-u-ca-buddhist-nu-latn" : "en-US";
  const parts = new Intl.DateTimeFormat(tag, {
    weekday: locale === "th" ? "long" : "short", day: "numeric", month: "short", year: "numeric", timeZone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = locale === "th" ? part("weekday").replace(/^วัน/, "") : part("weekday");
  return `${weekday} ${part("day")} ${part("month")} ${part("year")}`;
}

export function minutesAgo(fromIso: string, nowIso: string): number {
  return Math.max(0, Math.floor((Date.parse(nowIso) - Date.parse(fromIso)) / 60_000));
}
