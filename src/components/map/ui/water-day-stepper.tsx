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
  const date = waterDate(nowMs, day);
  const selectedDate = new Date(`${date}T12:00:00+07:00`);
  const weekday = t.locale === "th" ? ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][selectedDate.getUTCDay()]
    : new Intl.DateTimeFormat(t.intl, { weekday: "short", timeZone: "Asia/Bangkok" }).format(selectedDate);
  const dateLabel = `${weekday} ${new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(selectedDate)}`;
  const label = `${day === 0 ? `${t("วันนี้")} · ` : day === 1 ? `${t("พรุ่งนี้")} · ` : ""}${day > 0 ? t("{date} (พยากรณ์)", { date: dateLabel }) : dateLabel}`;
  return <div className="map-water-stepper" aria-label={t("วันพยากรณ์น้ำ")}>
    <button type="button" className="map-play shrink-0 disabled:opacity-50" disabled={reducedMotion}
      aria-label={t(playing ? "หยุดเล่นวันพยากรณ์" : "เล่นวันพยากรณ์")} aria-pressed={playing} onClick={onTogglePlay}>{playing ? "Ⅱ" : "▶"}</button>
    <button type="button" className="map-chip map-water-step-button" aria-label={t("วันก่อนหน้า")} disabled={day === 0} onClick={() => onChange(day - 1)}>‹</button>
    <span className="map-water-step-label" aria-live="polite">{label}</span>
    <button type="button" className="map-chip map-water-step-button" aria-label={t("วันถัดไป")} disabled={day === 7} onClick={() => onChange(day + 1)}>›</button>
  </div>;
}
