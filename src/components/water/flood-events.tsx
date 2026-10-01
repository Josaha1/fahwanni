"use client";

import { useState } from "react";
import { useT } from "@/i18n/client";
import { formatFullDate } from "@/lib/format";
import type { FloodEvent, FloodEventType } from "@/lib/water/flood-events";

export type FloodEventsPayload = { fetchedAt: string; days: number; sources: string[]; items: FloodEvent[] };

export const FLOOD_EVENT_WORDS: Record<FloodEventType, string> = {
  flood: "น้ำท่วม", "flash-flood": "น้ำป่าไหลหลาก", landslide: "ดินถล่ม", storm: "พายุ",
};
export const ALERT_COLORS = { Red: "#C70000", Orange: "#F28C28", Green: "#2E9E4F" } as const;

export function floodEventDate(event: FloodEvent, locale: "th" | "en") {
  const day = (date: string) => formatFullDate(`${date}T12:00:00+07:00`, "Asia/Bangkok", locale);
  return event.endDate && event.endDate !== event.date ? `${day(event.date)} – ${day(event.endDate)}` : day(event.date);
}

export function FloodEventItem({ event, muted = "text-muted", border = "var(--border)" }: { event: FloodEvent; muted?: string; border?: string }) {
  const t = useT();
  return <article className="rounded-lg border p-3 text-sm" style={{ borderColor: border }}>
    <div className="flex items-start gap-2">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: event.alert ? ALERT_COLORS[event.alert] : "#3b82f6" }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t(FLOOD_EVENT_WORDS[event.type])}{event.place && ` · ${event.place}`}
          {event.alert && <span className="ml-1 text-xs font-normal">({t("ระดับเตือน GDACS: {level}", { level: t(event.alert === "Red" ? "แดง" : event.alert === "Orange" ? "ส้ม" : "เขียว") })})</span>}</p>
        <p className={`${muted} text-xs`}>{floodEventDate(event, t.locale)}</p>
      </div>
    </div>
    {event.summary && <details className="mt-1">
      <summary className="cursor-pointer font-semibold">{t("ดูเพิ่มเติม")}</summary>
      <p className="mt-1" lang="en">{event.summary}</p>
      <p className={`${muted} text-xs`}>{t("ข้อความจากแหล่งข้อมูล (ภาษาอังกฤษ)")}</p>
    </details>}
    <a className="mt-1 inline-block text-xs underline" href={event.url} target="_blank" rel="noopener noreferrer">
      {t(event.source === "gdacs" ? "ที่มา: GDACS" : "ที่มา: GLIDE (ADRC) ผ่าน HDX")}
    </a>
  </article>;
}

export function FloodEventList({ payload, limit = 3 }: { payload: FloodEventsPayload; limit?: number }) {
  const t = useT();
  const [all, setAll] = useState(false);
  const shown = all ? payload.items : payload.items.slice(0, limit);
  return <div className="space-y-2">
    {shown.map((event) => <FloodEventItem key={event.id} event={event} />)}
    {payload.items.length > limit && !all && <button type="button" className="min-h-11 font-semibold text-given underline" onClick={() => setAll(true)}>
      {t("ดูทั้งหมด ({n})", { n: payload.items.length })}</button>}
    <p className="text-muted text-xs">{t("เหตุการณ์ {days} วันล่าสุด · {sources} · ไม่ใช่ประกาศทางการของไทย", { days: payload.days, sources: payload.sources.join(" · ") })}</p>
  </div>;
}
