import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { MapSearchPill } from "./map-search-pill";

export function MapPanelContent({ placeName, compact, desktop, timeline, legend, details, card, water, riverFooter, freshness, onProbeCenter }: {
  placeName: string;
  compact: boolean;
  desktop: boolean;
  timeline: ReactNode;
  /** Phone-only colour key, shown right after the time bar so it stays visible in the peek. */
  legend: ReactNode;
  details: ReactNode;
  card: ReactNode;
  /** Water-mode content; when set it replaces the weather timeline and details. */
  water: ReactNode;
  riverFooter: boolean;
  /** "ข้อมูลล่าสุด" panel, shown in both modes when the panel is open. */
  freshness: ReactNode;
  onProbeCenter: (trigger: HTMLButtonElement) => void;
}) {
  const t = useT();
  return (
    <>
      <h1 className="sr-only">{t("แผนที่")} · {placeName}</h1>
      {desktop && <div className="mb-3"><MapSearchPill placeName={placeName} /></div>}
      {card}
      {water ?? <>
        {timeline}
        {legend}
        <button type="button" className="map-chip map-probe-center mt-2 w-full text-sm" onClick={(event) => onProbeCenter(event.currentTarget)}>{t("ดูอากาศตรงกลางแผนที่")}</button>
        {!compact && details}
      </>}
      {!compact && freshness}
      {riverFooter && <p className="map-muted mt-3 text-xs">{t("ข้อมูลแม่น้ำเป็นแบบจำลอง GloFAS · ไม่ใช่ค่าวัดจริง · ไม่ใช่แผนที่น้ำท่วม")}</p>}
    </>
  );
}
