"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { AttributionControl, Map, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { version } from "maplibre-gl/package.json";
import { neonStyle } from "@/lib/map/neon-style";
import { TERRAIN_ATTRIBUTION } from "@/lib/map/terrain";

// Turbopack does not emit the worker/shared modules v6 loads via import.meta.url; they are copied
// to public/vendor by scripts/copy-maplibre-worker.mjs.
setWorkerUrl(`/vendor/maplibre/${version}/maplibre-gl-worker.mjs`);

const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
let neonStylePromise: Promise<StyleSpecification> | undefined;

function loadNeonStyle(): Promise<StyleSpecification> {
  if (!neonStylePromise) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    neonStylePromise = fetch(DARK_STYLE_URL, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("map style unavailable"); return response.json() as Promise<StyleSpecification>; })
      .then(neonStyle)
      .catch((error) => { neonStylePromise = undefined; throw error; })
      .finally(() => window.clearTimeout(timeout));
  }
  return neonStylePromise;
}

export type MapStatus = "loading" | "ready" | "error";

interface MapContextValue {
  map: Map | null;
  status: MapStatus;
  retry: () => void;
}

const MapContext = createContext<MapContextValue>({ map: null, status: "loading", retry: () => {} });

export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}

/**
 * Owns the single MapLibre instance for the map page. The map is created once per mount (and
 * again only on retry): it never depends on the place or the language, so changing either moves
 * the view or relabels instead of rebuilding every layer.
 */
export function MapProvider({ containerRef, initialCenter, children }: {
  containerRef: RefObject<HTMLDivElement | null>;
  /** Read once when the map is created. */
  initialCenter: [number, number];
  children: ReactNode;
}) {
  const [center] = useState(initialCenter);
  const [style, setStyle] = useState<StyleSpecification | string | null>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadNeonStyle().catch(() => DARK_STYLE_URL).then((loaded) => { if (active) setStyle(loaded); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!containerRef.current || !style) return;
    let created: Map | undefined;
    let waitingForStyle = true;
    try {
      created = new Map({
        container: containerRef.current,
        style,
        center,
        zoom: 6,
        minZoom: 3,
        maxZoom: 12,
        maxPitch: 60,
        maxBounds: [[80, -5], [130, 30]],
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 100,
        attributionControl: false,
      });
      const live = created;
      live.addControl(new NavigationControl(), "top-right");
      live.addControl(new AttributionControl({ compact: true, customAttribution: [
        '<a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">Weather data by RainViewer</a>',
        '<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Wind: Open-Meteo.com (CC BY 4.0)</a>',
        TERRAIN_ATTRIBUTION,
        '<a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">Earthquakes: USGS</a>',
      ] }), "bottom-right");
      // Start collapsed on every screen size: expanded credits cover the map.
      const attribution = live.getContainer().querySelector(".maplibregl-ctrl-attrib");
      attribution?.classList.remove("maplibregl-compact-show");
      attribution?.removeAttribute("open");

      live.once("load", () => setMap(live));
      live.on("idle", () => {
        if (waitingForStyle) { waitingForStyle = false; setStatus("ready"); }
      });
      live.on("error", () => {
        if (waitingForStyle) { waitingForStyle = false; setStatus("error"); }
      });
      return () => {
        setMap(null);
        live.remove();
      };
    } catch {
      created?.remove();
      const timer = window.setTimeout(() => setStatus("error"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [containerRef, style, center, attempt]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(() => ({ map, status, retry }), [map, status, retry]);
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}
