import type { ReactNode } from "react";
import { useT } from "@/i18n/client";

export function MapPanelContent({ placeName, compact, timeline, details, layers }: {
  placeName: string;
  compact: boolean;
  timeline: ReactNode;
  details: ReactNode;
  layers: ReactNode;
}) {
  const t = useT();
  return (
    <>
      {!compact && <h1 className="mb-3 text-lg">{t("แผนที่")} · {placeName}</h1>}
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
