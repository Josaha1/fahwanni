"use client";

import { useId } from "react";
import { rainGauge, visualSummaryRain } from "@/lib/visuals";
import { useT } from "@/i18n/client";

export function RainTube({ mm, model = false }: { mm: number | null; model?: boolean }) {
  const t = useT();
  const id = useId();
  const gauge = rainGauge(mm, 150);
  const caption = visualSummaryRain(gauge, t);
  const fill = gauge.state === "data" ? gauge.ratio * 100 : 0;
  return <figure className="text-center">
    <svg viewBox="0 0 80 130" className="mx-auto h-32 w-20" role="img" aria-label={caption}>
      <defs><pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="currentColor" strokeWidth="2" /></pattern></defs>
      <rect x="20" y="10" width="40" height="100" rx="8" fill="none" stroke="currentColor" opacity=".4" />
      <rect x="22" y={110 - fill} width="36" height={fill} fill={model ? `url(#${id})` : "#38bdf8"} />
      {[35, 90].map((threshold) => <g key={threshold}><path d={`M16 ${110 - threshold / 150 * 100}H64`} stroke="currentColor" opacity=".5" /><text x="66" y={113 - threshold / 150 * 100} fontSize="8" fill="currentColor">{threshold}</text></g>)}
    </svg>
    <figcaption className="text-sm tabular-nums">{caption}</figcaption>
  </figure>;
}
