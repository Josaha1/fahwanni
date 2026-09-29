import type { ReactNode, RefObject } from "react";
import { useT } from "@/i18n/client";
import type { Dam } from "@/lib/dams/types";
import { formatFullDate } from "@/lib/format";
import { filterDams, type DamFilter } from "@/lib/water/find";
import type { WaterWatch } from "@/lib/water/watchlist";

type SwitchRow = { label: string; count?: number; checked: boolean; onChange: () => void; disabled?: boolean };
type WaterLayers = {
  dams: Dam[] | null;
  watch: WaterWatch;
  damFilter: DamFilter;
  onDamFilter: (filter: DamFilter) => void;
  routes: SwitchRow;
  radar: SwitchRow & { available: boolean; ageKey: string; age: number; warn: boolean };
  rainAccum: SwitchRow & { status: "loading" | "shown" | "none" | "unavailable"; day: number; startDate: string };
  satFlood: SwitchRow;
};

const FILTERS: { filter: DamFilter; label: string }[] = [
  { filter: "all", label: "ทั้งหมด" }, { filter: "full", label: "น้ำมาก >80%" },
  { filter: "release", label: "ระบายมาก" }, { filter: "watched", label: "ติดตาม" },
];

export function LayersDialog({ mode, primaryPicker, overlays, waterLayers, terrain, fullscreen, onFullscreen,
  onOpenLegend, dialogRef, triggerRef }: {
  mode: "weather" | "water";
  primaryPicker: ReactNode;
  overlays: SwitchRow[];
  waterLayers: WaterLayers;
  terrain: SwitchRow | null;
  fullscreen: boolean;
  onFullscreen: () => void;
  onOpenLegend: () => void;
  dialogRef: RefObject<HTMLDialogElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useT();
  const switchButton = ({ label, count, checked, onChange, disabled }: SwitchRow) =>
    <button key={label} type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange}
      className="map-layer-switch disabled:opacity-60">
      <span>{t(label)}{count !== undefined ? ` (${count})` : ""}</span><span className="map-layer-switch-track" aria-hidden="true" />
    </button>;

  return <dialog id="map-layers-dialog" ref={dialogRef} className="map-panel map-legend-dialog map-layers-dialog" aria-labelledby="map-layers-title"
    onClose={() => triggerRef.current?.focus()}>
    <div className="flex items-center justify-between gap-3">
      <h2 id="map-layers-title" className="text-lg font-semibold">{t("ชั้นข้อมูล")}</h2>
      <button type="button" className="map-icon-btn shrink-0" aria-label={t("ปิด")} onClick={() => dialogRef.current?.close()}>✕</button>
    </div>
    {mode === "weather" && <>
      <section className="mt-4" aria-labelledby="map-primary-title">
        <h3 id="map-primary-title" className="mb-2 text-sm font-semibold">{t("ชั้นหลัก")}</h3>
        {primaryPicker}
      </section>
      <section className="mt-4 border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-overlays-title">
        <h3 id="map-overlays-title" className="mb-2 text-sm font-semibold">{t("ซ้อนทับ")}</h3>
        {overlays.map(switchButton)}
      </section>
    </>}
    {mode === "water" && <>
      {waterLayers.dams && <section className="mt-4" aria-labelledby="map-dam-filters-title">
        <h3 id="map-dam-filters-title" className="mb-2 text-sm font-semibold">{t("แสดงเขื่อน")}</h3>
        <div role="radiogroup" aria-labelledby="map-dam-filters-title" className="flex flex-wrap gap-1.5">
          {FILTERS.map(({ filter, label }) => <button key={filter} type="button" role="radio" aria-checked={waterLayers.damFilter === filter}
            className="map-chip text-xs" onClick={() => waterLayers.onDamFilter(filter)}>
            {t(label)} ({filterDams(waterLayers.dams ?? [], filter, waterLayers.watch).length})
          </button>)}
        </div>
      </section>}
      <section className="mt-4 border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-water-overlays-title">
        <h3 id="map-water-overlays-title" className="mb-2 text-sm font-semibold">{t("ซ้อนทับ")}</h3>
        {switchButton(waterLayers.routes)}
        {waterLayers.radar.available && switchButton(waterLayers.radar)}
        {waterLayers.radar.checked && <p className={`${waterLayers.radar.warn ? "map-warning" : "map-muted"} text-xs`}>{waterLayers.radar.warn && <span aria-hidden="true">⚠ </span>}{t(waterLayers.radar.ageKey, { n: waterLayers.radar.age })}</p>}
        {switchButton(waterLayers.rainAccum)}
        <span className="map-water-badge inline-block">{t("พยากรณ์ (แบบจำลอง)")}</span>
        {waterLayers.rainAccum.day > 0 && <p className="map-muted mt-1 text-xs">{t("ฝนสะสม 3 วัน เริ่ม {date}", { date: formatFullDate(`${waterLayers.rainAccum.startDate}T12:00:00+07:00`, "Asia/Bangkok", t.locale) })}</p>}
        <p className="map-muted mt-2 text-xs">{t("พื้นที่ที่แบบจำลองคาดว่าฝนรวม 3 วันถึง 90 มม. (ส้ม) หรือ 150 มม. (แดง) — ไม่ใช่แผนที่น้ำท่วม")}</p>
        {waterLayers.rainAccum.checked && waterLayers.rainAccum.status === "none" && <p className="mt-1 text-xs">{t(waterLayers.rainAccum.day > 0 ? "แบบจำลองไม่มีพื้นที่ที่ฝนรวม 3 วันถึง 90 มม. ในช่วงที่เลือก" : "ตอนนี้แบบจำลองไม่มีพื้นที่ที่ฝนรวม 3 วันถึง 90 มม.")}</p>}
        {waterLayers.rainAccum.checked && waterLayers.rainAccum.status === "unavailable" && <p className="map-muted mt-1 text-xs">{t("ข้อมูลฝนพยากรณ์ไม่พร้อมใช้งาน")}</p>}
        {switchButton(waterLayers.satFlood)}
        <p className="map-water-badge inline-block">{t("สังเกตจากดาวเทียม · ล่าช้า ~1 วัน · ใต้เมฆมองไม่เห็น")}</p>
      </section>
    </>}
    <section className="mt-4 border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-controls-title">
      <h3 id="map-controls-title" className="mb-2 text-sm font-semibold">{t("แผนที่")}</h3>
      {terrain && switchButton(terrain)}
      {switchButton({ label: "เต็มจอ", checked: fullscreen, onChange: onFullscreen })}
    </section>
    <button type="button" className="map-layer-action mt-3 font-semibold" onClick={onOpenLegend}>{t("อ่านแผนที่")} ›</button>
  </dialog>;
}
