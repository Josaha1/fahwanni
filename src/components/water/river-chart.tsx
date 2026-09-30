"use client";

import { useT } from "@/i18n/client";
import { ChartTable } from "@/components/ui/chart-table";
import { dayLabel, riverChartSummary } from "@/lib/chart-summaries";
import type { RiverBand } from "@/lib/rivers/types";

export type RiverChartDay = { date: string; value: number; doyBand: RiverBand };

export function RiverChart({ days, color, selectedIndex }: { days: RiverChartDay[]; color: string; selectedIndex?: number }) {
  const t = useT();
  const shown = days.slice(0, 7);
  if (!shown.length) return null;
  // Scale to the data and the normal band (not from zero) so a week's change is visible.
  const values = shown.flatMap((day) => [day.value, day.doyBand?.p25 ?? day.value, day.doyBand?.p75 ?? day.value]);
  const low = Math.min(...values), high = Math.max(...values);
  const pad = Math.max((high - low) * 0.15, high * 0.02, 1);
  const floor = Math.max(0, low - pad), ceiling = high + pad;
  const y = (value: number) => 6 + (1 - (value - floor) / (ceiling - floor)) * 44;
  const x = (index: number) => 6 + index * (148 / Math.max(1, shown.length - 1));
  const banded = shown.every((day) => day.doyBand);
  const band = banded ? [
    ...shown.map((day, index) => `${x(index)},${y(day.doyBand.p75)}`),
    ...shown.map((day, index) => `${x(index)},${y(day.doyBand.p25)}`).reverse(),
  ].join(" ") : null;
  const weekday = (date: string) => new Intl.DateTimeFormat(t.intl, { weekday: "short", timeZone: "Asia/Bangkok" })
    .format(new Date(`${date}T12:00:00+07:00`));
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  return <div><svg className="mt-2 w-full" viewBox="0 0 160 64" role="img" aria-label={riverChartSummary(shown, t)}>
    {band && <polygon points={band} fill="currentColor" opacity="0.12" />}
    <polyline points={shown.map((day, index) => `${x(index)},${y(day.value)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {selectedIndex !== undefined && selectedIndex >= 0 && selectedIndex < shown.length && <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="4" y2="52" stroke={color} strokeWidth="1" opacity="0.5" />}
    {shown.map((day, index) => <circle key={day.date} cx={x(index)} cy={y(day.value)} r={index === selectedIndex ? "3.5" : "1.8"} fill={color}><title>{day.date}: {day.value.toFixed(0)} m³/s; p25–p75 {day.doyBand?.p25.toFixed(0)}–{day.doyBand?.p75.toFixed(0)}</title></circle>)}
    {shown.map((day, index) => <text key={`label-${day.date}`} x={x(index)} y="62" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.6">{weekday(day.date)}</text>)}
  </svg>
    <ChartTable caption={t("ตารางปริมาณน้ำไหลผ่าน 7 วัน")}
      columns={[t("วัน"), t("ปริมาณน้ำไหลผ่าน (ลบ.ม./วินาที)"), t("ช่วงปกติ p25–p75 (ลบ.ม./วินาที)")]}
      rows={shown.map((day) => [dayLabel(day.date, t), number.format(day.value), `${number.format(day.doyBand.p25)}–${number.format(day.doyBand.p75)}`])} />
  </div>;
}
