"use client";

import { useEffect, useRef } from "react";
import { Marker } from "maplibre-gl";
import { MapProvider, useMapContext } from "@/components/map/map-provider";
import { useRadarLayer } from "@/components/map/layers/use-radar-layer";
import { useTerrainLayer } from "@/components/map/layers/use-terrain-layer";
import { rainGauge, visualSummaryRain } from "@/lib/visuals";
import { useT } from "@/i18n/client";
import type { RadarManifest } from "@/lib/radar/types";
import type { ReportingRainStation } from "@/lib/rain-risk/tmd";
import type { GlTier } from "@/lib/three/gl-tier";
import type { Position } from "@/lib/storms/normalize";

export type RainMapProps = { place: Position; radar: RadarManifest | null; stations: ReportingRainStation[]; activeIndex: number; tier: GlTier; onTier: (tier: GlTier) => void; onReady: (ready: boolean) => void };

function Layers({ radar, stations, activeIndex, tier, onTier, onReady }: RainMapProps) {
  const { map, status } = useMapContext();
  const t = useT();
  useTerrainLayer(map, true, tier !== "full");
  useRadarLayer(map, radar?.frames ?? [], radar?.maxZoom ?? 7, activeIndex, true);

  useEffect(() => { onReady(status === "ready"); if (status === "error") onTier("svg"); }, [status, onReady, onTier]);
  useEffect(() => {
    if (!map || status !== "ready") return;
    // Applied after load: the provider sets its own initial camera, which would undo an earlier fit.
    // Keep the provider's wider pan bounds so they do not force a national view to zoom in.
    map.jumpTo({ center: [100.9, 12.6], zoom: 4.6, pitch: 55, bearing: 0 });
  }, [map, status]);
  useEffect(() => {
    if (!map) return;
    map.setPixelRatio(tier === "full" ? Math.min(devicePixelRatio || 1, 1.5) : 1);
  }, [map, tier]);
  useEffect(() => {
    if (!map) return;
    let losses = 0;
    let previous = 0;
    const samples: number[] = [];
    const lost = () => { if (++losses >= 2) onTier("svg"); };
    const render = () => {
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      // Ignore idle gaps between scrubber frames and user gestures.
      if (tier === "full" && delta > 0 && (delta < 100 || map.isMoving())) {
        samples.push(delta);
        if (samples.length > 30) samples.shift();
        if (samples.length === 30 && samples.reduce((sum, ms) => sum + ms, 0) / samples.length > 33) onTier("reduced");
      }
    };
    const canvas = map.getCanvas();
    canvas.addEventListener("webglcontextlost", lost);
    map.on("render", render);
    return () => { canvas.removeEventListener("webglcontextlost", lost); map.off("render", render); };
  }, [map, tier, onTier]);
  useEffect(() => {
    if (!map) return;
    const markers = stations.map((station) => {
      const gauge = rainGauge(station.rainMm, 150);
      const element = document.createElement("div");
      const dot = document.createElement("span");
      dot.className = "rain-station-dot";
      if (gauge.state === "data") {
        const size = 8 + gauge.ratio * 24;
        dot.style.width = dot.style.height = `${size}px`;
        dot.style.background = gauge.category === "veryHeavy" ? "#dc2626" : gauge.category === "heavy" ? "#f59e0b" : "#38bdf8";
        if (tier === "full" && station.rainMm > 0) {
          dot.classList.add("rain-station-pulse");
          dot.style.setProperty("--rain-pulse", String(gauge.ratio));
          dot.style.animationDuration = `${2.8 - gauge.ratio * 1.6}s`;
        }
      }
      element.appendChild(dot);
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", `${t.locale === "en" ? station.nameEn : station.nameTh} · ${visualSummaryRain(gauge, t)}`);
      element.title = element.getAttribute("aria-label")!;
      return new Marker({ element }).setLngLat([station.lon, station.lat]).addTo(map);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [map, stations, tier, t]);
  return null;
}

export function RainMap(props: RainMapProps) {
  const container = useRef<HTMLDivElement>(null);
  return <MapProvider containerRef={container} initialCenter={[101.5, 13]} initialZoom={4}>
    {/* MapLibre's unlayered position: relative overrides the Tailwind utility and collapses the viewport. */}
    <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} />
    <Layers {...props} />
  </MapProvider>;
}
