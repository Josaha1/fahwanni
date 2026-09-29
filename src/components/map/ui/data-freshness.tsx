"use client";

import { useT } from "@/i18n/client";
import { formatFullDate, formatTime } from "@/lib/format";
import { ageMinutes, type FreshnessRow } from "@/lib/map/freshness";

/** "ข้อมูลล่าสุด": when each source last changed — answers "why hasn't it updated?". */
export function DataFreshness({ rows, nowMs }: { rows: FreshnessRow[]; nowMs: number }) {
  const t = useT();
  const today = formatFullDate(new Date(nowMs).toISOString(), "Asia/Bangkok", t.locale);
  return <details className="mt-4 text-sm">
    <summary className="cursor-pointer font-semibold">{t("ข้อมูลล่าสุด")}</summary>
    <ul className="mt-2 space-y-2">{rows.map((row) => {
      const age = ageMinutes(row.time, nowMs);
      const iso = row.time === null ? null : new Date(row.time).toISOString();
      const date = iso ? formatFullDate(iso, "Asia/Bangkok", t.locale) : null;
      const when = row.none ? t("ไม่มีประกาศในขณะนี้") : iso === null ? t("ยังไม่ได้โหลด")
        : row.daily ? t("ข้อมูลวันที่ {date}", { date: date! })
          : date === today ? t("{time} น.", { time: formatTime(iso, "Asia/Bangkok", t.locale) })
            : `${date} ${t("{time} น.", { time: formatTime(iso, "Asia/Bangkok", t.locale) })}`;
      return <li key={row.key} className="flex justify-between gap-3">
        <span className="min-w-0">{t(row.label)}<span className="map-muted block text-xs">{row.source}{row.daily ? ` · ${t("ออกวันละครั้ง")}` : ""}</span></span>
        <span className="shrink-0 text-right">{when}{age !== null && !row.daily && <span className="map-muted block text-xs">{t(age < 1 ? "เมื่อสักครู่" : age < 60 ? "{n} นาทีที่แล้ว" : "{h} ชม. ที่แล้ว", { n: age, h: Math.round(age / 60) })}</span>}</span>
      </li>;
    })}</ul>
  </details>;
}
