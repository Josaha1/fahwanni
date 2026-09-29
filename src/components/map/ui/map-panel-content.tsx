import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { MapSearchPill } from "./map-search-pill";

export function MapPanelContent({ placeName, compact, desktop, timeline, waterStepper, legend, details, card, water, freshness, onProbeCenter }: {
  placeName: string;
  compact: boolean;
  desktop: boolean;
  timeline: ReactNode;
  waterStepper: ReactNode;
  /** Phone-only colour key, shown right after the time bar so it stays visible in the peek. */
  legend: ReactNode;
  details: ReactNode;
  card: ReactNode;
  /** Water-mode content; when set it replaces the weather timeline and details. */
  water: ReactNode;
  /** "ข้อมูลล่าสุด" panel, shown in both modes when the panel is open. */
  freshness: ReactNode;
  onProbeCenter: (trigger: HTMLButtonElement) => void;
}) {
  const t = useT();
  return (
    <>
      <h1 className="sr-only">{t("แผนที่")} · {placeName}</h1>
      {desktop && <div className="mb-3"><MapSearchPill placeName={placeName} /></div>}
      {water && waterStepper}
      {card}
      {water ?? <>
        {timeline}
        {legend}
        <button type="button" className="map-chip map-probe-center mt-2 w-full text-sm" onClick={(event) => onProbeCenter(event.currentTarget)}>{t("ดูอากาศตรงกลางแผนที่")}</button>
        {!compact && details}
      </>}
      {!compact && freshness}
    </>
  );
}
