"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { SearchBox } from "@/components/search-box";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import type { Place } from "@/lib/place";

export function MapSearchPill({ placeName }: { placeName: string }) {
  const t = useT();
  const { setPlace } = useLastPlace();
  const [open, setOpen] = useState(false);
  const mainButton = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => mainButton.current?.focus());
  };
  const selectPlace = (place: Place) => { setPlace(place); close(); };
  const { locate, locating } = useCurrentLocation(
    selectPlace,
    () => toast.error(t("เข้าถึงตำแหน่งไม่ได้ ลองค้นหาเมืองแทน")),
  );

  return open ? (
    <div className="map-panel">
      <SearchBox variant="compact" locale={t.locale} onSelect={selectPlace} onClose={close} />
    </div>
  ) : (
    <div className="map-search-pill">
      <button ref={mainButton} type="button" onClick={() => setOpen(true)} aria-label={t("ค้นหาสถานที่")}
        className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" />
        </svg>
        <span className="truncate">{placeName}</span>
      </button>
      <button type="button" onClick={locate} disabled={locating} aria-busy={locating} aria-label={t("ใช้ตำแหน่งปัจจุบัน")}
        className="map-icon-btn map-search-gps shrink-0 disabled:opacity-60">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      </button>
    </div>
  );
}
