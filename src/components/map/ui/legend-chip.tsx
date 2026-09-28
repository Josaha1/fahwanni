import type { RefObject } from "react";
import { useT } from "@/i18n/client";
import { legendFor, legendGradient, type PrimaryLayer } from "@/lib/map/legend";

export function LegendChip({ primary, buttonRef, onOpen }: {
  primary: PrimaryLayer;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  const t = useT();
  const legend = legendFor(primary);
  return <button ref={buttonRef} type="button" className="map-panel map-legend-chip text-left"
    aria-haspopup="dialog" aria-label={t("อ่านแผนที่: {title}", { title: t(legend.title) })} onClick={onOpen}>
    <span className="block text-xs font-semibold">{t(legend.title)} · {t(legend.unit)}</span>
    <span className="mt-1.5 block h-2 rounded-full" style={{ background: legendGradient(primary) }} aria-hidden="true" />
    <span className="mt-1 flex justify-between gap-2 text-[11px]">
      <span>{legend.steps[0].value}</span><span>{legend.steps.at(-1)?.value}</span>
    </span>
    {legend.note && <span className="map-muted mt-0.5 block text-[10px]">{t(legend.note)}</span>}
  </button>;
}
