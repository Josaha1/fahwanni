"use client";

import { useEffect, useState } from "react";
import { useFarmerMode } from "@/hooks/use-farmer-mode";
import { useT } from "@/i18n/client";
import { rainTotalMm, soilWord, sprayWindow, type SoilWord } from "@/lib/agri-helpers";
import type { AgriSnapshot } from "@/lib/agri";
import { formatTime } from "@/lib/format";
import type { WeatherSnapshot } from "@/lib/weather/types";

const SOIL: Record<SoilWord, string> = { dry: "ดินแห้ง", moist: "ดินชื้นพอดี", wet: "ดินชื้นมาก" };

/** Farmer mode: 10-day rain, spraying window, evaporation and topsoil moisture. */
export function FarmCard({ snapshot, lat, lon }: { snapshot: WeatherSnapshot; lat: number; lon: number }) {
  const t = useT();
  const [farmer] = useFarmerMode();
  const [agri, setAgri] = useState<AgriSnapshot | null>(null);
  const [now] = useState(() => new Date().toISOString());

  useEffect(() => {
    if (!farmer) return;
    const controller = new AbortController();
    fetch(`/api/agri?lat=${lat}&lon=${lon}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() as Promise<AgriSnapshot> : null))
      .then(setAgri)
      .catch(() => {});
    return () => controller.abort();
  }, [farmer, lat, lon]);

  if (!farmer) return null;
  const zone = snapshot.timeZone ?? "Asia/Bangkok";
  const spray = sprayWindow(snapshot.hours, zone, now);
  const rain10 = rainTotalMm(snapshot.days, 10);
  const rows: [string, string][] = [
    [t("ฝนสะสม 10 วัน"), t("~{mm} มม.", { mm: rain10 })],
    [t("ช่วงพ่นยา/ปุ๋ยทางใบ"), spray ? t("ตั้งแต่ {time} น.", { time: formatTime(spray, zone, t.locale) }) : t("24 ชม. นี้ลมแรงหรือมีฝน ไม่แนะนำ")],
  ];
  if (agri?.available && agri.et0TodayMm !== undefined) rows.push([t("น้ำระเหยจากพืชและดินวันนี้"), t("~{mm} มม.", { mm: agri.et0TodayMm })]);
  if (agri?.available && agri.soilTop !== undefined) rows.push([t("ความชื้นดินผิวหน้า"), `${t(SOIL[soilWord(agri.soilTop)])} (${Math.round(agri.soilTop * 100)}%)`]);

  return (
    <section className="placeholder-card" aria-label={t("สำหรับเกษตรกร")}>
      <h2 className="text-xl">{t("สำหรับเกษตรกร")}</h2>
      <dl className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-background px-3 py-2">
            <dt className="text-sm">{label}</dt>
            <dd className="text-right text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">{t("ค่าความชื้นดินเป็นค่าประมาณจากแบบจำลอง ไม่ใช่ค่าวัดในแปลงของคุณ")}
        {agri?.available && <> · <a className="underline" href={agri.attribution.url} target="_blank" rel="noopener noreferrer">{agri.attribution.text}</a></>}</p>
    </section>
  );
}
