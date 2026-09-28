import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { MapSearchPill } from "./map-search-pill";

export function MapPanelContent({ placeName, compact, desktop, timeline, details, layers }: {
  placeName: string;
  compact: boolean;
  desktop: boolean;
  timeline: ReactNode;
  details: ReactNode;
  layers: ReactNode;
}) {
  const t = useT();
  return (
    <>
      <h1 className="sr-only">{t("แผนที่")} · {placeName}</h1>
      {desktop && <div className="mb-3"><MapSearchPill placeName={placeName} /></div>}
      {timeline}
      {!compact && <>
        {details}
        <section className="mt-4" aria-labelledby="map-layers">
          <h2 id="map-layers" tabIndex={-1} className="mb-2 text-sm font-semibold">{t("ชั้นข้อมูล")}</h2>
          <div className="flex flex-wrap gap-2">{layers}</div>
        </section>
      </>}
    </>
  );
}
