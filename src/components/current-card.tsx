"use client";

import { useEffect, useState } from "react";
import type { useWeather } from "@/hooks/use-weather";
import { useT } from "@/i18n/client";
import { heatBand } from "@/lib/advise";
import { describeCondition, iconUrl } from "@/lib/condition";
import { heatBandWord, humidityWord, windDirectionLabel, windWord } from "@/lib/words";

type Weather = ReturnType<typeof useWeather>;

export function CurrentCard({ weather }: { weather: Weather }) {
  const t = useT();
  const { snapshot } = weather;
  const condition = describeCondition(snapshot?.conditionType)[t.locale];
  const heatIndex = snapshot?.heatIndexC;
  const band = heatIndex === undefined ? "none" : heatBand(heatIndex);
  const windDirection = windDirectionLabel(snapshot?.windDir, t.locale ?? "th");
  const [dark, setDark] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.dataset.theme === "dark" || root.dataset.theme === "night");
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const nextHour = snapshot?.hours.find((hour) => {
    const start = Date.parse(hour.startTime ?? "");
    const end = Date.parse(hour.endTime ?? "");
    return Number.isFinite(start) && start < now + 60 * 60 * 1000 && (Number.isFinite(end) ? end > now : start >= now);
  });

  return (
    <section className="placeholder-card" aria-live="polite">
      <div className="flex min-h-8 items-start justify-between gap-3">
        <h2 className="text-xl">{t("ตอนนี้")}</h2>
        {weather.stale && <span className="rounded-full bg-zone-warn px-3 py-1 text-xs text-zone-warn-ink">{t("ข้อมูลอาจไม่เป็นปัจจุบัน")}</span>}
      </div>
      {snapshot ? (
        <>
          <div className="mt-3 flex min-h-24 items-center justify-between gap-3">
            <p className="text-6xl font-semibold leading-none">{snapshot.tempC === undefined ? "—" : `${Math.round(snapshot.tempC)}°C`}</p>
            {snapshot.iconBaseUri && (
              // Google Weather API supplies the SVG URL and a dark variant; fixed dimensions prevent layout shift.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={iconUrl(snapshot.iconBaseUri, dark)} alt={condition} width={88} height={88} className="h-20 w-20 shrink-0 object-contain" />
            )}
          </div>
          <p className="text-lg font-medium">{condition}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {snapshot.feelsLikeC !== undefined && <span className="text-sm">{t("รู้สึกเหมือน")} {Math.round(snapshot.feelsLikeC)}°</span>}
            {heatIndex !== undefined && band !== "none" && <span className={`rounded-full px-3 py-1 text-sm font-semibold heat-chip-${band}`}>{t("ดัชนีความร้อน")} {Math.round(heatIndex)}° · {heatBandWord(band, t)}</span>}
          </div>
          <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
            {snapshot.humidity !== undefined && <p>{t("ความชื้น")} · {humidityWord(snapshot.humidity, t)} · {Math.round(snapshot.humidity)}%</p>}
            {snapshot.windKmh !== undefined && <p>{t("ลม")} · {windWord(snapshot.windKmh, t)} · {Math.round(snapshot.windKmh)} km/h{windDirection ? ` · ${windDirection}` : ""}</p>}
            {nextHour?.rainChance !== undefined && <p>{t("โอกาสฝนในชั่วโมงหน้า")} · {Math.round(nextHour.rainChance)}%</p>}
          </div>
          {weather.updatedAgo && <p className="mt-4 text-sm text-muted">{weather.updatedAgo}</p>}
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
