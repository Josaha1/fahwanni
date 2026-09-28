"use client";

import { useT } from "@/i18n/client";
import type { Locale } from "@/i18n/core";
import type { Place } from "@/lib/place";

export function LocationBar({ place, locale, onSearch, onGps, locating }: {
  place: Place; locale: Locale; onSearch: () => void; onGps: () => void; locating: boolean;
}) {
  const t = useT();
  const name = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;

  return (
    <div className="mb-4 flex gap-2">
      <button type="button" onClick={onSearch} aria-label={t("ค้นหาสถานที่")}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-border bg-card px-4 text-left shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given">
        <span aria-hidden="true">⌕</span><span className="truncate font-semibold">{name}</span><span aria-hidden="true" className="ml-auto">⌄</span>
      </button>
      <button type="button" onClick={onGps} disabled={locating} aria-label={t("ใช้ตำแหน่งปัจจุบัน")}
        title={t("ใช้ตำแหน่งปัจจุบัน")}
        className="flex min-h-12 min-w-12 items-center justify-center rounded-2xl border border-border bg-card text-xl shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-given disabled:opacity-60">
        <span aria-hidden="true">◎</span>
      </button>
    </div>
  );
}
