"use client";

import { useId } from "react";
import { provinceBins, rainGauge, satelliteRing, streamRate, type SatelliteSample } from "@/lib/visuals";
import type { PixelCounts } from "@/lib/flood/viirs";
import type { FloodRiskPoint } from "@/lib/water/flood-risk";
import type { Position } from "@/lib/storms/normalize";

export type NearMeProps = {
  place: Position; date?: string; counts: PixelCounts | null; samples: readonly SatelliteSample[] | null; villages: readonly FloodRiskPoint[] | null;
  station: (Position & { rainMm: number }) | null; dam: (Position & { releaseCms: number | null }) | null;
  summaries: readonly string[];
};

export function nearMeVisuals(props: NearMeProps) {
  const samples = satelliteRing(props.samples, props.place);
  const flood = props.counts ? props.counts.flood + props.counts.recurringFlood : null;
  const insufficient = props.counts ? props.counts.insufficientData + props.counts.noData : null;
  const ring = { state: provinceBins(props.counts).state, radiusKm: 30,
    points: "points" in samples ? samples.points : [], flood: flood ?? 0, insufficient: insufficient ?? 0 };
  const gauge = rainGauge(props.station?.rainMm ?? null, 100);
  const release = streamRate(props.dam?.releaseCms ?? null, "cms", 1000);
  const rain = streamRate(props.station?.rainMm ?? null, "mm", 100);
  const state = { flood, insufficient,
    villages: props.villages?.length ?? null, rainMm: props.station?.rainMm ?? null, releaseCms: props.dam?.releaseCms ?? null };
  return { ring, gauge, rain, release, state };
}

export function NearMeTiles(props: NearMeProps) {
  const id = useId().replaceAll(":", "");
  const data = nearMeVisuals(props);
  const points = "points" in data.ring ? data.ring.points : [];
  return <div data-near-me-view="" className="relative h-[180px]" style={{ touchAction: "pan-y" }}
    data-scene-state={JSON.stringify({ mode: "svg", terrain: false, ...data.state })}>
    <div data-near-me-fallback="" className="grid h-full grid-cols-2 gap-2">
      <svg role="img" aria-label={props.summaries[0]} viewBox="0 0 160 80" className="h-full w-full rounded-lg border border-[var(--border)]">
        <defs><pattern id={`stipple-${id}`} width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#9ca3af" /></pattern></defs>
        <circle cx="80" cy="40" r="34" fill={data.ring.state === "no-data" ? `url(#stipple-${id})` : "none"} stroke="currentColor" opacity="0.4" />
        <circle cx="80" cy="40" r="17" fill="none" stroke="currentColor" opacity="0.2" />
        {points.filter((point) => !["dry", "water"].includes(point.kind)).map((point, i) => <circle key={i} cx={80 + point.eastKm / 30 * 34} cy={40 - point.northKm / 30 * 34} r="1.8" fill={point.kind.includes("flood") ? "#f97316" : "#9ca3af"} />)}
        <path d="M76 42V37L80 33L84 37V42Z" fill="currentColor" />
      </svg>
      <svg role="img" aria-label={props.summaries[1]} viewBox="0 0 160 80" className="h-full w-full rounded-lg border border-[var(--border)]">
        {(props.villages ?? []).slice(0, 12).map((_, i) => <path key={i} d="M-5 6V-2L0-7L5-2V6Z" transform={`translate(${35 + i % 4 * 30} ${24 + Math.floor(i / 4) * 18})`} fill="#eab308" />)}
        {props.villages === null && <text x="80" y="44" textAnchor="middle" fill="currentColor">—</text>}
        {(props.villages?.length ?? 0) > 12 && <text x="150" y="75" textAnchor="end" fill="currentColor" fontSize="12">+{props.villages!.length - 12}</text>}
      </svg>
      <svg role="img" aria-label={props.summaries[2]} viewBox="0 0 160 80" className="h-full w-full rounded-lg border border-[var(--border)]">
        <path d="M64 8V66Q80 78 96 66V8" fill="none" stroke="currentColor" strokeWidth="2" />
        {data.gauge.state === "data" ? <rect x="67" y={68 - data.gauge.ratio * 58} width="26" height={data.gauge.ratio * 58} rx="3" fill="#38bdf8" /> : <text x="80" y="44" textAnchor="middle" fill="currentColor">—</text>}
        {[35, 90].map((mm) => {
          const gauge = rainGauge(mm, 100);
          const y = 68 - (gauge.state === "data" ? gauge.ratio : 0) * 58;
          return <g key={mm}><path d={`M98 ${y}h6`} stroke="currentColor" /><text x="108" y={y + 3} fill="currentColor" fontSize="10">{mm}</text></g>;
        })}
      </svg>
      <svg role="img" aria-label={props.summaries[3]} viewBox="0 0 160 80" className="h-full w-full rounded-lg border border-[var(--border)]">
        <path d="M45 62L59 20H91L105 62Z" fill="#94a3b8" /><path d="M71 23V60" stroke="#38bdf8" strokeWidth="8" />
        {data.release.state === "data" ? data.release.ratio > 0 && <path d="M76 60Q110 52 137 66" fill="none" stroke="#38bdf8" strokeWidth={data.release.ratio * 10} /> : <text x="125" y="44" textAnchor="middle" fill="currentColor">—</text>}
      </svg>
    </div>
  </div>;
}
