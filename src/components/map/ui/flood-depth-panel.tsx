"use client";

import { useId } from "react";
import type { Map } from "maplibre-gl";
import { useT } from "@/i18n/client";
import { depthPresets, floorReached } from "@/lib/map/flood-sim";
import { useFloodDepthLayer } from "../layers/use-flood-depth-layer";
import styles from "./flood-depth-panel.module.css";

export function FloodDepthPanel({ map, depth, onDepth, onClose }: {
  map: Map | null;
  depth: number;
  onDepth: (depth: number) => void;
  onClose: () => void;
}) {
  const t = useT();
  const sliderId = useId();
  useFloodDepthLayer(map, true, depth);
  const summary = t("น้ำ {d} ม. · ถึงชั้น {floor}", { d: depth, floor: floorReached(depth).floor });

  return <section className={`map-panel ${styles.panel}`} aria-label={t("จำลองน้ำท่วม (ความลึกจากพื้น)")}>
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={sliderId} className="text-sm font-semibold">{summary}</label>
      <button type="button" className="map-icon-btn shrink-0" aria-label={t("ปิดจำลองน้ำท่วม")} onClick={onClose}>✕</button>
    </div>
    <input id={sliderId} type="range" min={0} max={5} step={0.25} value={depth} aria-valuetext={summary}
      className="block h-6 w-full" onChange={(event) => onDepth(Number(event.currentTarget.value))} />
    <div className="mt-1 grid grid-cols-4 gap-1">
      {depthPresets.map((preset) => <button key={preset.m} type="button" aria-pressed={depth === preset.m}
        className={`map-chip min-h-11 text-xs leading-tight ${styles.preset}`} onClick={() => onDepth(preset.m)}>
        <span className="block">{t("{d} ม.", { d: preset.m })}</span>
        <span className="block text-[10px]">{t(preset.label)}</span>
      </button>)}
    </div>
    <p className="map-muted mt-2 text-xs leading-tight">{t("ภาพจำลองสมมติ ไม่ใช่การพยากรณ์ · ความลึกวัดจากพื้นดินทุกจุดเท่ากัน")}</p>
  </section>;
}
