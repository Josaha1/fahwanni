"use client";

import { useT } from "@/i18n/client";
import { formatFullDate, formatTime } from "@/lib/format";
import { goldenHours, moonLitFraction, nextEclipses, planetsAt, stargazing, sunsetAfter, type Planet } from "@/lib/astro";
import { nextMeteorShower } from "@/lib/meteors";
import type { WeatherHour } from "@/lib/weather/types";

const PLANET_TH: Record<Planet, string> = { Mercury: "ดาวพุธ", Venus: "ดาวศุกร์", Mars: "ดาวอังคาร", Jupiter: "ดาวพฤหัสบดี", Saturn: "ดาวเสาร์" };
function localDate(ms: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
}

/** UTC offset of `timeZone` at `ms` (e.g. +7 h for Asia/Bangkok), from the "GMT+07:00" name Intl gives. */
function zoneOffsetMs(timeZone: string, ms: number) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(ms)
    .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000 : 0;
}

const VERDICT = { good: "คืนนี้ดูดาวได้ดี", fair: "คืนนี้ดูดาวได้พอใช้", poor: "คืนนี้ดูดาวยาก" } as const;
const ECLIPSE = {
  solar: { total: "สุริยุปราคาเต็มดวง", annular: "สุริยุปราคาวงแหวน", partial: "สุริยุปราคาบางส่วน" },
  lunar: { total: "จันทรุปราคาเต็มดวง", annular: "จันทรุปราคาบางส่วน", partial: "จันทรุปราคาบางส่วน" },
} as const;
const VERDICT_COLOR = { good: "#2E9E4F", fair: "#E8B500", poor: "#9aa1ad" } as const;

/** Golden/blue hour, planets, stargazing tonight, next meteor shower and eclipse — computed on the device (no API). */
export default function NightSky({ lat, lon, timeZone, hours, nowMs }: { lat: number; lon: number; timeZone: string; hours: WeatherHour[]; nowMs: number }) {
  const t = useT();
  const today = localDate(nowMs, timeZone);
  const dayStart = Date.parse(`${today}T00:00:00Z`) - zoneOffsetMs(timeZone, nowMs);
  const golden = goldenHours(lat, lon, dayStart);
  const sunset = sunsetAfter(lat, lon, dayStart);
  const moonLit = moonLitFraction(sunset ? Date.parse(sunset) + 2 * 3_600_000 : nowMs);
  const tonight = sunset ? stargazing(hours, sunset, moonLit) : null;
  const planets = sunset ? planetsAt(lat, lon, Date.parse(sunset) + 3_600_000) : [];
  const shower = nextMeteorShower(today);
  const eclipse = nextEclipses(lat, lon, nowMs)[0];
  const time = (value: string) => formatTime(value, timeZone, t.locale);
  const range = (value: [string, string] | null) => value ? `${time(value[0])}–${time(value[1])}` : "—";
  const name = (planet: Planet) => t.locale === "en" ? planet : PLANET_TH[planet];
  return <div className="mt-4 space-y-3 border-t border-border pt-3 text-sm">
    <div className="grid grid-cols-2 gap-3">
      <div><p className="text-muted">{t("แสงทองตอนเย็น")}</p><p className="font-semibold tabular-nums">{range(golden.eveningGolden)}</p></div>
      <div><p className="text-muted">{t("แสงสีฟ้าตอนเย็น")}</p><p className="font-semibold tabular-nums">{range(golden.eveningBlue)}</p></div>
      <div><p className="text-muted">{t("แสงทองตอนเช้า")}</p><p className="font-semibold tabular-nums">{range(golden.morningGolden)}</p></div>
      <div><p className="text-muted">{t("แสงสีฟ้าตอนเช้า")}</p><p className="font-semibold tabular-nums">{range(golden.morningBlue)}</p></div>
    </div>
    {tonight && <p><span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: VERDICT_COLOR[tonight.verdict] }} aria-hidden="true" />{" "}
      <strong>{t(VERDICT[tonight.verdict])}</strong>
      <span className="text-muted"> · {t("ฟ้าเปิด {pct}% ของช่วงหัวค่ำ–ตี 2 · ดวงจันทร์สว่าง {moon}%", { pct: Math.round(tonight.clearShare * 100), moon: Math.round(moonLit * 100) })}</span></p>}
    <p>{planets.length
      ? t("ดาวเคราะห์ที่เห็นหลังค่ำ: {list}", { list: planets.map((planet) => t("{name} (สูง {alt}°)", { name: name(planet.body), alt: planet.altitude })).join(", ") })
      : t("หลังค่ำคืนนี้ไม่มีดาวเคราะห์สว่างสูงพอให้เห็นง่าย")}</p>
    {shower && <p>{t(shower.daysAway <= 0 ? "{name} คืนนี้ (สูงสุด ~{zhr} ดวง/ชม. ในที่มืดสนิท)" : "{name} อีก {days} วัน (สูงสุด ~{zhr} ดวง/ชม. ในที่มืดสนิท)",
      { name: t.locale === "en" ? shower.shower.nameEn : shower.shower.nameTh, days: shower.daysAway, zhr: shower.shower.zhr })}</p>}
    {eclipse && <p>{t("{eclipse} ที่เห็นได้จากที่นี่ครั้งถัดไป: {date}", {
      eclipse: t(ECLIPSE[eclipse.type][eclipse.kind === "total" ? "total" : eclipse.kind === "annular" ? "annular" : "partial"]),
      date: formatFullDate(eclipse.peak, timeZone, t.locale) })}</p>}
    <p className="text-muted text-xs">{t("คำนวณจากตำแหน่งดาวในเครื่อง (astronomy-engine) · ความน่าดูดาวใช้พยากรณ์ท้องฟ้ารายชั่วโมง")}</p>
  </div>;
}
