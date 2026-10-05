import { useId } from "react";
import type { TankEntry } from "./tank-grid-data";
import "./tank-svg.css";

export function GridTankSvg({ entry, reducedMotion = false }: { entry: TankEntry; reducedMotion?: boolean }) {
  const { fill, release, inflow } = entry;
  const id = useId();
  const y = fill.state === "data" ? 140 - fill.height * 100 : 19;
  // Two identical periods keep the clipped surface continuous as CSS moves it by one period.
  const amplitude = Math.min(2, (140 - y) / 2, (y - 19) / 2);
  const surface = Array.from({ length: 65 }, (_, i) => {
    const x = 42 + i * 152 / 64;
    const height = y + amplitude * Math.sin(i * Math.PI / 16);
    return `${i === 0 ? "M" : "L"}${x} ${Number(height.toFixed(3))}`;
  }).join(" ");
  return <svg viewBox="0 0 160 165" className="h-full w-full" aria-hidden="true">
    <defs>
      <clipPath id={`glass-${id}`}><rect x="42" y="19" width="76" height="121" rx="12" /></clipPath>
      <linearGradient id={`water-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7dd3fc" stopOpacity="0.8" />
        <stop offset="1" stopColor="#0284c7" stopOpacity="0.9" />
      </linearGradient>
      <linearGradient id={`glass-light-${id}`}>
        <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.04" />
        <stop offset="1" stopColor="#fff" stopOpacity="0.2" />
      </linearGradient>
      <pattern id={`missing-${id}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#9ca3af" opacity="0.2" /><line x1="0" x2="0" y2="8" stroke="#9ca3af" strokeWidth="3" /></pattern>
    </defs>
    <rect x="42" y="19" width="76" height="121" rx="12" fill={`url(#glass-light-${id})`} />
    <g clipPath={`url(#glass-${id})`}>
      {fill.state === "data" ? <g className={!reducedMotion && fill.height > 0 ? "tank-wave" : undefined}>
        <path data-tank-fill="" d={`${surface} L194 140 L42 140 Z`} fill={`url(#water-${id})`} />
        {fill.height > 0 && <path d={surface} fill="none" stroke="#e0f2fe" strokeWidth="2" strokeOpacity="0.8" />}
      </g> : <rect x="42" y="19" width="76" height="121" fill={`url(#missing-${id})`} />}
      <rect x="49" y="27" width="7" height="105" rx="3.5" fill="#fff" opacity="0.35" />
    </g>
    <rect x="42" y="19" width="76" height="121" rx="12" fill="none" stroke="var(--muted)" strokeWidth="2" />
    <path data-status-rim="" d="M54 19H106" fill="none" stroke={fill.state === "data" ? fill.color : "#9ca3af"} strokeWidth="3" strokeLinecap="round" />
    <line data-crest="" x1="34" x2="126" y1="40" y2="40" stroke="var(--foreground)" strokeOpacity="0.65" strokeDasharray="4 3" />
    {inflow.state === "data" && inflow.ratio > 0 && <path data-stream="inflow" d="M4 65H36M29 59L36 65L29 71" fill="none" stroke="#38bdf8" strokeWidth={inflow.ratio * 6} />}
    {release.state === "data" && release.ratio > 0 && <path data-stream="release" d="M124 123H156M149 117L156 123L149 129" fill="none" stroke="#38bdf8" strokeWidth={release.ratio * 6} />}
  </svg>;
}
