"use client";

import { useWeather } from "@/hooks/use-weather";
import { useT } from "@/i18n/client";
import type { Locale } from "@/i18n/core";
import { describeCondition } from "@/lib/condition";
import type { Place } from "@/lib/place";

type Weather = ReturnType<typeof useWeather>;

export function CurrentPlaceholder({ place, locale, weather }: { place: Place; locale: Locale; weather: Weather }) {
  const t = useT();
  const name = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const condition = describeCondition(weather.snapshot?.conditionType);

  return (
    <section className="placeholder-card" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl">{name}</h2>
        {weather.stale && <span className="rounded-full bg-zone-warn px-3 py-1 text-xs text-zone-warn-ink">{t("ข้อมูลอาจไม่เป็นปัจจุบัน")}</span>}
      </div>
      {weather.snapshot ? (
        <>
          <p className="mt-3 text-6xl font-semibold leading-none">{weather.snapshot.tempC === undefined ? "—" : `${Math.round(weather.snapshot.tempC)}°C`}</p>
          <p className="mt-3 text-lg">{condition[locale]}</p>
          {weather.updatedAgo && <p className="mt-2 text-sm text-muted">{weather.updatedAgo}</p>}
        </>
      ) : weather.status === "loading" ? (
        <div role="status" aria-label={t("กำลังโหลดข้อมูล")} className="mt-5 animate-pulse space-y-4">
          <div className="h-16 w-28 rounded-xl bg-sky" /><div className="h-5 w-40 rounded bg-sky" />
        </div>
      ) : null}
      {weather.status === "error" && (
        <div className="mt-4">
          <p role="alert" className="text-missed">{weather.error === "no_key" ? t("ยังไม่ได้ตั้งค่า API key") : t("โหลดข้อมูลไม่สำเร็จ")}</p>
          {weather.error !== "no_key" && <button type="button" onClick={weather.refresh}
            className="mt-3 min-h-11 rounded-xl bg-given px-5 font-semibold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
            {t("ลองใหม่")}
          </button>}
        </div>
      )}
    </section>
  );
}
