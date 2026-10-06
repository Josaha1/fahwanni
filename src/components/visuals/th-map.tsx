"use client";

import { useId, useMemo } from "react";
import { useT } from "@/i18n/client";
import { provinces } from "@/lib/provinces";
import { thAttribution, thProvinces, thViewBox } from "@/lib/visuals/th-provinces";
import { provinceBins, visualSummaryProvince } from "@/lib/visuals";
import { floodPoints, noDataColor, provinceColor, provinceColors, thRegionOutlines, visualSummaryThailand, type ThMapData } from "./th-map-data";

export function ThMap({ onSelect, ...props }: ThMapData & { onSelect: (id: string) => void }) {
  const t = useT();
  const id = useId().replaceAll(":", "");
  const key = JSON.stringify(props);
  const data = useMemo(() => JSON.parse(key) as ThMapData, [key]);
  const summary = visualSummaryThailand(data, t);
  const state = useMemo(() => ({ provinces: 77, points: floodPoints(data.samples).length, warnedRegions: data.warnedRegions }), [data]);
  return <div className="space-y-1">
    <div data-th-map="" aria-label={summary} className="relative h-[360px]" style={{ touchAction: "pan-y" }} data-scene-state={JSON.stringify({ mode: "svg", ...state })}>
      <svg data-th-map-fallback="" viewBox={thViewBox} aria-label={summary} className="h-full w-full">
        <defs><pattern id={`event-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="3" /></pattern></defs>
        {thProvinces.map((shape) => {
          const province = provinces.find((entry) => entry.id === shape.id)!;
          const name = t.locale === "en" ? province.en : province.th;
          const affected = data.affected.includes(shape.id);
          return <path key={shape.id} data-province={shape.id} d={shape.d} fillRule="evenodd" fill={provinceColor(data.counts?.[shape.id] ?? null)}
            stroke={affected ? `url(#event-${id})` : "var(--card)"} strokeWidth={affected ? 4 : 0.6}
            role="button" tabIndex={0} aria-label={`${name} · ${visualSummaryProvince(provinceBins(data.counts?.[shape.id] ?? null), t)}`}
            onClick={() => onSelect(shape.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(shape.id); } }}><title>{name}</title></path>;
        })}
        {data.warnedRegions.map((region) => <path key={region} data-warned-region={region} d={thRegionOutlines[region]} fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 3" pointerEvents="none" />)}
      </svg>
    </div>
    <p className="flex items-center gap-2 whitespace-nowrap text-[10px]" aria-label={t("จุดตรวจ ไม่ใช่พื้นที่")}>
      {provinceColors.map((color, index) => <span key={color} className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />{["0", "1–20", "21–200", ">200"][index]}</span>)}
      <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: noDataColor }} />—</span>{t("จุดตรวจ ไม่ใช่พื้นที่")}
    </p>
    <p className="text-muted text-xs">{t("ขอบลาย = เหตุการณ์ 14 วัน · เส้นประ = ภาคมีประกาศเตือน TMD")}</p>
    <p className="text-sm" title={summary}>{summary}</p>
    <p className="text-muted text-[10px]">{thAttribution}</p>
  </div>;
}
