"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AttributionControl, Map, Marker, NavigationControl, setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { version } from "maplibre-gl/package.json";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { lastRadarFrames, minutesSinceNewest } from "@/lib/radar/frames";
import type { RadarFrame, RadarManifest } from "@/lib/radar/types";
import type { WindGrid } from "@/lib/wind/grid";
import { renderPrecipImage, type PrecipImage } from "@/lib/precip/render";
import { buildTimeline, defaultIndex, nextPlayIndex, segmentShares, stopLabelKey } from "@/lib/timeline/frames";
import { placeSeries, placeSeriesSummary } from "@/lib/timeline/place-series";
import { levelToRgba } from "@/lib/nowcast/intensity";
import { currentHourIndex, windMotion } from "@/lib/wind/particles";
import { stormsToGeoJSON, type StormCollection } from "@/lib/storms/geojson";
import type { Storm } from "@/lib/storms/normalize";
import type { Quake } from "@/lib/quakes/usgs";
import { HILLSHADE_LAYER, TERRAIN_ATTRIBUTION, TERRAIN_SOURCE, terrainAvailable, terrainCamera, terrainSource } from "@/lib/map/terrain";
import { NEON, rainLegendGradient } from "@/lib/map/neon-palette";
import { neonStyle } from "@/lib/map/neon-style";
import { HOLOGRAM_URL, hologramCoordinates, hologramOpacity } from "@/lib/map/hologram";
import { WindCanvas } from "./wind-canvas";
import { useRadarSummary } from "./use-radar-summary";
import { bearingWord } from "@/lib/storms/present";

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
const radarId = (index: number) => `rain-radar-${index}`;
const modelId = (index: number) => `model-rain-${index}`;
type ModelRainImage = { url: string; coordinates: PrecipImage["coordinates"] };
const STORM_SOURCE = "storms";
const STORM_LAYERS = ["storm-cone", "storm-track-glow", "storm-track", "storm-forecast-glow", "storm-forecast", "storm-center", "storm-label"] as const;
const emptyStorms: StormCollection = { type: "FeatureCollection", features: [] };
const QUAKE_SOURCE = "quakes";
const HOLOGRAM_SOURCE = "hologram";
const HOLOGRAM_LAYER = "neon-hologram";
type QuakeCollection = { type: "FeatureCollection"; features: { type: "Feature"; properties: { mag: number; label: string }; geometry: { type: "Point"; coordinates: [number, number] } }[] };
const emptyQuakes: QuakeCollection = { type: "FeatureCollection", features: [] };
const quakesToGeoJSON = (quakes: Quake[]): QuakeCollection => ({ type: "FeatureCollection", features: quakes.map((q) => ({ type: "Feature", properties: { mag: q.mag, label: `M${q.mag.toFixed(1)}` }, geometry: { type: "Point", coordinates: [q.lon, q.lat] } })) });

function initialControlOpen(key: string): boolean {
  try {
    const saved = localStorage.getItem(key);
    if (saved !== null) return saved === "true";
  } catch { /* Private browsing can deny storage. */ }
  return !window.matchMedia("(max-width: 640px)").matches;
}

function rememberControlOpen(key: string, open: boolean): void {
  try { localStorage.setItem(key, String(open)); } catch { /* Keep the control usable without storage. */ }
}

export function MapView() {
  const { place } = useLastPlace();
  const t = useT();
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [manifest, setManifest] = useState<RadarManifest | null>(null);
  const [radarOn, setRadarOn] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layersOpen, setLayersOpen] = useState(() => initialControlOpen("fah-map-layers-open"));
  const [panelOpen, setPanelOpen] = useState(() => initialControlOpen("fah-map-panel-open"));
  const [reducedMotion, setReducedMotion] = useState(false);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [wind, setWind] = useState<WindGrid | null>(null);
  const frames = useMemo(() => lastRadarFrames(manifest?.provider === "rainviewer" ? manifest.frames : []), [manifest]);
  const modelImages = useMemo(() => {
    if (!wind?.precipHours || !wind.precip || !wind.prob) return [] as (ModelRainImage | null)[];
    const images = wind.precipHours.slice(0, 12).map((_, index) => {
      const image = renderPrecipImage(wind, index);
      if (!image) return null;
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      const pixels = context.createImageData(image.width, image.height);
      pixels.data.set(image.data);
      context.putImageData(pixels, 0, 0);
      return { url: canvas.toDataURL(), coordinates: image.coordinates };
    });
    return images.every(Boolean) ? images : [];
  }, [wind]);
  const modelHours = useMemo(() => modelImages.length ? wind?.precipHours?.slice(0, modelImages.length) ?? [] : [], [modelImages, wind]);
  const stops = useMemo(() => buildTimeline(frames.map((frame) => frame.time), modelHours, nowIso), [frames, modelHours, nowIso]);
  const available = stops.length > 0;
  const activeStop = stops[Math.min(activeIndex, stops.length - 1)];
  const shares = segmentShares(stops);
  const activeTimeLabel = activeStop?.kind === "model"
    ? t("+{n} ชม. · {time} น.", { n: Math.max(0, Math.ceil((Date.parse(activeStop.time) - Date.parse(nowIso)) / 3_600_000)), time: formatTime(activeStop.time, "Asia/Bangkok", t.locale) })
    : activeStop ? t("{time} น.", { time: formatTime(activeStop.time, "Asia/Bangkok", t.locale) }) : "";
  // Always the newest frame: "where is the rain now", independent of the scrubber.
  const radarSummary = useRadarSummary(frames.at(-1), place.lon, place.lat);
  const series = useMemo(() => wind ? placeSeries(wind, stops, place, radarSummary ?? undefined) : [], [wind, stops, place, radarSummary]);
  const seriesSummary = placeSeriesSummary(series, nowIso);
  const [mapStyle, setMapStyle] = useState<StyleSpecification | string | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [windOn, setWindOn] = useState(true);
  const [device] = useState(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    return { saveData: nav.connection?.saveData ?? false, deviceMemory: nav.deviceMemory };
  });
  const motion = windMotion({ reducedMotion, ...device });
  const windHour = wind ? currentHourIndex(wind.hours, nowIso) : 0;
  const terrainOk = terrainAvailable(device.deviceMemory);
  const [terrainOn, setTerrainOn] = useState(false);
  const terrainState = useRef(false);
  const [storms, setStorms] = useState<Storm[]>([]);
  const [stormsOn, setStormsOn] = useState(true);
  const stormState = useRef<StormCollection>(emptyStorms);
  const syncStorms = useRef<() => void>(() => {});
  const [quakes, setQuakes] = useState<Quake[]>([]);
  const [quakesOn, setQuakesOn] = useState(true);
  const quakeState = useRef<QuakeCollection>(emptyQuakes);
  const syncQuakes = useRef<() => void>(() => {});
  const syncTerrain = useRef<() => void>(() => {});
  const radarState = useRef({ frames: [] as RadarFrame[], maxZoom: 7, activeIndex: 0, enabled: true });
  const syncRadar = useRef<() => void>(() => {});
  const modelState = useRef({ images: [] as (ModelRainImage | null)[], activeIndex: -1, enabled: true });
  const syncModel = useRef<() => void>(() => {});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/radar", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("radar unavailable"); return response.json() as Promise<RadarManifest>; })
      .then((data) => {
        setManifest(data);
        const radarTimes = lastRadarFrames(data.provider === "rainviewer" ? data.frames : []).map((frame) => frame.time);
        setActiveIndex(defaultIndex(buildTimeline(radarTimes, [], new Date().toISOString())));
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

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(query.matches); if (query.matches) setPlaying(false); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowIso(new Date().toISOString()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion || !frames.length || !radarOn) return;
    const timer = window.setTimeout(() => setActiveIndex((index) => nextPlayIndex(stops, index)),
      activeStop?.kind === "radar" && activeStop.index === frames.length - 1 ? 1500 : 600);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, radarOn, frames.length, activeIndex, activeStop, stops]);

  useEffect(() => {
    radarState.current = { frames, maxZoom: manifest?.maxZoom ?? 7, activeIndex: activeStop?.kind === "radar" ? activeStop.index : -1, enabled: radarOn };
    syncRadar.current();
    modelState.current = { images: modelImages, activeIndex: activeStop?.kind === "model" ? activeStop.index : -1, enabled: radarOn };
    syncModel.current();
  }, [frames, manifest, activeStop, radarOn, modelImages]);

  useEffect(() => {
    stormState.current = stormsOn ? stormsToGeoJSON(storms) : emptyStorms;
    syncStorms.current();
  }, [storms, stormsOn]);

  useEffect(() => {
    quakeState.current = quakesOn ? quakesToGeoJSON(quakes) : emptyQuakes;
    syncQuakes.current();
  }, [quakes, quakesOn]);

  useEffect(() => {
    terrainState.current = terrainOn;
    syncTerrain.current();
    mapInstance?.easeTo({ ...terrainCamera(terrainOn, reducedMotion), bearing: terrainOn ? mapInstance.getBearing() : 0 });
  }, [terrainOn, mapInstance, reducedMotion]);

  useEffect(() => {
    let active = true;
    loadNeonStyle().catch(() => DARK_STYLE_URL).then((style) => {
      if (active) setMapStyle(style);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!container.current || !mapStyle) return;
    let map: Map | undefined;
    let marker: Marker | undefined;
    let waitingForStyle = true;
    try {
      map = new Map({
        container: container.current,
        style: mapStyle,
        center: [place.lon, place.lat],
        zoom: 6,
        minZoom: 3,
        maxZoom: 12,
        maxPitch: 60,
        maxBounds: [[80, -5], [130, 30]],
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 100,
        attributionControl: false,
      });
      const liveMap = map;
      liveMap.addControl(new NavigationControl(), "top-right");
      liveMap.addControl(new AttributionControl({ compact: true, customAttribution: [
        '<a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">Weather data by RainViewer</a>',
        '<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Wind: Open-Meteo.com (CC BY 4.0)</a>',
        TERRAIN_ATTRIBUTION,
        '<a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer">Earthquakes: USGS</a>',
      ] }), "bottom-right");
      const attribution = liveMap.getContainer().querySelector(".maplibregl-ctrl-attrib");
      attribution?.classList.remove("maplibregl-compact-show");
      attribution?.removeAttribute("open");
      const removeRadar = () => {
        for (let index = 0; index < 6; index++) {
          const id = radarId(index);
          if (liveMap.getLayer(id)) liveMap.removeLayer(id);
          if (liveMap.getSource(id)) liveMap.removeSource(id);
        }
      };
      let firstIdle = false;
      const applyHologram = () => {
        if (device.saveData || !firstIdle || !liveMap.isStyleLoaded()) return;
        const layers = liveMap.getStyle().layers;
        const waterIndex = layers.findIndex((layer) => layer.id === "water" && layer.type === "fill");
        if (waterIndex < 0) return;
        if (!liveMap.getSource(HOLOGRAM_SOURCE)) liveMap.addSource(HOLOGRAM_SOURCE, { type: "image", url: HOLOGRAM_URL, coordinates: hologramCoordinates() });
        if (!liveMap.getLayer(HOLOGRAM_LAYER)) liveMap.addLayer({
          id: HOLOGRAM_LAYER, type: "raster", source: HOLOGRAM_SOURCE,
          paint: { "raster-opacity": hologramOpacity() as ["interpolate", ["linear"], ["zoom"], number, number, number, number], "raster-resampling": "linear", "raster-fade-duration": 0 },
        }, layers[waterIndex + 1]?.id);
      };
      const onHologramIdle = () => {
        firstIdle = true;
        applyHologram();
      };
      const removeHologram = () => {
        if (liveMap.getLayer(HOLOGRAM_LAYER)) liveMap.removeLayer(HOLOGRAM_LAYER);
        if (liveMap.getSource(HOLOGRAM_SOURCE)) liveMap.removeSource(HOLOGRAM_SOURCE);
      };
      const addRadar = () => {
        if (!liveMap.isStyleLoaded()) return;
        const { frames, maxZoom, activeIndex, enabled } = radarState.current;
        const firstSymbol = liveMap.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
        frames.forEach((frame, index) => {
          const id = radarId(index);
          if (!liveMap.getSource(id)) liveMap.addSource(id, { type: "raster", tiles: [frame.tileUrl], tileSize: 256, maxzoom: maxZoom });
          if (!liveMap.getLayer(id)) liveMap.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0 }, "raster-saturation": 0.35, "raster-contrast": 0.15, "raster-resampling": "linear" } }, firstSymbol);
          const opacity = enabled && index === activeIndex ? 0.7 : 0;
          if (liveMap.getPaintProperty(id, "raster-opacity") !== opacity) liveMap.setPaintProperty(id, "raster-opacity", opacity);
        });
      };
      syncRadar.current = addRadar;
      const removeModel = () => {
        for (let index = 0; index < 12; index++) {
          const id = modelId(index);
          if (liveMap.getLayer(id)) liveMap.removeLayer(id);
          if (liveMap.getSource(id)) liveMap.removeSource(id);
        }
      };
      const applyModel = () => {
        if (!liveMap.isStyleLoaded()) return;
        const { images, activeIndex, enabled } = modelState.current;
        const firstSymbol = liveMap.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
        images.forEach((image, index) => {
          if (!image) return;
          const id = modelId(index);
          if (!liveMap.getSource(id)) liveMap.addSource(id, { type: "image", url: image.url, coordinates: image.coordinates });
          if (!liveMap.getLayer(id)) liveMap.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0 } } }, firstSymbol);
          const opacity = enabled && index === activeIndex ? 1 : 0;
          if (liveMap.getPaintProperty(id, "raster-opacity") !== opacity) liveMap.setPaintProperty(id, "raster-opacity", opacity);
        });
      };
      syncModel.current = applyModel;
      const applyTerrain = () => {
        if (!liveMap.isStyleLoaded()) return;
        // Also runs on "idle" (see applyStorms); skip when already in the wanted state.
        if (terrainState.current === Boolean(liveMap.getTerrain())) return;
        if (terrainState.current) {
          if (!liveMap.getSource(TERRAIN_SOURCE)) liveMap.addSource(TERRAIN_SOURCE, terrainSource);
          if (!liveMap.getLayer(HILLSHADE_LAYER)) {
            const firstSymbol = liveMap.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
            liveMap.addLayer({ id: HILLSHADE_LAYER, type: "hillshade", source: TERRAIN_SOURCE, paint: { "hillshade-exaggeration": 0.35 } }, firstSymbol);
          }
          liveMap.setTerrain({ source: TERRAIN_SOURCE, exaggeration: 1.3 });
        } else {
          if (liveMap.getTerrain()) liveMap.setTerrain(null);
          if (liveMap.getLayer(HILLSHADE_LAYER)) liveMap.removeLayer(HILLSHADE_LAYER);
        }
      };
      syncTerrain.current = applyTerrain;
      // isStyleLoaded() stays false until every source (e.g. radar tiles) has loaded, so this
      // also runs on "idle"; `applied` keeps it from re-setting the same data every frame.
      let applied: StormCollection | null = null;
      const applyStorms = () => {
        const data = stormState.current;
        if (data === applied || !liveMap.isStyleLoaded()) return;
        applied = data;
        const source = liveMap.getSource(STORM_SOURCE);
        if (source && "setData" in source) { (source as { setData: (d: StormCollection) => void }).setData(data); return; }
        if (data.features.length === 0) return;
        liveMap.addSource(STORM_SOURCE, { type: "geojson", data });
        liveMap.addLayer({ id: "storm-cone", type: "fill", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "cone"], paint: { "fill-color": NEON.accent, "fill-opacity": 0.12 } });
        liveMap.addLayer({ id: "storm-track-glow", type: "line", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "track"], paint: { "line-color": NEON.accent, "line-width": 11, "line-blur": 7, "line-opacity": 0.7 } });
        liveMap.addLayer({ id: "storm-track", type: "line", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "track"], paint: { "line-color": NEON.accent, "line-width": 2.5 } });
        liveMap.addLayer({ id: "storm-forecast-glow", type: "line", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "forecast"], paint: { "line-color": NEON.accent, "line-width": 9, "line-blur": 6, "line-opacity": 0.6 } });
        liveMap.addLayer({ id: "storm-forecast", type: "line", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "forecast"], paint: { "line-color": NEON.accent, "line-width": 2, "line-dasharray": [2, 2] } });
        liveMap.addLayer({ id: "storm-center", type: "circle", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "center"], paint: { "circle-radius": 8, "circle-color": NEON.accent, "circle-stroke-width": 3, "circle-stroke-color": NEON.label } });
        liveMap.addLayer({ id: "storm-label", type: "symbol", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "center"], layout: { "text-field": ["get", "name"], "text-offset": [0, 1.4], "text-size": 13, "text-font": ["Noto Sans Regular"] }, paint: { "text-color": NEON.accent, "text-halo-color": NEON.halo, "text-halo-width": 1.5 } });
      };
      const removeStorms = () => {
        applied = null;
        for (const id of STORM_LAYERS) if (liveMap.getLayer(id)) liveMap.removeLayer(id);
        if (liveMap.getSource(STORM_SOURCE)) liveMap.removeSource(STORM_SOURCE);
      };
      syncStorms.current = applyStorms;
      let quakesApplied: QuakeCollection | null = null;
      const applyQuakes = () => {
        const data = quakeState.current;
        if (data === quakesApplied || !liveMap.isStyleLoaded()) return;
        quakesApplied = data;
        const source = liveMap.getSource(QUAKE_SOURCE);
        if (source && "setData" in source) { (source as { setData: (d: QuakeCollection) => void }).setData(data); return; }
        if (data.features.length === 0) return;
        liveMap.addSource(QUAKE_SOURCE, { type: "geojson", data });
        liveMap.addLayer({ id: "quake-circle", type: "circle", source: QUAKE_SOURCE, paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "mag"], 4, 5, 6, 12, 7.5, 20],
          "circle-color": NEON.quake, "circle-blur": 0.45,
          "circle-opacity": 0.8, "circle-stroke-width": 1.5, "circle-stroke-color": NEON.quake,
        } });
        liveMap.addLayer({ id: "quake-label", type: "symbol", source: QUAKE_SOURCE, filter: [">=", ["get", "mag"], 5],
          layout: { "text-field": ["get", "label"], "text-offset": [0, 1.3], "text-size": 12, "text-font": ["Noto Sans Regular"] },
          paint: { "text-color": NEON.quake, "text-halo-color": NEON.halo, "text-halo-width": 1.5 } });
      };
      const removeQuakes = () => {
        quakesApplied = null;
        for (const id of ["quake-circle", "quake-label"]) if (liveMap.getLayer(id)) liveMap.removeLayer(id);
        if (liveMap.getSource(QUAKE_SOURCE)) liveMap.removeSource(QUAKE_SOURCE);
      };
      syncQuakes.current = applyQuakes;
      liveMap.on("style.load", applyQuakes);
      liveMap.on("idle", applyQuakes);
      liveMap.on("style.load", applyStorms);
      liveMap.on("idle", applyStorms);
      liveMap.on("style.load", applyTerrain);
      liveMap.on("idle", applyTerrain);
      liveMap.on("style.load", addRadar);
      liveMap.on("idle", addRadar);
      liveMap.on("style.load", applyModel);
      liveMap.on("idle", applyModel);
      liveMap.on("style.load", applyHologram);
      liveMap.on("idle", onHologramIdle);
      const pin = document.createElement("div");
      pin.setAttribute("role", "img");
      pin.setAttribute("aria-label", placeName);
      pin.className = "neon-pin";
      pin.innerHTML = '<span class="neon-pulse"></span><span class="neon-sweep"></span><span class="neon-core"></span>';
      marker = new Marker({ element: pin }).setLngLat([place.lon, place.lat]).addTo(liveMap);

      liveMap.once("load", () => setMapInstance(liveMap));
      liveMap.on("idle", () => {
        if (waitingForStyle) {
          waitingForStyle = false;
          setStatus("ready");
        }
      });
      liveMap.on("error", () => {
        if (waitingForStyle) {
          waitingForStyle = false;
          setStatus("error");
        }
      });

      return () => {
        setMapInstance(null);
        syncRadar.current = () => {};
        syncModel.current = () => {};
        syncTerrain.current = () => {};
        syncStorms.current = () => {};
        syncQuakes.current = () => {};
        liveMap.off("style.load", applyQuakes);
        liveMap.off("idle", applyQuakes);
        removeQuakes();
        liveMap.off("style.load", applyStorms);
        liveMap.off("idle", applyStorms);
        removeStorms();
        liveMap.off("style.load", applyTerrain);
        liveMap.off("idle", applyTerrain);
        liveMap.off("style.load", addRadar);
        liveMap.off("idle", addRadar);
        removeRadar();
        liveMap.off("style.load", applyModel);
        liveMap.off("idle", applyModel);
        removeModel();
        liveMap.off("style.load", applyHologram);
        liveMap.off("idle", onHologramIdle);
        removeHologram();
        marker?.remove();
        liveMap.remove();
      };
    } catch {
      marker?.remove();
      map?.remove();
      const timer = window.setTimeout(() => setStatus("error"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [place.lon, place.lat, placeName, attempt, mapStyle, device.saveData]);

  return (
    <main className="neon-map mx-auto flex h-[calc(100dvh-73px-env(safe-area-inset-bottom))] max-w-3xl flex-col overflow-hidden"
      style={{ "--neon-bg": NEON.bg, "--neon-label": NEON.label, "--neon-muted": NEON.labelMuted, "--neon-pin": NEON.pin } as React.CSSProperties}>
      <header className="shrink-0 px-5 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <h1 className="text-lg">{t("แผนที่")} · {placeName}</h1>
      </header>
      <div className="relative min-h-0 flex-1" style={{ backgroundColor: NEON.bg }}>
        <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
        <div className="absolute left-3 top-3 z-10" style={{ maxWidth: "calc(100% - 5rem)" }}>
          <button type="button" aria-expanded={layersOpen} aria-controls="map-layer-chips"
            aria-label={layersOpen ? t("ซ่อนชั้นข้อมูล") : t("ชั้นข้อมูล")}
            onClick={() => { const open = !layersOpen; setLayersOpen(open); rememberControlOpen("fah-map-layers-open", open); }}
            className="neon-glass neon-toggle grid size-10 place-items-center rounded-full text-lg">
            <span aria-hidden="true">{layersOpen ? "✕" : "☰"}</span>
          </button>
          <div id="map-layer-chips" hidden={!layersOpen} className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!available} aria-pressed={available && radarOn}
              onClick={() => { setRadarOn((on) => !on); setPlaying(false); }}
              className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-60">
              {available ? t("เรดาร์ฝน") : t("เรดาร์ไม่พร้อมใช้งาน")}
            </button>
            <button type="button" disabled={!wind} aria-pressed={Boolean(wind) && windOn}
              onClick={() => setWindOn((on) => !on)}
              className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-60">
              {wind ? t("ลม") : t("ข้อมูลลมไม่พร้อมใช้งาน")}
            </button>
            {storms.length > 0 && (
              <button type="button" aria-pressed={stormsOn} onClick={() => setStormsOn((on) => !on)}
                className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold">
                {t("พายุ")} ({storms.length})
              </button>
            )}
            {quakes.length > 0 && (
              <button type="button" aria-pressed={quakesOn} onClick={() => setQuakesOn((on) => !on)}
                className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold">
                {t("แผ่นดินไหว")} ({quakes.length})
              </button>
            )}
            {terrainOk && (
              <button type="button" aria-pressed={terrainOn} onClick={() => setTerrainOn((on) => !on)}
                aria-label={terrainOn ? t("ปิดแผนที่ 3 มิติ") : t("เปิดแผนที่ 3 มิติ")}
                className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold">
                3D
              </button>
            )}
          </div>
        </div>
        {mapInstance && wind && windOn && status === "ready" && (
          <WindCanvas map={mapInstance} grid={wind} hourIndex={windHour} animate={motion.animate} count={motion.count} />
        )}
        {available && radarOn && (
          <div className={`neon-glass absolute z-10 rounded-2xl p-3 ${panelOpen ? "inset-x-3 bottom-[4.5rem] mx-auto max-w-md" : "bottom-3 left-3"}`}
            style={!panelOpen ? { maxWidth: "calc(100% - 1.5rem)" } : undefined}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPlaying((value) => !value)} disabled={reducedMotion || !frames.length}
                aria-label={playing ? t("หยุดภาพเรดาร์") : t("เล่นภาพเรดาร์")}
                className="neon-play grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-50">
                {playing ? "Ⅱ" : "▶"}
              </button>
              {!panelOpen && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{activeTimeLabel}</span>}
              <button type="button" aria-expanded={panelOpen} aria-controls="map-timeline-details"
                aria-label={panelOpen ? t("ย่อแผงเวลา") : t("ขยายแผงเวลา")}
                onClick={() => { const open = !panelOpen; setPanelOpen(open); rememberControlOpen("fah-map-panel-open", open); }}
                className="neon-toggle order-last grid size-9 shrink-0 place-items-center rounded-full text-lg">
                <span aria-hidden="true">{panelOpen ? "⌄" : "⌃"}</span>
              </button>
              {panelOpen && <>
                <div className="min-w-0 flex-1">
                  <input type="range" min={0} max={stops.length - 1} value={Math.min(activeIndex, stops.length - 1)}
                    onChange={(event) => { setPlaying(false); setActiveIndex(Number(event.target.value)); }}
                    aria-label={t("เวลาฝน")}
                    aria-valuetext={activeStop ? `${t(stopLabelKey(activeStop))} · ${activeTimeLabel}` : ""}
                    className="neon-range w-full" />
                  <div className="mt-1 flex h-1 w-full overflow-hidden rounded-full" aria-hidden="true">
                    <span style={{ width: `${shares.radar * 100}%`, backgroundColor: NEON.pin }} />
                    <span style={{ width: `${shares.model * 100}%`, backgroundColor: NEON.accent, opacity: 0.6 }} />
                  </div>
                </div>
                <span className="w-32 shrink-0 text-right text-sm font-semibold max-[400px]:w-24">
                  {activeTimeLabel}
                  {activeStop && <small className="neon-muted block text-xs font-normal">{t(stopLabelKey(activeStop))}</small>}
                </span>
              </>}
            </div>
            <div id="map-timeline-details" hidden={!panelOpen}>
              {radarSummary && (
                <p className="mt-2 text-sm font-semibold" aria-live="polite">
                  {radarSummary.overhead ? t("ตอนนี้ฝนตกอยู่ตรงตำแหน่งของคุณ")
                    : radarSummary.nearestKm !== undefined
                      ? t("ฝนใกล้สุดห่าง ~{km} กม. ทางทิศ{dir}", { km: radarSummary.nearestKm, dir: bearingWord(radarSummary.bearingDeg ?? 0, t) })
                      : t("ไม่มีฝนในรัศมี 100 กม.")}
                  {radarSummary.heavyNearby && <span className="ml-1" style={{ color: NEON.accent }}>· {t("มีฝนหนักใกล้คุณ")}</span>}
                </p>
              )}
              {series.length > 0 && (
                <section className="mt-3" aria-label={t("ฝนที่ตำแหน่งคุณ: {summary}", { summary: t(seriesSummary.key, seriesSummary.params) })}>
                  <h2 className="text-xs font-semibold">{t("ฝนที่ตำแหน่งคุณ")}</h2>
                  <div className="mt-1 flex min-w-0 gap-0.5 pb-1">
                    {series.map((item) => {
                      const index = stops.findIndex((stop) => stop.kind === item.kind && stop.time === item.time);
                      const label = item.kind === "radar" ? t("ตอนนี้") : formatTime(item.time, "Asia/Bangkok", t.locale).slice(0, 2);
                      const [r, g, b] = levelToRgba(item.level);
                      return (
                        <button key={`${item.kind}-${item.time}`} type="button" onClick={() => { setPlaying(false); setActiveIndex(index); }}
                          aria-label={t("{time}: {rain}", { time: label, rain: t(item.level ? "มีฝน" : "ไม่มีฝน") })}
                          aria-pressed={activeIndex === index}
                          className="neon-series-item flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md py-1 text-[10px] focus-visible:outline-2">
                          <span className="flex h-7 w-2 items-end rounded-sm bg-white/10" aria-hidden="true">
                            {item.level > 0 && <span className="w-full rounded-sm" style={{ height: `${item.level * 25}%`, backgroundColor: `rgb(${r} ${g} ${b})` }} />}
                          </span>
                          <span className="whitespace-nowrap text-center leading-tight">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="neon-muted text-center text-[10px]">{t("เวลา (น.)")}</p>
                </section>
              )}
              <div className="neon-muted mt-2 flex items-center justify-between gap-3 text-xs">
                <span>{t("ฝนเบา → ฝนหนัก")}</span>
                {frames.length > 0 && <span>{t("อัปเดตเมื่อ {n} นาทีที่แล้ว", { n: minutesSinceNewest(frames, nowIso) })}</span>}
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: rainLegendGradient() }} aria-hidden="true" />
            </div>
          </div>
        )}
        {status !== "ready" && (
          <div className="absolute inset-0 z-10 grid place-items-center" style={{ backgroundColor: NEON.bg, color: NEON.label }} role="status">
            {status === "error" ? (
              <div className="text-center">
                <p>{t("โหลดแผนที่ไม่สำเร็จ")}</p>
                <button type="button" className="install-action mt-3" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>{t("ลองใหม่")}</button>
              </div>
            ) : t("กำลังโหลดแผนที่…")}
          </div>
        )}
      </div>
    </main>
  );
}
