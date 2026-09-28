"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AttributionControl, Map, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { version } from "maplibre-gl/package.json";
import { STYLE_URLS, type BaseTheme } from "@/lib/map/base-style";
import { TERRAIN_ATTRIBUTION } from "@/lib/map/terrain";
import { loadBaseStyle, useAppMapTheme } from "./use-base-style";

// Turbopack does not emit the worker/shared modules v6 loads via import.meta.url; they are copied
// to public/vendor by scripts/copy-maplibre-worker.mjs.
setWorkerUrl(`/vendor/maplibre/${version}/maplibre-gl-worker.mjs`);

export type MapStatus = "loading" | "ready" | "error";

interface MapContextValue {
  map: Map | null;
  theme: BaseTheme;
  status: MapStatus;
  retry: () => void;
}

const MapContext = createContext<MapContextValue>({ map: null, theme: "dark", status: "loading", retry: () => {} });

export function useMapContext(): MapContextValue {
  return useContext(MapContext);
}

/**
 * Owns the single MapLibre instance for the map page. The map is created once per mount (and
 * again only on retry): it never depends on the place or the language, so changing either moves
 * the view or relabels instead of rebuilding every layer.
 */
export function MapProvider({ containerRef, initialCenter, initialZoom = 6, children }: {
  containerRef: RefObject<HTMLDivElement | null>;
  /** Read once when the map is created. */
  initialCenter: [number, number];
  initialZoom?: number;
  children: ReactNode;
}) {
  const [center] = useState(initialCenter);
  const [zoom] = useState(initialZoom);
  const appTheme = useAppMapTheme();
  const [initialStyle, setInitialStyle] = useState<{ style: StyleSpecification | string; theme: BaseTheme } | null>(null);
  const [map, setMap] = useState<Map | null>(null);
  const [theme, setTheme] = useState<BaseTheme>("dark");
  const activeTheme = useRef<BaseTheme>("dark");
  const [status, setStatus] = useState<MapStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initialStyle) return;
    let active = true;
    loadBaseStyle(appTheme).catch(() => STYLE_URLS[appTheme]).then((loaded) => {
      if (active) {
        setTheme(appTheme);
        setInitialStyle({ style: loaded, theme: appTheme });
      }
    });
    return () => { active = false; };
  }, [appTheme, initialStyle]);

  useEffect(() => {
    if (!containerRef.current || !initialStyle) return;
    let created: Map | undefined;
    let waitingForLoad = true;
    try {
      created = new Map({
        container: containerRef.current,
        style: initialStyle.style,
        center,
        zoom,
        minZoom: 3,
        maxZoom: 12,
        maxPitch: 60,
        maxBounds: [[80, -5], [130, 30]],
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 100,
        attributionControl: false,
      });
      const live = created;
      activeTheme.current = initialStyle.theme;
      live.addControl(new NavigationControl(), "bottom-right");
      live.addControl(new AttributionControl({ compact: true, customAttribution: [
        '<a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">Weather data by RainViewer</a>',
        '<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Wind: Open-Meteo.com (CC BY 4.0)</a>',
        '<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Air quality: Open-Meteo.com (CAMS, CC BY 4.0)</a>',
        TERRAIN_ATTRIBUTION,
        '<a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">Earthquakes: USGS</a>',
      ] }), "bottom-right");
      // Start collapsed on every screen size: expanded credits cover the map.
      const attribution = live.getContainer().querySelector(".maplibregl-ctrl-attrib");
      attribution?.classList.remove("maplibregl-compact-show");
      attribution?.removeAttribute("open");

      live.once("load", () => {
        waitingForLoad = false;
        setMap(live);
        setStatus("ready");
      });
      live.on("error", (event) => {
        if (waitingForLoad && !("sourceId" in event) && !("tile" in event)) setStatus("error");
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
  }, [containerRef, initialStyle, center, zoom, attempt]);

  useEffect(() => {
    if (!map || appTheme === activeTheme.current) return;
    let active = true;
    loadBaseStyle(appTheme).then((loaded) => {
      if (!active) return;
      map.setStyle(loaded, { diff: false });
      activeTheme.current = appTheme;
      setTheme(appTheme);
    }).catch(() => { /* Keep the current style when the next theme is unavailable. */ });
    return () => { active = false; };
  }, [map, appTheme]);

  const retry = useCallback(() => {
    setStatus("loading");
    setTheme(initialStyle?.theme ?? "dark");
    setAttempt((value) => value + 1);
  }, [initialStyle]);

  const value = useMemo(() => ({ map, theme, status, retry }), [map, theme, status, retry]);
  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
}
