"use client";

import { MapBackLink } from "@/components/sheet/map-back-link";
import dynamic from "next/dynamic";
import { useT } from "@/i18n/client";

const MapView = dynamic(() => import("@/components/map/map-view").then((module) => module.MapView), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const t = useT();
  return <main className="grid min-h-[calc(100dvh-73px-env(safe-area-inset-bottom))] place-items-center" role="status">{t("กำลังโหลดแผนที่…")}</main>;
}

export default function MapPage() {
  return <><MapBackLink floating /><MapView /></>;
}
