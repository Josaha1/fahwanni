import type { RefObject } from "react";
import { useT } from "@/i18n/client";
import { legendFor, overlayLegend, type PrimaryLayer, type Swatch } from "@/lib/map/legend";

function SwatchView({ swatch }: { swatch: Swatch }) {
  switch (swatch.kind) {
    case "line": return <svg width="24" height="20" viewBox="0 0 24 20" aria-hidden="true">
      <line x1="0" y1="10" x2="24" y2="10" stroke={swatch.color} strokeWidth="3" strokeDasharray={swatch.dashed ? "4 3" : undefined} />
    </svg>;
    case "fill": return <span className="block h-4 w-4 rounded-sm border" style={{ borderColor: swatch.color, backgroundColor: `color-mix(in srgb, ${swatch.color} ${swatch.opacity * 100}%, transparent)` }} aria-hidden="true" />;
    case "circle": return <span className="block rounded-full" style={{ width: swatch.size, height: swatch.size, backgroundColor: swatch.color }} aria-hidden="true" />;
    case "ring": return <span className="block h-4 w-4 rounded-full border-[3px]" style={{ borderColor: swatch.color }} aria-hidden="true" />;
    case "square": return <span className="block h-3 w-3 rounded-[2px] border border-white" style={{ backgroundColor: swatch.color }} aria-hidden="true" />;
    case "pin": return <span className="block h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: "var(--map-accent)" }} aria-hidden="true" />;
    case "probe": return <span className="block h-3.5 w-3.5 rounded-full border-[3px] bg-white/80" style={{ borderColor: "var(--map-accent)" }} aria-hidden="true" />;
  }
}

export function LegendDialog({ mode, primary, active, dialogRef, triggerRef }: {
  mode: "weather" | "water";
  primary: PrimaryLayer;
  active: { wind: boolean; storms: boolean; quakes: boolean; dams: boolean; rainRisk: boolean };
  dialogRef: RefObject<HTMLDialogElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useT();
  const legend = legendFor(primary);
  return <dialog ref={dialogRef} className="map-panel map-legend-dialog" aria-labelledby="map-legend-title"
    onClose={() => triggerRef.current?.focus()}>
    <div className="flex items-center justify-between gap-3">
      <h2 id="map-legend-title" className="text-lg font-semibold">{t("อ่านแผนที่")}</h2>
      <button type="button" className="map-icon-btn shrink-0" aria-label={t("ปิด")} onClick={() => dialogRef.current?.close()}>✕</button>
    </div>
    {mode === "weather" && <section className="mt-4">
      <h3 className="text-sm font-semibold">{t(legend.title)} · {t(legend.unit)}</h3>
      {legend.note && <p className="map-muted mt-1 text-xs">{t(legend.note)}</p>}
      <ul className="mt-2 space-y-2 text-sm">
        {legend.steps.map((step) => <li key={step.label} className="flex items-center gap-3">
          <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: step.color }} aria-hidden="true" />
          <span className="min-w-0 flex-1">{t(step.label)}</span>
          <span className="shrink-0">{step.value} {t(legend.unit)}</span>
        </li>)}
      </ul>
    </section>}
    {overlayLegend(active).map((section) => <section key={section.title} className="mt-4 border-t pt-3" style={{ borderColor: "var(--map-panel-border)" }}>
      <h3 className="text-sm font-semibold">{t(section.title)}</h3>
      <ul className="mt-2 space-y-2 text-sm">
        {section.rows.map((row) => <li key={row.label} className="flex items-center gap-3">
          <span className="flex w-6 shrink-0 items-center justify-center"><SwatchView swatch={row.swatch} /></span>
          <span>{t(row.label)}</span>
        </li>)}
      </ul>
    </section>)}
    {mode === "weather" && <p className="map-muted mt-4 text-xs">{t("ที่มา: RainViewer, Open-Meteo, CAMS, USGS, JMA/GDACS")}</p>}
    {active.dams && <p className="map-muted mt-1 text-xs">{t("ข้อมูลเขื่อน: กรมชลประทาน · เส้นทางน้ำ: HydroRIVERS (CC BY 4.0)")}</p>}
  </dialog>;
}
