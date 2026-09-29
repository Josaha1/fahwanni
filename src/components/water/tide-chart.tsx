"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { highTides, type TideSeries } from "@/lib/tide/tide";

export function TideChart({ series }: { series: TideSeries }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const end = now + 48 * 3_600_000;
  const shown = series.times.map((time, index) => ({ time, height: series.heights[index], at: Date.parse(time) }))
    .filter(({ at }) => at >= now - 3_600_000 && at <= end);
  if (shown.length < 3) return <p className="text-muted text-sm">{t("ข้อมูลน้ำขึ้นน้ำลงไม่พร้อมใช้งาน")}</p>;

  // The model's hourly peak can differ from its neighbors by less than highTides' 0.1 m cutoff.
  const peaks = highTides({ ...series, heights: series.heights.map((height) => height * 10) },
    Math.ceil((end - Date.parse(series.times[0])) / 3_600_000))
    .filter(({ time }) => Date.parse(time) >= now && Date.parse(time) <= end)
    .map(({ time, height }) => ({ time, height: height / 10 }));
  const next = peaks[0];
  const low = Math.min(...shown.map(({ height }) => height));
  const high = Math.max(...shown.map(({ height }) => height));
  const span = Math.max(high - low, 0.1);
  const first = shown[0].at;
  const last = shown[shown.length - 1].at;
  const x = (at: number) => 16 + ((at - first) / (last - first)) * 328;
  const y = (height: number) => 80 - ((height - low) / span) * 54;
  const day = 24 * 3_600_000;
  const midnight = Math.ceil((first + 7 * 3_600_000) / day) * day - 7 * 3_600_000;
  const days = Array.from({ length: Math.ceil((last - midnight) / day) + 1 }, (_, index) => midnight + index * day)
    .filter((at) => at <= last);
  const clock = (time: string) => new Intl.DateTimeFormat(t.intl, { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time));
  const dayClock = (time: string) => new Intl.DateTimeFormat(t.intl, { timeZone: "Asia/Bangkok", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(time));
  const dayLabel = (at: number) => new Intl.DateTimeFormat(t.intl, { timeZone: "Asia/Bangkok", weekday: "short", day: "numeric" }).format(new Date(at));
  const meters = (height: number) => new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(height);
  const summary = next ? t("น้ำขึ้นสูงสุดถัดไป {time} น. ({h} ม.)", { time: dayClock(next.time), h: meters(next.height) })
    : t("กราฟระดับน้ำทะเล 48 ชั่วโมงที่ปากแม่น้ำเจ้าพระยา");

  return <div className="space-y-2">
    <svg className="w-full text-given" viewBox="0 0 360 112" role="img" aria-label={summary}>
      <line x1="16" x2="344" y1="80" y2="80" stroke="currentColor" opacity="0.25" />
      {days.map((at) => <g key={at}><line x1={x(at)} x2={x(at)} y1="16" y2="84" stroke="currentColor" strokeDasharray="2 3" opacity="0.2" />
        <text x={Math.max(20, Math.min(340, x(at)))} y="106" textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.7">{dayLabel(at)}</text></g>)}
      <polyline points={shown.map(({ at, height }) => `${x(at)},${y(height)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {now >= first && now <= last && <g><line x1={x(now)} x2={x(now)} y1="12" y2="83" stroke="currentColor" strokeDasharray="3 3" opacity="0.65" />
        <text x={Math.min(x(now) + 3, 315)} y="92" fontSize="8" fill="currentColor">{t("ตอนนี้")}</text></g>}
      {peaks.map(({ time, height }, index) => <g key={time}><circle cx={x(Date.parse(time))} cy={y(height)} r="3.5" fill="currentColor" />
        <text x={Math.max(20, Math.min(340, x(Date.parse(time))))} y={Math.max(9, y(height) - (index > 0 && x(Date.parse(time)) - x(Date.parse(peaks[index - 1].time)) < 34 ? 17 : 7))} textAnchor="middle" fontSize="8" fill="currentColor">{clock(time)}</text></g>)}
    </svg>
    {peaks.length > 0 && <div className="text-sm"><p className="font-semibold">{t("น้ำขึ้นสูงถัดไป")}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">{peaks.slice(0, 4).map(({ time, height }) => <li key={time}>{t("{time} น. · {h} ม.", { time: dayClock(time), h: meters(height) })}</li>)}</ul></div>}
    <p className="text-muted text-xs">{t("ระดับน้ำทะเลที่ปากแม่น้ำเจ้าพระยา · แบบจำลอง Open-Meteo · ไม่ใช่ตารางน้ำทางการของกรมอุทกศาสตร์")}</p>
    <p className="text-muted text-xs">{t("น้ำขึ้นสูงร่วมกับน้ำเหนือมากอาจทำให้ระดับน้ำริมเจ้าพระยาสูงขึ้น")}</p>
  </div>;
}
