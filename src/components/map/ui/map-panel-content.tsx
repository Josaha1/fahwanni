import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { MapSearchPill } from "./map-search-pill";

export function MapPanelContent({ placeName, compact, desktop, timeline, waterStepper, legend, details, primaryPicker, layers, card, water, more, freshness, onProbeCenter }: {
  placeName: string;
  compact: boolean;
  desktop: boolean;
  timeline: ReactNode;
  waterStepper: ReactNode;
  /** Phone-only colour key, shown right after the time bar so it stays visible in the peek. */
  legend: ReactNode;
  details: ReactNode;
  primaryPicker: ReactNode;
  layers: ReactNode;
  card: ReactNode;
  /** Water-mode content; when set it replaces the weather timeline, details and layers. */
  water: ReactNode;
  /** Phone-only 3D / fullscreen / share row (the desktop rail keeps those buttons). */
  more: ReactNode;
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
        {!compact && <>
          {details}
          <section className="mt-4" aria-labelledby="map-layers">
            <h2 id="map-layers" tabIndex={-1} className="mb-2 text-sm font-semibold">{t("ชั้นข้อมูล")}</h2>
            {primaryPicker}
            <div className="mt-2 flex flex-wrap gap-2">{layers}</div>
          </section>
        </>}
      </>}
      {!compact && more && <section className="mt-4" aria-labelledby="map-more">
        <h2 id="map-more" className="mb-2 text-sm font-semibold">{t("เพิ่มเติม")}</h2>
        <div className="flex flex-wrap gap-2">{more}</div>
      </section>}
      {!compact && freshness}
    </>
  );
}
