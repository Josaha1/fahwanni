"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "@/i18n/client";

export type SheetPosition = "peek" | "half";

export function MapSheet({ position, children }: { position: SheetPosition; children: ReactNode }) {
  const t = useT();
  const sheet = useRef<HTMLElement>(null);

  // Publishes the sheet's height as --map-sheet-h on the map shell so floating items (the route chip)
  // can sit just above it whatever the sheet shows.
  useEffect(() => {
    const element = sheet.current;
    const shell = element?.parentElement;
    if (!element || !shell) return;
    const update = () => shell.style.setProperty("--map-sheet-h", `${Math.round(element.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { observer.disconnect(); shell.style.removeProperty("--map-sheet-h"); };
  }, []);

  return (
    <section ref={sheet} id="map-timeline-details" className="map-panel map-sheet" aria-label={t("แผนที่")} data-position={position}>
      <span className="map-sheet-handle" aria-hidden="true" />
      {children}
    </section>
  );
}
