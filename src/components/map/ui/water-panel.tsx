import type { RefObject } from "react";
import { useT } from "@/i18n/client";
import { damBandColor } from "@/lib/dams/bands";
import type { DamsPayload } from "@/lib/dams/client";
import { nearestDams, waterSummary } from "@/lib/dams/summary";
import { formatFullDate, formatTime } from "@/lib/format";
import type { Place } from "@/lib/place";
import { provinces } from "@/lib/provinces";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import { DamLegendStrip } from "./legend-chip";

export function WaterPanel({ dams, damsStatus, rainRisk, rainRiskStatus, place, placeName, onSelectDam, onSelectRain,
  legendButton, onOpenLegend, showAllRainProvinces, onShowAllRainProvinces }: {
  dams: DamsPayload | null;
  damsStatus: "idle" | "loading" | "ready" | "error";
  rainRisk: RainRisk | null;
  rainRiskStatus: "idle" | "loading" | "ready" | "error";
  place: Place;
  placeName: string;
  onSelectDam: (id: string) => void;
  onSelectRain: (id: string) => void;
  legendButton: RefObject<HTMLButtonElement | null>;
  onOpenLegend: () => void;
  showAllRainProvinces: boolean;
  onShowAllRainProvinces: () => void;
}) {
  const t = useT();
  const summary = damsStatus === "ready" && dams ? waterSummary(dams.dams, rainRiskStatus === "ready" && rainRisk ? rainRisk.stations : null) : null;
  const nearby = damsStatus === "ready" && dams ? nearestDams(dams.dams, place) : [];
  const rainProvinces = [...new Map([...(rainRisk?.stations ?? [])].reverse().map((station) => [station.provinceTh, station])).values()]
    .sort((a, b) => b.rainMm - a.rainMm);
  const percent = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });

  return <section className="mt-2 space-y-2 text-sm" aria-label={t("สถานการณ์น้ำ")}>
    <DamLegendStrip buttonRef={legendButton} onOpen={onOpenLegend} />
    {summary && <p className="text-xs leading-relaxed">{t("เขื่อนน้ำมาก (เกิน 80%)")} <strong>{summary.over80}</strong> · {t("เกินความจุ")} <strong>{summary.over100}</strong> · {t("ระบายน้ำมาก")} <strong>{summary.highRelease}</strong>{summary.heavyRain !== null && <> · {t("สถานีฝนหนัก")} <strong>{summary.heavyRain}</strong></>}</p>}
    {damsStatus === "ready" && dams ? <>
      <p className="flex flex-wrap items-center gap-2">
        <span className="map-water-badge">{t("สังเกต")}</span>
        <span>{dams.dataDate
          ? t("ข้อมูลกรมชลประทาน · ข้อมูลวันที่ {date}", { date: formatFullDate(`${dams.dataDate}T12:00:00+07:00`, "Asia/Bangkok", t.locale) })
          : t("ข้อมูลกรมชลประทาน")}</span>
      </p>
      {dams.stale && <p className="map-warning text-xs"><span aria-hidden="true">⚠ </span>{t("ข้อมูลอาจไม่เป็นปัจจุบัน")}</p>}
    </> : <p className="map-muted" role="status">{t("กำลังโหลดข้อมูลเขื่อน…")}</p>}
    {nearby.length > 0 && <section className="border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-nearest-dams">
      <h2 id="map-nearest-dams" className="font-semibold">{t("เขื่อนใกล้ฉัน")}{place.source !== "gps" && <span className="map-muted ml-2 text-xs font-normal">{t("ใกล้{name}", { name: placeName })}</span>}</h2>
      <ul className="mt-2 space-y-1">{nearby.map(({ dam, km }) => <li key={dam.id}>
        <button type="button" className="map-chip flex w-full items-center justify-between gap-2 text-left" onClick={() => onSelectDam(dam.id)}>
          <span className="min-w-0 truncate">{t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh}</span>
          <span className="map-muted shrink-0 text-xs">{t("{km} กม.", { km: Math.round(km) })}</span>
          <span className="flex shrink-0 items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: damBandColor(dam.band) }} aria-hidden="true" />{percent.format(dam.storagePct)}%</span>
        </button>
      </li>)}</ul>
    </section>}
    <section className="border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-rain-risk">
      <h2 id="map-rain-risk" className="font-semibold">{t("ฝนหนัก 24 ชม. (กรมอุตุฯ)")} <span className="map-water-badge">{t("สังเกต")}</span></h2>
      {rainRiskStatus === "ready" && rainRisk ? <>
        {rainProvinces.length ? <>
          <ul className="mt-2 space-y-1">{(showAllRainProvinces ? rainProvinces : rainProvinces.slice(0, 8)).map((station) => <li key={station.provinceTh}>
            <button type="button" className="map-chip flex w-full justify-between gap-2 text-left" onClick={() => onSelectRain(station.id)}>
              <span>{station.provinceTh === "กรุงเทพมหานคร" ? t.locale === "en" ? "Bangkok" : station.provinceTh : t("จ.{province}", { province: t.locale === "en" ? provinces.find((item) => item.th === station.provinceTh)?.en ?? station.provinceTh : station.provinceTh })}</span>
              <span>{t("{mm} มม. · {category}", { mm: station.rainMm, category: t(station.category === "veryHeavy" ? "ฝนหนักมาก" : "ฝนหนัก") })}</span>
            </button>
          </li>)}</ul>
          {!showAllRainProvinces && rainProvinces.length > 8 && <button type="button" className="map-chip mt-2 w-full" onClick={onShowAllRainProvinces}>{t("แสดงทั้งหมด ({n})", { n: rainProvinces.length })}</button>}
        </> : <p className="map-muted mt-2">{t("ไม่มีสถานีที่ฝน 24 ชม. เข้าเกณฑ์ฝนหนัก ({n} สถานี)", { n: rainRisk.reporting })}</p>}
        {rainRisk.observedAt && <p className="map-muted mt-2 text-xs">{t("ข้อมูลถึง {time} น. · กรมอุตุนิยมวิทยา", { time: formatTime(rainRisk.observedAt, "Asia/Bangkok", t.locale) })}</p>}
      </> : <p className="map-muted mt-2" role="status">{t(rainRiskStatus === "error" ? "ข้อมูลฝนหนักไม่พร้อมใช้งาน" : "กำลังโหลดข้อมูลฝนหนัก…")}</p>}
    </section>
    <p className="map-muted text-xs">{t("แตะเขื่อนบนแผนที่เพื่อดูรายละเอียดและทิศทางน้ำ")}</p>
  </section>;
}
