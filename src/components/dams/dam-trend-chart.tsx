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

export function DamTrendChart({ trend, id, date }: { trend: DamTrend; id: string; date: string }) {
  const t = useT();
  const days = chartDays(trend, id, date);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const metrics = [
    { key: "release" as const, label: t("ระบาย (ลบ.ม./วินาที)"), color: "#0284c7" },
    { key: "inflow" as const, label: t("ไหลเข้า (ลบ.ม./วินาที)"), color: "#d97706" },
    { key: "pct" as const, label: t("ปริมาณน้ำในเขื่อน (%)"), color: "#8b5cf6" },
  ];
  const flowMax = Math.max(1, ...days.flatMap((day) => [day.release ?? 0, day.inflow ?? 0]));
  const storageMax = Math.max(100, ...days.map((day) => day.pct ?? 0));
  const x = (index: number) => 40 + index * 48;
  return <div className="space-y-2">
    <p className="text-sm">{t("แกนซ้าย: ลบ.ม./วินาที · แกนขวา: % ความจุ")}</p>
    <svg viewBox="0 0 380 170" className="w-full" role="img" aria-label={t("การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")}>
      {[0, 0.5, 1].map((ratio) => <g key={ratio}><line x1="40" x2="328" y1={130 - ratio * 110} y2={130 - ratio * 110} stroke="currentColor" opacity="0.15" /><text x="35" y={134 - ratio * 110} textAnchor="end" fontSize="9" fill="currentColor">{number.format(flowMax * ratio)}</text><text x="334" y={134 - ratio * 110} fontSize="9" fill="currentColor">{number.format(storageMax * ratio)}%</text></g>)}
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
    <SourceTime source="กรมชลประทาน" date={date} kind="daily" />
    <p className="text-muted text-xs">{t("ช่องว่างหมายถึงไม่มีรายงาน ไม่ใช่ศูนย์")}</p>
    <ChartTable caption={t("การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")} columns={[t("วัน"), ...metrics.map((metric) => metric.label)]}
      rows={days.map((day) => [day.date, ...metrics.map(({ key }) => day[key] === null ? "—" : number.format(day[key]))])} />
  </div>;
}
