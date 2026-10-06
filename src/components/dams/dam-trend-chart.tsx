"use client";

import { useT } from "@/i18n/client";
import { ChartTable } from "@/components/ui/chart-table";
import { SourceTime } from "@/components/ui/source-time";
import type { DamTrend } from "@/lib/dams/trend";
import { previousDate } from "@/lib/dams/pillar";

export function chartDays(trend: DamTrend, id: string, date: string) {
  const dates = [date];
  while (dates.length < 7) dates.unshift(previousDate(dates[0]));
  return dates.map((day) => {
    const index = trend.dates.indexOf(day);
    return { date: day, release: trend.release[id]?.[index] ?? null, inflow: trend.inflow[id]?.[index] ?? null, pct: trend.pct[id]?.[index] ?? null };
  });
}

export function DamTrendChart({ trend, id, date, storageOnly = false, showDetails = true }: { trend: DamTrend; id: string; date: string; storageOnly?: boolean; showDetails?: boolean }) {
  const t = useT();
  const days = chartDays(trend, id, date);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const metrics = [
    { key: "release" as const, label: t("ระบาย (ลบ.ม./วินาที)"), color: "#0284c7" },
    { key: "inflow" as const, label: t("ไหลเข้า (ลบ.ม./วินาที)"), color: "#d97706" },
    { key: "pct" as const, label: t("ปริมาณน้ำในเขื่อน (%)"), color: "#8b5cf6" },
  ].filter((metric) => !storageOnly || metric.key === "pct");
  const flowMax = Math.max(1, ...days.flatMap((day) => [day.release ?? 0, day.inflow ?? 0]));
  const storageMax = Math.max(100, ...days.map((day) => day.pct ?? 0));
  const x = (index: number) => 40 + index * 48;
  return <div className="space-y-2">
    {!storageOnly && <p className="text-sm">{t("แกนซ้าย: ลบ.ม./วินาที · แกนขวา: % ความจุ")}</p>}
    <svg viewBox="0 0 380 170" width="100%" height="120" className="dam-chart w-full max-w-full" role="img" aria-label={t(storageOnly ? "เก็บกัก 7 วัน (% ความจุ)" : "การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")}>
      {[0, 0.5, 1].map((ratio) => <g key={ratio}><line x1="40" x2="328" y1={130 - ratio * 110} y2={130 - ratio * 110} stroke="currentColor" opacity="0.15" /><text x="35" y={134 - ratio * 110} textAnchor="end" fontSize="9" fill="currentColor">{storageOnly ? `${number.format(storageMax * ratio)}%` : number.format(flowMax * ratio)}</text><text x="334" y={134 - ratio * 110} fontSize="9" fill="currentColor">{number.format(storageMax * ratio)}%</text></g>)}
      {metrics.map(({ key, color }) => <g key={key}>{days.map((day, index) => {
        const value = day[key];
        if (value === null) return null;
        const scale = key === "pct" ? storageMax : flowMax;
        const y = 130 - value / scale * 110;
        const prior = days[index - 1]?.[key];
        return <g key={day.date}>{prior != null && <line x1={x(index - 1)} x2={x(index)} y1={130 - prior / scale * 110} y2={y} stroke={color} strokeWidth="2" />}<circle cx={x(index)} cy={y} r="3" fill={color}><title>{day.date}: {number.format(value)}</title></circle></g>;
      })}</g>)}
      {days.map((day, index) => <text key={day.date} x={x(index)} y="155" textAnchor="middle" fontSize="9" fill="currentColor">{day.date.slice(5)}</text>)}
    </svg>
    <ul className="flex flex-wrap gap-3 text-xs">{metrics.map(({ key, label, color }) => <li key={key}><span style={{ color }}>●</span> {label}</li>)}</ul>
    <p className="text-muted text-xs">{t("ช่องว่างหมายถึงไม่มีรายงาน ไม่ใช่ศูนย์")}</p>
    {showDetails && <DamChartDetails trend={trend} id={id} date={date} />}
  </div>;
}


export function DamReleaseBars({ trend, id, date, showDetails = true }: { trend: DamTrend; id: string; date: string; showDetails?: boolean }) {
  const t = useT();
  const days = chartDays(trend, id, date);
  const max = Math.max(1, ...days.map((day) => day.release ?? 0));
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  return <div>
    <svg viewBox="0 -16 280 110" width="100%" height="120" className="dam-chart w-full max-w-full" role="img" aria-label={t("ระบาย 7 วัน (ลบ.ม./วินาที)")}>
      {days.map((day, index) => {
        const x = 10 + index * 39;
        const height = day.release == null ? 0 : 56 * day.release / max;
        return <g key={day.date} data-report-date={day.date}>
          <title>{t("กรมชลประทาน")} · {day.date}: {day.release == null ? t("ไม่รายงาน") : number.format(day.release)}</title>
          <rect x={x} y={day.release == null ? 58 : 60 - height} width="24" height={day.release == null ? 2 : height} rx="3" fill={day.release == null ? "var(--nodata)" : "var(--release)"} />
          <text x={x + 12} y={day.release == null ? 52 : 56 - height} fontSize="8" textAnchor="middle" fill="currentColor">{day.release == null ? t("ไม่รายงาน") : number.format(day.release)}</text>
          <text x={x + 12} y="78" fontSize="8" textAnchor="middle" fill="var(--muted)">{day.date.slice(5)}</text>
        </g>;
      })}
    </svg>
    <p className="text-muted text-xs">{t("ช่องเทา = ไม่รายงาน ไม่ใช่ศูนย์")}</p>
    {showDetails && <DamChartDetails trend={trend} id={id} date={date} />}
  </div>;
}


export function DamChartDetails({ trend, id, date }: { trend: DamTrend; id: string; date: string }) {
  const t = useT();
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  return <div>
    <SourceTime source="กรมชลประทาน" date={date} kind="daily" />
    <ChartTable caption={t("การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")} columns={[t("วัน"), t("ระบาย (ลบ.ม./วินาที)"), t("ไหลเข้า (ลบ.ม./วินาที)"), t("ปริมาณน้ำในเขื่อน (%)")]}
      rows={chartDays(trend, id, date).map((day) => [day.date, ...[day.release, day.inflow, day.pct].map((value) => value == null ? t("ไม่รายงาน") : number.format(value))])} />
  </div>;
}
