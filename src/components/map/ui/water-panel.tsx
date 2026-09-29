import { useState, useSyncExternalStore, type RefObject } from "react";
import { useT } from "@/i18n/client";
import { damBandColor } from "@/lib/dams/bands";
import type { DamsPayload } from "@/lib/dams/client";
import type { Dam } from "@/lib/dams/types";
import { nearestDams, waterSummary } from "@/lib/dams/summary";
import { watchRows, type WaterWatch } from "@/lib/water/watchlist";
import { EMERGENCY_NUMBERS } from "@/lib/emergency";
import { formatFullDate, formatTime } from "@/lib/format";
import type { Place } from "@/lib/place";
import { provinces } from "@/lib/provinces";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import { visibleWarnings, type TmdWarnings } from "@/lib/tmd";
import { DamLegendStrip } from "./legend-chip";
import { filterDams, findWater, type DamFilter } from "@/lib/water/find";
import { TmdWarningList } from "@/components/water/tmd-warnings";

const DISMISSED_KEY = "fah-tmd-dismissed";

function readDismissed(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((key): key is string => typeof key === "string") : [];
  } catch { return []; }
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => { window.removeEventListener("online", onChange); window.removeEventListener("offline", onChange); };
}

export function WaterPanel({ dams, damsStatus, watch, rainRisk, rainRiskStatus, tmdWarnings, place, placeName, onSelectDam, onSelectRain, waterDay, rainStartDate,
  legendButton, onOpenLegend, showAllRainProvinces, onShowAllRainProvinces, allRoutes, onToggleAllRoutes, rainAccumOn, rainAccumStatus, onToggleRainAccum,
  damFilter, onDamFilter, riverPoints, onSelectRiver }: {
  dams: DamsPayload | null;
  damsStatus: "idle" | "loading" | "ready" | "error";
  watch: WaterWatch;
  rainRisk: RainRisk | null;
  rainRiskStatus: "idle" | "loading" | "ready" | "error";
  tmdWarnings: TmdWarnings | null;
  place: Place;
  placeName: string;
  onSelectDam: (id: string) => void;
  onSelectRain: (id: string) => void;
  waterDay: number;
  rainStartDate: string;
  legendButton: RefObject<HTMLButtonElement | null>;
  onOpenLegend: () => void;
  showAllRainProvinces: boolean;
  onShowAllRainProvinces: () => void;
  allRoutes: boolean;
  onToggleAllRoutes: () => void;
  damFilter: DamFilter;
  onDamFilter: (filter: DamFilter) => void;
  riverPoints: { id: string; nameTh: string; nameEn: string }[];
  onSelectRiver: (id: string) => void;
  rainAccumOn: boolean;
  rainAccumStatus: "loading" | "shown" | "none" | "unavailable";
  onToggleRainAccum: () => void;
}) {
  const t = useT();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const warnings = visibleWarnings(tmdWarnings?.items ?? [], dismissed);
  const dismissWarning = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* Keep dismissal for this visit. */ }
  };
  const summary = damsStatus === "ready" && dams ? waterSummary(dams.dams, waterDay === 0 && rainRiskStatus === "ready" && rainRisk ? rainRisk.stations : null) : null;
  const nearby = damsStatus === "ready" && dams ? nearestDams(dams.dams, place) : [];
  const watched = damsStatus === "ready" && dams ? watchRows(watch, dams.dams.map((dam) => ({ kind: "dam" as const, id: dam.id, value: dam.storagePct, unit: "pct" as const, date: dam.date, dam }))) : [];
  const rainProvinces = [...new Map([...(rainRisk?.stations ?? [])].reverse().map((station) => [station.provinceTh, station])).values()]
    .sort((a, b) => b.rainMm - a.rainMm);
  const percent = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });

  return <section className="mt-2 space-y-2 text-sm" aria-label={t("สถานการณ์น้ำ")}>
    {damsStatus === "ready" && dams ? <>
      <p className={`flex flex-wrap items-center gap-2${online ? "" : " map-warning"}`}>
        <span className="map-water-badge">{t("สังเกต")}</span>
        <span>{!online && dams.fetchedAt && !Number.isNaN(Date.parse(dams.fetchedAt))
          ? t("ข้อมูลออฟไลน์ เมื่อ {time} น.", { time: formatTime(dams.fetchedAt, "Asia/Bangkok", t.locale) })
          : dams.dataDate
            ? t("ข้อมูลกรมชลประทาน · ข้อมูลวันที่ {date}", { date: formatFullDate(`${dams.dataDate}T12:00:00+07:00`, "Asia/Bangkok", t.locale) })
            : t("ข้อมูลกรมชลประทาน")}</span>
      </p>
      {dams.stale && <p className="map-warning text-xs"><span aria-hidden="true">⚠ </span>{t("ข้อมูลอาจไม่เป็นปัจจุบัน")}</p>}
      {waterDay > 0 && dams.dataDate && <p className="map-muted text-xs">{t("เขื่อนแสดงข้อมูลวัดจริงวันที่ {date} — ไม่ใช่พยากรณ์", { date: formatFullDate(`${dams.dataDate}T12:00:00+07:00`, "Asia/Bangkok", t.locale) })}</p>}
    </> : <p className="map-muted" role="status">{t("กำลังโหลดข้อมูลเขื่อน…")}</p>}
    {warnings.length > 0 && <TmdWarningList items={warnings} limit={2} onDismiss={dismissWarning} onMap />}
    <DamLegendStrip buttonRef={legendButton} onOpen={onOpenLegend} />
    <button type="button" className="map-chip text-sm" aria-pressed={allRoutes} onClick={onToggleAllRoutes}>{t("เส้นทางน้ำทุกเขื่อน")}</button>
    {damsStatus === "ready" && dams && <WaterFinder dams={dams.dams} watch={watch} damFilter={damFilter} onDamFilter={onDamFilter}
      riverPoints={riverPoints} onSelectDam={onSelectDam} onSelectRiver={onSelectRiver} />}
    <section className="border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-label={t("ฝนสะสม 3 วัน")}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="map-chip text-sm" aria-pressed={rainAccumOn} onClick={onToggleRainAccum}>{t("ฝนสะสม 3 วัน")}</button>
        <span className="map-water-badge">{t("พยากรณ์ (แบบจำลอง)")}</span>
      </div>
      {waterDay > 0 && <p className="map-muted mt-1 text-xs">{t("ฝนสะสม 3 วัน เริ่ม {date}", { date: formatFullDate(`${rainStartDate}T12:00:00+07:00`, "Asia/Bangkok", t.locale) })}</p>}
      <p className="map-muted mt-2 text-xs">{t("พื้นที่ที่แบบจำลองคาดว่าฝนรวม 3 วันถึง 90 มม. (ส้ม) หรือ 150 มม. (แดง) — ไม่ใช่แผนที่น้ำท่วม")}</p>
      {rainAccumOn && rainAccumStatus === "none" && <p className="mt-1 text-xs">{t(waterDay > 0 ? "แบบจำลองไม่มีพื้นที่ที่ฝนรวม 3 วันถึง 90 มม. ในช่วงที่เลือก" : "ตอนนี้แบบจำลองไม่มีพื้นที่ที่ฝนรวม 3 วันถึง 90 มม.")}</p>}
      {rainAccumOn && rainAccumStatus === "unavailable" && <p className="map-muted mt-1 text-xs">{t("ข้อมูลฝนพยากรณ์ไม่พร้อมใช้งาน")}</p>}
    </section>
    {summary && <p className="text-xs leading-relaxed">{t("เขื่อนน้ำมาก (เกิน 80%)")} <strong>{summary.over80}</strong> · {t("เกินความจุ")} <strong>{summary.over100}</strong> · {t("ระบายน้ำมาก")} <strong>{summary.highRelease}</strong>{summary.heavyRain !== null && <> · {t("สถานีฝนหนัก")} <strong>{summary.heavyRain}</strong></>}</p>}
    {watched.length > 0 && <section aria-labelledby="map-watched-dams">
      <h2 id="map-watched-dams" className="font-semibold">{t("เขื่อนที่ติดตาม")}</h2>
      <ul className="mt-2 space-y-1">{watched.map(({ item: { dam }, change, since }) => <li key={dam.id}>
        <button type="button" className="map-chip flex w-full flex-wrap items-center justify-between gap-1 text-left" onClick={() => onSelectDam(dam.id)}>
          <span className="min-w-0 truncate">{t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh}</span>
          <span>{percent.format(dam.storagePct)}%</span>
          {change !== null && since && <span className="map-muted text-xs">{change > 0 ? "▲ " : change < 0 ? "▼ " : ""}{t("{change}% จากวันที่ {date}", {
            change: `${change > 0 ? "+" : ""}${percent.format(change)}`, date: formatFullDate(`${since}T12:00:00+07:00`, "Asia/Bangkok", t.locale),
          })}</span>}
        </button>
      </li>)}</ul>
    </section>}
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
    {waterDay === 0 && <section className="border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-rain-risk">
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
    </section>}
    <details className="border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }}>
      <summary className="cursor-pointer font-semibold">{t("เบอร์ฉุกเฉิน")}</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {EMERGENCY_NUMBERS.map(({ label, number, href }) => <a key={number} className="map-chip inline-flex items-center" href={href}>{t(label)}</a>)}
      </div>
    </details>
    <p className="map-muted text-xs">{t("แตะเขื่อนบนแผนที่เพื่อดูรายละเอียดและทิศทางน้ำ")}</p>
  </section>;
}

const FILTERS: { filter: DamFilter; label: string }[] = [
  { filter: "all", label: "ทั้งหมด" }, { filter: "full", label: "น้ำมาก >80%" },
  { filter: "release", label: "ระบายมาก" }, { filter: "watched", label: "ติดตาม" },
];

/** Water-mode dam filter chips and a name search over dams and river points. */
function WaterFinder({ dams, watch, damFilter, onDamFilter, riverPoints, onSelectDam, onSelectRiver }: {
  dams: Dam[]; watch: WaterWatch; damFilter: DamFilter; onDamFilter: (filter: DamFilter) => void;
  riverPoints: { id: string; nameTh: string; nameEn: string }[];
  onSelectDam: (id: string) => void; onSelectRiver: (id: string) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const hits = findWater(query, dams, riverPoints, t.locale);
  return <section className="space-y-2" aria-label={t("ค้นหาและกรองเขื่อน")}>
    <div role="radiogroup" aria-label={t("แสดงเขื่อน")} className="flex flex-wrap gap-1.5">
      {FILTERS.map(({ filter, label }) => <button key={filter} type="button" role="radio" aria-checked={damFilter === filter}
        className="map-chip text-xs" onClick={() => onDamFilter(filter)}>
        {t(label)} ({filterDams(dams, filter, watch).length})
      </button>)}
    </div>
    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
      placeholder={t("ค้นหาเขื่อนหรือแม่น้ำ")} aria-label={t("ค้นหาเขื่อนหรือแม่น้ำ")}
      className="map-chip w-full text-sm" style={{ textAlign: "left" }} />
    {query.trim() && <ul className="space-y-1">
      {hits.length ? hits.map((hit) => <li key={`${hit.kind}:${hit.id}`}>
        <button type="button" className="map-chip flex w-full justify-between gap-2 text-left text-sm"
          onClick={() => { setQuery(""); if (hit.kind === "dam") onSelectDam(hit.id); else onSelectRiver(hit.id); }}>
          <span>{hit.name}</span><span className="map-muted text-xs">{t(hit.kind === "dam" ? "เขื่อน" : "แม่น้ำ")}</span>
        </button>
      </li>) : <li className="map-muted text-xs">{t("ไม่พบชื่อนี้")}</li>}
    </ul>}
  </section>;
}
