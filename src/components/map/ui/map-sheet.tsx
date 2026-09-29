"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { useT } from "@/i18n/client";

export type SheetPosition = "peek" | "half";

/** Pixels of vertical drag on the handle that switch between peek and half. */
const DRAG_THRESHOLD = 32;

export function MapSheet({ position, onPositionChange, children }: {
  position: SheetPosition;
  onPositionChange: (position: SheetPosition) => void;
  children: ReactNode;
}) {
  const t = useT();
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);

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

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, moved: false };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const start = drag.current;
    if (!start) return;
    const dy = event.clientY - start.y;
    if (dy > DRAG_THRESHOLD && position === "half") { start.moved = true; onPositionChange("peek"); }
    else if (dy < -DRAG_THRESHOLD && position === "peek") { start.moved = true; onPositionChange("half"); }
  };
  const onPointerUp = () => {
    // A tap (no drag) toggles; a drag has already switched.
    if (drag.current && !drag.current.moved) onPositionChange(position === "half" ? "peek" : "half");
    drag.current = null;
  };

  return (
    <section ref={sheet} id="map-timeline-details" className="map-panel map-sheet" aria-label={t("แผนที่")} data-position={position}>
      <button type="button" className="map-sheet-grip" aria-controls="map-timeline-details" aria-expanded={position === "half"}
        aria-label={position === "half" ? t("ย่อแผง") : t("ขยายแผง")}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPositionChange(position === "half" ? "peek" : "half"); } }}>
        <span className="map-sheet-handle" aria-hidden="true" />
      </button>
      {children}
    </section>
  );
}
