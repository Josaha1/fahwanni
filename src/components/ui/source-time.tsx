"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { sourceTimeMs, staleness, type FreshnessKind } from "@/lib/freshness";

export function SourceTime({ source, date, time, kind, model = false, nowMs, className = "text-muted" }: {
  source: string; date?: string | Date | number | null; time?: string | Date | number | null;
  kind: FreshnessKind; model?: boolean; nowMs?: number; className?: string;
}) {
  const t = useT();
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (nowMs !== undefined) return;
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [nowMs]);
  const now = nowMs ?? clock;
  const value = time ?? date;
  const at = sourceTimeMs(value);
  const status = staleness(value, model ? "model" : kind, now);
  const shortDate = at === null ? "—" : new Intl.DateTimeFormat(t.intl, {
    day: kind === "monthly" ? undefined : "numeric", month: "short",
    year: kind === "monthly" ? "numeric" : undefined, timeZone: "Asia/Bangkok",
  }).format(new Date(at));
  let when = t("ไม่ทราบวันที่ข้อมูล");
  if (at !== null) {
    if (status === "old") when = t("ข้อมูลเก่า ({date})", { date: shortDate });
    else if (kind === "monthly") when = t("ข้อมูลเดือน {month}", { month: shortDate });
    else if (time !== undefined && time !== null) {
      const day = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(ms));
      when = t(day(at) === day(now) ? "{time} วันนี้" : "{time} · {date}", {
        time: formatTime(new Date(at).toISOString(), "Asia/Bangkok", t.locale), date: shortDate,
      });
    } else when = t("ข้อมูลวันที่ {date}", { date: shortDate });
    if (status === "yesterday") when += ` · ${t("ข้อมูลเมื่อวาน")}`;
  }
  return <span className={`${className} text-xs`}>
    {(model || kind === "model") && <><span className="map-water-badge">{t("แบบจำลอง")}</span>{" "}</>}
    {t(source)} · <span className={status === "old" ? "text-amber-600 dark:text-amber-400" : undefined}>{when}</span>
  </span>;
}
