"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { describeCondition, iconUrl } from "@/lib/condition";
import { formatHour } from "@/lib/format";
import type { WeatherSnapshot } from "@/lib/weather/types";

export function HourlyStrip({ snapshot, isDark }: { snapshot: WeatherSnapshot; isDark: boolean }) {
  const t = useT();
  const [now, setNow] = useState<number>();
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (snapshot.hours.length === 0) return null;

  const zone = snapshot.timeZone ?? "UTC";
  const currentIndex = snapshot.hours.findIndex((hour) => {
    const start = Date.parse(hour.startTime ?? "");
    const end = Date.parse(hour.endTime ?? "");
    return now !== undefined && start <= now && now < end;
  });

  return (
    <section className="placeholder-card min-w-0" aria-label={t("รายชั่วโมง")}>
      <h2 className="text-xl">{t("รายชั่วโมง")}</h2>
      <ol className="mt-4 flex max-w-full snap-x snap-mandatory gap-2 overflow-x-auto pb-2" aria-label={t("รายชั่วโมง")}>
        {snapshot.hours.slice(0, 24).map((hour, index) => {
          const time = index === currentIndex ? t("ตอนนี้") : hour.startTime ? formatHour(hour.startTime, zone, t.locale) : "—";
          const condition = describeCondition(hour.conditionType)[t.locale];
          const temp = hour.tempC === undefined ? "—" : `${Math.round(hour.tempC)}°`;
          const rain = Math.max(0, Math.min(100, hour.rainChance ?? 0));
          return <li key={hour.startTime ?? index} className="flex min-w-16 shrink-0 snap-start flex-col items-center rounded-xl bg-background px-2 py-2 text-center text-sm"
            aria-label={t("{time} อุณหภูมิ {temp} {condition} โอกาสฝน {rain}%", { time, temp, condition, rain: Math.round(rain) })}>
            <span className="font-medium">{time}</span>
            {hour.iconBaseUri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl(hour.iconBaseUri, isDark)} alt="" width={40} height={40} className="my-1 h-10 w-10 object-contain" />
            ) : <span aria-hidden="true" className="my-1 h-10" />}
            <span className="font-semibold">{temp}</span>
            <span className="mt-2 flex h-12 w-2 items-end overflow-hidden rounded-full bg-sky" aria-hidden="true">
              <span className="w-full rounded-full bg-blue" style={{ height: `${rain}%` }} />
            </span>
            <span className="h-5 text-xs text-muted" aria-hidden="true">{rain >= 20 ? `${Math.round(rain)}%` : ""}</span>
          </li>;
        })}
      </ol>
    </section>
  );
}
