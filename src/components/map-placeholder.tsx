"use client";

import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";

export function MapPlaceholder() {
  const { place } = useLastPlace();
  const t = useT();
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;

  return (
    <main className="app-shell">
      <h1 className="text-3xl">{t("แผนที่")}</h1>
      <p className="mt-4 text-muted">{placeName}</p>
      <p className="mt-4">{t("กำลังเตรียมแผนที่…")}</p>
    </main>
  );
}
