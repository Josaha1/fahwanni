import type { Locale, T } from "@/i18n/core";
import { adviceText } from "./advice-text";
import { advise } from "./advise";
import { pm25Level } from "./air";
import type { AirSnapshot } from "./air";
import { describeCondition } from "./condition";
import type { Place } from "./place";
import type { WeatherSnapshot } from "./weather/types";
import { pm25LevelWord } from "./words";

export function buildShareText(snapshot: WeatherSnapshot, air: AirSnapshot | undefined, place: Place, locale: Locale, t: T): string {
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
