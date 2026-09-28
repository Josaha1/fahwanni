import type { ReactNode } from "react";
import { useT } from "@/i18n/client";

export type SheetPosition = "peek" | "half";

export function MapSheet({ position, children }: { position: SheetPosition; children: ReactNode }) {
  const t = useT();
  return (
    <section id="map-timeline-details" className="map-panel map-sheet" aria-label={t("แผนที่")} data-position={position}>
      <span className="map-sheet-handle" aria-hidden="true" />
      {children}
    </section>
  );
}
