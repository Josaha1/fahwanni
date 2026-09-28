"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { describeCondition, iconUrl } from "@/lib/condition";
import { formatDayLabel, formatFullDate } from "@/lib/format";
import { weeklyOutlook } from "@/lib/outlook";
import type { WeatherDay, WeatherPeriod, WeatherSnapshot } from "@/lib/weather/types";
import { uvWord, windWord } from "@/lib/words";

export function DailyList({ snapshot, isDark }: { snapshot: WeatherSnapshot; isDark: boolean }) {
  const t = useT();
  const [expanded, setExpanded] = useState<number | null>(null);
  const days = snapshot.days.slice(0, 10);
  if (days.length === 0) return null;

  const zone = snapshot.timeZone ?? "UTC";
  const today = snapshot.fetchedAt ?? days[0].startTime ?? "";
  const temperatures = days.flatMap((day) => [day.minTempC, day.maxTempC]).filter((value): value is number => value !== undefined);
  const low = Math.min(...temperatures);
  const span = Math.max(1, Math.max(...temperatures) - low);

  function period(label: string, value: WeatherPeriod, daytime: boolean) {
    return <div className="rounded-xl bg-background p-3 text-sm">
      <h4 className="font-semibold">{label}</h4>
      <p>{describeCondition(value.conditionType)[t.locale]}</p>
      <p>{t("โอกาสฝน")} {value.rainChance === undefined ? "—" : `${Math.round(value.rainChance)}%`}</p>
      <p>{t("ปริมาณฝน")} {value.rainMm === undefined ? "—" : `${Math.round(value.rainMm * 10) / 10} mm`}</p>
      <p>{t("ลม")} {value.windKmh === undefined ? "—" : windWord(value.windKmh, t)}</p>
      {daytime && <p>{t("ดัชนี UV")} {value.uvIndex === undefined ? "—" : uvWord(value.uvIndex, t)}</p>}
    </div>;
  }

  return (
    <section className="placeholder-card min-w-0" aria-label={t("พยากรณ์ 10 วัน")}>
      <h2 className="text-xl">{t("พยากรณ์ 10 วัน")}</h2>
      {(() => {
        const outlook = weeklyOutlook(days);
        if (!outlook) return null;
        const parts = [outlook.rainyDays === 0
          ? t("{n} วันข้างหน้าไม่ค่อยมีฝน", { n: outlook.days })
          : t("{n} วันข้างหน้า ฝนตก {rainy} วัน", { n: outlook.days, rainy: outlook.rainyDays })];
        if (outlook.hottest) parts.push(t("ร้อนสุด {max}° {day}", { max: Math.round(outlook.hottest.maxC), day: formatDayLabel(outlook.hottest.date, today, zone, t.locale) }));
        if (outlook.trend === "warmer") parts.push(t("ปลายสัปดาห์อากาศร้อนขึ้น"));
        if (outlook.trend === "cooler") parts.push(t("ปลายสัปดาห์อากาศเย็นลง"));
        return <p className="mt-1 text-sm text-muted">{parts.join(" · ")}</p>;
      })()}
      <ul className="mt-3 divide-y divide-border">
        {days.map((day: WeatherDay, index) => {
          const date = day.date ?? day.startTime?.slice(0, 10) ?? "";
          const label = date && today ? formatDayLabel(date, today, zone, t.locale) : "—";
          const rain = Math.max(day.day.rainChance ?? 0, day.night.rainChance ?? 0);
          const icon = day.day.iconBaseUri ?? day.night.iconBaseUri;
          const opened = expanded === index;
          const min = day.minTempC;
          const max = day.maxTempC;
          return <li key={date || index}>
            <button type="button" className="flex min-h-14 w-full min-w-0 items-center gap-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given"
              aria-expanded={opened} aria-controls={`forecast-day-${index}`} onClick={() => setExpanded(opened ? null : index)}>
              <span className="w-14 shrink-0 text-sm font-semibold">{label}</span>
              {icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={iconUrl(icon, isDark)} alt={describeCondition(day.day.conditionType)[t.locale]} width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
              ) : <span className="w-8 shrink-0" />}
              <span className="w-10 shrink-0 text-right text-xs text-blue">{Math.round(rain)}%</span>
              <span className="min-w-0 flex-1 text-right text-sm">{min === undefined ? "—" : `${Math.round(min)}°`}</span>
              <span className="relative h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-sky" aria-hidden="true">
                {min !== undefined && max !== undefined && <span className="absolute h-full rounded-full bg-given" style={{ left: `${(min - low) / span * 100}%`, width: `${Math.max(2, (max - min) / span * 100)}%` }} />}
              </span>
              <span className="w-9 shrink-0 text-sm">{max === undefined ? "—" : `${Math.round(max)}°`}</span>
            </button>
            {opened && <div id={`forecast-day-${index}`} className="pb-4">
              <p className="mb-2 text-sm text-muted">{day.startTime ? formatFullDate(day.startTime, zone, t.locale) : date}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {period(t("กลางวัน"), day.day, true)}
                {period(t("กลางคืน"), day.night, false)}
              </div>
            </div>}
          </li>;
        })}
      </ul>
    </section>
  );
}
