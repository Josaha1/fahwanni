"use client";

import { useT } from "@/i18n/client";

/**
 * Shows which dam's downstream route is on the map. The route stays after the dam card is closed;
 * the body reopens the card and ✕ removes the route.
 */
export function FocusChip({ damName, loading, onOpen, onClear }: {
  damName: string;
  loading: boolean;
  onOpen: () => void;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <div className="map-focus-chip map-panel" role="status" aria-busy={loading}>
      <button type="button" className="map-focus-chip-body" onClick={onOpen}
        aria-label={t("เปิดข้อมูลเขื่อน{name}", { name: damName })}>
        <span className="map-focus-chip-line" aria-hidden="true" />
        <span className="truncate">{t("ลำน้ำจากเขื่อน{name}", { name: damName })}</span>
      </button>
      <button type="button" className="map-focus-chip-clear" onClick={onClear} aria-label={t("ซ่อนทิศทางน้ำ")}>✕</button>
    </div>
  );
}
