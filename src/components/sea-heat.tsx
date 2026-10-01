"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/client";
import { formatFullDate } from "@/lib/format";
import { BLEACHING_COLORS, BLEACHING_WORDS, type DiveSpot, type SeaReading } from "@/lib/sea";

function Reading({ reading }: { reading: SeaReading }) {
  const t = useT();
  return <span className="inline-flex flex-wrap items-center gap-x-2">
    <span className="font-semibold tabular-nums">{t("น้ำทะเล {c}°C", { c: reading.sstC })}</span>
    <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BLEACHING_COLORS[reading.level] }} aria-hidden="true" />
      {t(BLEACHING_WORDS[reading.level])}</span>
  </span>;
}

/** Sea temperature + coral bleaching heat stress (NOAA Coral Reef Watch) for this place, and the dive spots on demand. */
export function SeaHeat({ lat, lon }: { lat: number; lon: number }) {
  const t = useT();
  const [here, setHere] = useState<{ key: string; reading: SeaReading } | null>(null);
  const [spots, setSpots] = useState<(DiveSpot & { reading: SeaReading | null })[] | null>(null);
  const key = `${lat},${lon}`;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/sea?lat=${lat}&lon=${lon}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null)
      .then((data: { reading?: SeaReading | null } | null) => { if (data?.reading) setHere({ key, reading: data.reading }); }).catch(() => {});
    return () => controller.abort();
  }, [lat, lon, key]);
  const loadSpots = () => {
    if (spots) return;
    fetch("/api/sea?spots=1").then((response) => response.ok ? response.json() : null)
      .then((data: { spots?: (DiveSpot & { reading: SeaReading | null })[] } | null) => { if (data?.spots) setSpots(data.spots); }).catch(() => {});
  };
  const reading = here?.key === key ? here.reading : null;
  return <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
    {reading && <p><Reading reading={reading} /></p>}
    {reading && <p className="text-muted text-xs">{t("ข้อมูลวันที่ {date} · ความร้อนสะสม {dhw} °C-สัปดาห์", { date: formatFullDate(`${reading.date}T12:00:00+07:00`, "Asia/Bangkok", t.locale), dhw: reading.dhw })}</p>}
    <details onToggle={(event) => { if ((event.target as HTMLDetailsElement).open) loadSpots(); }}>
      <summary className="cursor-pointer font-semibold">{t("จุดดำน้ำ: อุณหภูมิน้ำและปะการัง")}</summary>
      {!spots ? <p className="text-muted mt-1 text-xs">{t("กำลังโหลด…")}</p> : <ul className="mt-2 space-y-1">{spots.map((spot) => <li key={spot.id}>
        <span className="font-semibold">{t.locale === "en" ? spot.nameEn : spot.nameTh}</span>{" · "}
        {spot.reading ? <Reading reading={spot.reading} /> : <span className="text-muted">—</span>}
      </li>)}</ul>}
    </details>
    <p className="text-muted text-xs">{t("ที่มา: NOAA Coral Reef Watch (ข้อมูลดาวเทียมรายวัน 5 กม.)")}</p>
  </div>;
}
