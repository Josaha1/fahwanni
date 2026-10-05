import { FOCUS, isOn } from "./features";
import type { Locale, T } from "@/i18n/core";
import { adviceText } from "./advice-text";
import { advise } from "./advise";
import { pm25Level } from "./air-level";
import type { AirSnapshot } from "./air";
import { describeCondition } from "./condition";
import type { Place } from "./place";
import type { WeatherSnapshot } from "./weather/types";
import { pm25LevelWord } from "./words";

export function buildShareText(snapshot: WeatherSnapshot, air: AirSnapshot | undefined, place: Place, locale: Locale, t: T, focus: "flood" | "all" = FOCUS): string {
  air = isOn("aqiInShare", focus) ? air : undefined;
  const name = place.source === "gps" ? t("ตำแหน่งปัจจุบัน")
    : locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const lines = [t("ฟ้าวันนี้ · {place}", { place: name })];
  const condition = describeCondition(snapshot.conditionType)[locale];
  const temperature = snapshot.tempC === undefined ? condition : `${Math.round(snapshot.tempC)}° ${condition}`;
  lines.push(snapshot.feelsLikeC === undefined ? temperature
    : t("{weather} (รู้สึกเหมือน {feels}°)", { weather: temperature, feels: Math.round(snapshot.feelsLikeC) }));

  const today = snapshot.days[0];
  if (today?.minTempC !== undefined && today.maxTempC !== undefined) {
    const range = t("วันนี้ {low}–{high}°", { low: Math.round(today.minTempC), high: Math.round(today.maxTempC) });
    const rain = Math.max(today.day.rainChance ?? 0, today.night.rainChance ?? 0);
    lines.push(today.day.rainChance === undefined && today.night.rainChance === undefined
      ? range : t("{range} โอกาสฝน {rain}%", { range, rain: Math.round(rain) }));
  }

  if (air?.pm25 !== undefined) {
    lines.push(t("PM2.5 {value} ({level})", {
      value: Math.round(air.pm25 * 10) / 10,
      level: pm25LevelWord(pm25Level(air.pm25), t),
    }));
  }

  if (snapshot.fetchedAt) {
    lines.push(...advise(snapshot, { pm25: air?.pm25 }, snapshot.fetchedAt)
      .slice(0, 2).map((item) => `• ${adviceText(item, t)}`));
  }
  return lines.join("\n");
}

export type FloodShareSummary = {
  eventProvinces: number | null;
  eventsAt?: string;
  warnings: number | null;
  warningsAt?: string;
  satellitePoints: number | null;
  satelliteDate?: string;
};

/** Share only reported national facts; absent sources never become zero or an all-clear. */
export function buildFloodShareText(summary: FloodShareSummary, t: T): string {
  const unavailable = t("ข้อมูลส่วนนี้ไม่พร้อมใช้งาน");
  const stamp = (at?: string) => at && Number.isFinite(Date.parse(at)) ? at : t("ไม่ทราบวันที่ข้อมูล");
  return [
    t("ฟ้าวันนี้ · น้ำท่วม"),
    `${t("จังหวัดที่มีเหตุการณ์น้ำท่วม 14 วันล่าสุด")}: ${summary.eventProvinces === null ? unavailable : t("{n} จังหวัดที่ระบุชื่อในรายงาน", { n: summary.eventProvinces })} · GLIDE / GDACS · ${stamp(summary.eventsAt)}`,
    `${t("ประกาศเตือนภัยกรมอุตุฯ")}: ${summary.warnings === null ? unavailable : summary.warnings === 0 ? t("ไม่มีประกาศเตือนภัย") : t("{n} ประกาศเตือนภัย", { n: summary.warnings })} · TMD · ${stamp(summary.warningsAt)}`,
    `${t("จุดตรวจน้ำท่วมจากดาวเทียมตามภาค")}: ${summary.satellitePoints === null ? unavailable : t("{n} จุดตรวจ", { n: summary.satellitePoints })} · NASA VIIRS · ${stamp(summary.satelliteDate)}`,
    t("จุดตรวจไม่ใช่ขนาดพื้นที่น้ำท่วม · เมฆและข้อมูลไม่พออาจทำให้ไม่พบ"),
    t("สายด่วน ปภ. 1784"),
  ].join("\n");
}
