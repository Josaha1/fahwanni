"use client";

import { TZDate } from "@date-fns/tz";
import { useT } from "@/i18n/client";

export function waterDate(nowMs: number, day: number): string {
  const now = new TZDate(nowMs, "Asia/Bangkok");
  const date = new TZDate(now.getFullYear(), now.getMonth(), now.getDate() + day, "Asia/Bangkok");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function WaterDayStepper({ day, nowMs, playing, reducedMotion, onChange, onTogglePlay }: {
  day: number; nowMs: number; playing: boolean; reducedMotion: boolean;
  onChange: (day: number) => void; onTogglePlay: () => void;
}) {
  const t = useT();
  const days = Array.from({ length: 8 }, (_, index) => {
    const date = waterDate(nowMs, index);
    const weekday = new Intl.DateTimeFormat(t.intl, { weekday: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${date}T12:00:00+07:00`));
    return { date, label: index === 0 ? t("วันนี้") : index === 1 ? t("พรุ่งนี้") : `${weekday} ${Number(date.slice(-2))}` };
  });
  return <div className="map-water-stepper" aria-label={t("วันพยากรณ์น้ำ")}>
    <div className="map-water-stepper-controls">
      <button type="button" className="map-play shrink-0 disabled:opacity-50" disabled={reducedMotion}
        aria-label={t(playing ? "หยุดเล่นวันพยากรณ์" : "เล่นวันพยากรณ์")} aria-pressed={playing} onClick={onTogglePlay}>{playing ? "Ⅱ" : "▶"}</button>
      <button type="button" className="map-chip" aria-label={t("วันก่อนหน้า")} disabled={day === 0} onClick={() => onChange(day - 1)}>‹</button>
      <button type="button" className="map-chip" aria-label={t("วันถัดไป")} disabled={day === 7} onClick={() => onChange(day + 1)}>›</button>
    </div>
    <div className="map-water-days" role="radiogroup" aria-label={t("วันพยากรณ์น้ำ")}>
      {days.map(({ date, label }, index) => <button key={date} type="button" role="radio" aria-checked={day === index}
        aria-label={`${label} ${date}`} tabIndex={day === index ? 0 : -1} className="map-water-day"
        onClick={() => onChange(index)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? Math.min(7, index + 1) : event.key === "ArrowLeft" ? Math.max(0, index - 1) : null;
          if (next !== null) { event.preventDefault(); onChange(next); (event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus(); }
        }}>{label}</button>)}
    </div>
  </div>;
}
