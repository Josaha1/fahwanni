import type { RefObject } from "react";
import { useT } from "@/i18n/client";
import { damLegendStrip, legendFor, legendGradient, type PrimaryLayer } from "@/lib/map/legend";

/** `floating`: the desktop chip over the map. `strip`: a one-line key inside the phone sheet. */
export function LegendChip({ primary, variant, buttonRef, onOpen }: {
  primary: PrimaryLayer;
  variant: "floating" | "strip";
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  const t = useT();
  const legend = legendFor(primary);
  const label = t("อ่านแผนที่: {title}", { title: t(legend.title) });
  if (variant === "strip") return <button ref={buttonRef} type="button" className="map-legend-strip"
    aria-haspopup="dialog" aria-label={label} onClick={onOpen}>
    <span className="shrink-0 text-xs font-semibold">{t(legend.title)} · {t(legend.unit)}</span>
    <span className="shrink-0 text-[11px]">{legend.steps[0].value}</span>
    <span className="h-2 min-w-0 flex-1 rounded-full" style={{ background: legendGradient(primary) }} aria-hidden="true" />
    <span className="shrink-0 text-[11px]">{legend.steps.at(-1)?.value}</span>
  </button>;
  return <button ref={buttonRef} type="button" className="map-panel map-legend-chip text-left"
    aria-haspopup="dialog" aria-label={label} onClick={onOpen}>
    <span className="block text-xs font-semibold">{t(legend.title)} · {t(legend.unit)}</span>
    <span className="mt-1.5 block h-2 rounded-full" style={{ background: legendGradient(primary) }} aria-hidden="true" />
    <span className="mt-1 flex justify-between gap-2 text-[11px]">
      <span>{legend.steps[0].value}</span><span>{legend.steps.at(-1)?.value}</span>
    </span>
    {legend.note && <span className="map-muted mt-0.5 block text-[10px]">{t(legend.note)}</span>}
  </button>;
}

export function DamLegendStrip({ buttonRef, onOpen }: { buttonRef?: RefObject<HTMLButtonElement | null>; onOpen: () => void }) {
  const t = useT();
  const strip = damLegendStrip();
  return <button ref={buttonRef} type="button" className="map-legend-strip" aria-haspopup="dialog"
    aria-label={t("อ่านแผนที่: {title}", { title: t(strip.title) })} onClick={onOpen}>
    <span className="shrink-0 text-xs font-semibold">{t(strip.title)} · {t(strip.unit)}</span>
    <span className="flex min-w-0 flex-1 justify-between gap-1">
      {strip.steps.map((step) => <span key={step.label} className="flex items-center gap-1 text-[11px]">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: step.color }} aria-hidden="true" />{step.label}
      </span>)}
    </span>
  </button>;
}
