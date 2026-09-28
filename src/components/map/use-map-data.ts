"use client";

import { useEffect, useState } from "react";
import { lastRadarFrames } from "@/lib/radar/frames";
import type { RadarManifest } from "@/lib/radar/types";
import type { WindGrid } from "@/lib/wind/grid";
import type { Storm } from "@/lib/storms/normalize";
import type { Quake } from "@/lib/quakes/usgs";
import { buildTimeline, defaultIndex } from "@/lib/timeline/frames";

export function useMapData() {
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [initialIndex, setInitialIndex] = useState(0);
  const [wind, setWind] = useState<WindGrid | null>(null);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [quakes, setQuakes] = useState<Quake[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/radar", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("radar unavailable"); return response.json() as Promise<RadarManifest>; })
      .then((data) => {
        const radarTimes = lastRadarFrames(data.provider === "rainviewer" ? data.frames : []).map((frame) => frame.time);
        setInitialIndex(defaultIndex(buildTimeline(radarTimes, [], new Date().toISOString())));
        setManifest(data);
      })
      .catch(() => { if (!controller.signal.aborted) setManifest(null); });
    fetch("/api/wind", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("wind unavailable"); return response.json() as Promise<WindGrid>; })
      .then(setWind)
      .catch(() => { if (!controller.signal.aborted) setWind(null); });
    fetch("/api/storms", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ storms?: Storm[] }> : { storms: [] })
      .then((data) => setStorms(data.storms ?? []))
      .catch(() => {});
    fetch("/api/quakes", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ quakes?: Quake[] }> : { quakes: [] })
      .then((data) => setQuakes(data.quakes ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return { manifest, wind, storms, quakes, initialIndex };
}
