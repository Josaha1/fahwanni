import type { ReactNode, RefObject } from "react";
import { useT } from "@/i18n/client";

type SwitchRow = { label: string; count?: number; checked: boolean; onChange: () => void; disabled?: boolean };

export function LayersDialog({ mode, primaryPicker, overlays, terrain, fullscreen, onFullscreen, onShare, onShareImage,
  makingImage, onOpenLegend, dialogRef, triggerRef }: {
  mode: "weather" | "water";
  primaryPicker: ReactNode;
  overlays: SwitchRow[];
  terrain: SwitchRow | null;
  fullscreen: boolean;
  onFullscreen: () => void;
  onShare: () => void;
  onShareImage: () => void;
  makingImage: boolean;
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
    <section className="mt-4 border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }} aria-labelledby="map-controls-title">
      <h3 id="map-controls-title" className="mb-2 text-sm font-semibold">{t("แผนที่")}</h3>
      {terrain && switchButton(terrain)}
      {switchButton({ label: "เต็มจอ", checked: fullscreen, onChange: onFullscreen })}
      <button type="button" className="map-layer-action" onClick={onShare}>{t("แชร์มุมมองนี้")}</button>
      <button type="button" className="map-layer-action" onClick={onShareImage} disabled={makingImage}>{t("แชร์ภาพแผนที่")}</button>
    </section>
    <button type="button" className="map-layer-action mt-3 font-semibold" onClick={onOpenLegend}>{t("อ่านแผนที่")} ›</button>
  </dialog>;
}
