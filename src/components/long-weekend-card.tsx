"use client";

import { useState } from "react";
import { TZDate } from "@date-fns/tz";
import { useT } from "@/i18n/client";
import { formatDayLabel } from "@/lib/format";
import { forecastForRun, longWeekends } from "@/lib/holidays";
import type { WeatherSnapshot } from "@/lib/weather/types";

/** "Long weekend coming up — will it rain?" for Thai places, from the 10-day forecast. */
export function LongWeekendCard({ snapshot, lat, lon }: { snapshot: WeatherSnapshot; lat: number; lon: number }) {
  const t = useT();
  const [now] = useState(() => new Date().toISOString());
  if (lat < 5.5 || lat > 20.5 || lon < 97.3 || lon > 105.7) return null;
  const zone = snapshot.timeZone ?? "Asia/Bangkok";
  const local = new TZDate(now, zone);
  const today = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  const runs = longWeekends(today, 10).map((run) => ({ run, forecast: forecastForRun(run, snapshot.days) })).filter(({ forecast }) => forecast.covered > 0);
  if (runs.length === 0) return null;
  return (
    <section className="placeholder-card" aria-label={t("วันหยุดยาว")}>
      <h2 className="text-xl">{t("วันหยุดยาว")}</h2>
      <ul className="mt-3 space-y-2">
        {runs.map(({ run, forecast }) => (
          <li key={run.start} className="rounded-xl bg-background px-3 py-2">
            <p className="font-semibold">
              {formatDayLabel(run.start, now, zone, t.locale)} – {formatDayLabel(run.end, now, zone, t.locale)}
              <span className="ml-2 text-sm font-normal text-muted">{t("หยุด {n} วัน", { n: run.days.length })} · {run.names.map((name) => t(name)).join(", ")}</span>
            </p>
            <p className="text-sm">
              {forecast.rainChanceMax !== undefined && t("โอกาสฝนสูงสุด {n}%", { n: forecast.rainChanceMax })}
              {forecast.minC !== undefined && forecast.maxC !== undefined && ` · ${forecast.minC}–${forecast.maxC}°`}
              {forecast.covered < run.days.length && <span className="text-muted"> · {t("พยากรณ์ถึงแค่ {n} วันแรก", { n: forecast.covered })}</span>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
