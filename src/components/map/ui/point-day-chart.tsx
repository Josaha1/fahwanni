"use client";

import { useT } from "@/i18n/client";
import type { PointHour } from "@/lib/timeline/values";

/** 24-hour strip for a tapped point: temperature line over rain-chance bars (model values). */
export function PointDayChart({ hours }: { hours: PointHour[] }) {
  const t = useT();
  if (hours.length < 2) return null;
  const temps = hours.map((hour) => hour.temp).filter((value): value is number => value !== null);
  const low = temps.length ? Math.min(...temps) : 0, high = temps.length ? Math.max(...temps) : 1;
  const span = Math.max(2, high - low);
  const width = 240, top = 10, chartHeight = 44, base = top + chartHeight;
  const step = width / hours.length;
  const x = (index: number) => step * index + step / 2;
  const y = (temp: number) => top + (1 - (temp - low) / span) * (chartHeight - 8) + 4;
  const line = hours.flatMap((hour, index) => hour.temp === null ? [] : [`${x(index)},${y(hour.temp)}`]).join(" ");
  const hourLabel = (time: number) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(time);
  const rainy = hours.filter((hour) => (hour.prob ?? 0) >= 50).length;
  return <figure className="mt-3">
    <svg className="w-full" viewBox={`0 0 ${width} 68`} role="img"
      aria-label={t("24 ชม. ข้างหน้า: {low}–{high}° · ฝนโอกาส 50% ขึ้นไป {n} ชม.", { low: Math.round(low), high: Math.round(high), n: rainy })}>
      {hours.map((hour, index) => hour.prob !== null && hour.prob > 0 && <rect key={`p${hour.time}`} x={x(index) - step * 0.35}
        y={base - (hour.prob / 100) * chartHeight} width={step * 0.7} height={(hour.prob / 100) * chartHeight}
        fill="#3b82f6" opacity={0.15 + (hour.prob / 100) * 0.45} />)}
      {line && <polyline points={line} fill="none" stroke="#f0913a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {temps.length > 0 && <>
        <text x="2" y={y(high) - 2} fontSize="7" fill="currentColor" opacity="0.7">{Math.round(high)}°</text>
        <text x="2" y={y(low) + 8} fontSize="7" fill="currentColor" opacity="0.7">{Math.round(low)}°</text>
      </>}
      {hours.map((hour, index) => index % 6 === 0 && <text key={`l${hour.time}`} x={x(index)} y="66" textAnchor="middle" fontSize="7" fill="currentColor" opacity="0.6">
        {hourLabel(hour.time)}
      </text>)}
    </svg>
    <figcaption className="map-muted text-xs">{t("เส้น: อุณหภูมิ · แท่ง: โอกาสฝน (แบบจำลอง)")}</figcaption>
  </figure>;
}
