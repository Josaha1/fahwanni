"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AttributionControl, Map, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { version } from "maplibre-gl/package.json";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { lastRadarFrames, minutesSinceNewest, nextFrameIndex } from "@/lib/radar/frames";
import type { RadarFrame, RadarManifest } from "@/lib/radar/types";
import type { WindGrid } from "@/lib/wind/grid";
import { currentHourIndex, windMotion } from "@/lib/wind/particles";
import { stormsToGeoJSON, type StormCollection } from "@/lib/storms/geojson";
import type { Storm } from "@/lib/storms/normalize";
import { HILLSHADE_LAYER, TERRAIN_ATTRIBUTION, TERRAIN_SOURCE, terrainAvailable, terrainCamera, terrainSource } from "@/lib/map/terrain";
import { WindCanvas } from "./wind-canvas";

setWorkerUrl(`/vendor/maplibre/${version}/maplibre-gl-worker.mjs`);

const styles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const radarId = (index: number) => `rain-radar-${index}`;
const STORM_SOURCE = "storms";
const STORM_LAYERS = ["storm-cone", "storm-track", "storm-forecast", "storm-center", "storm-label"] as const;
const emptyStorms: StormCollection = { type: "FeatureCollection", features: [] };

function currentStyle() {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" || theme === "night" ? styles.dark : styles.light;
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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const frames = useMemo(() => lastRadarFrames(manifest?.provider === "rainviewer" ? manifest.frames : []), [manifest]);
  const available = frames.length > 0;
  const activeFrame = frames[Math.min(activeIndex, frames.length - 1)];
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [wind, setWind] = useState<WindGrid | null>(null);
  const [windOn, setWindOn] = useState(true);
  const [dark, setDark] = useState(() => currentStyle() === styles.dark);
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
  const syncTerrain = useRef<() => void>(() => {});
  const radarState = useRef({ frames: [] as RadarFrame[], maxZoom: 7, activeIndex: 0, enabled: true });
  const syncRadar = useRef<() => void>(() => {});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/radar", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("radar unavailable"); return response.json() as Promise<RadarManifest>; })
      .then((data) => { setManifest(data); setActiveIndex(Math.max(0, lastRadarFrames(data.frames).length - 1)); })
      .catch(() => { if (!controller.signal.aborted) setManifest(null); });
    fetch("/api/wind", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("wind unavailable"); return response.json() as Promise<WindGrid>; })
      .then(setWind)
      .catch(() => { if (!controller.signal.aborted) setWind(null); });
    fetch("/api/storms", { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ storms?: Storm[] }> : { storms: [] })
      .then((data) => setStorms(data.storms ?? []))
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
    if (!playing || reducedMotion || !available || !radarOn) return;
    const timer = window.setTimeout(() => setActiveIndex((index) => nextFrameIndex(index, frames.length)),
      activeIndex === frames.length - 1 ? 1500 : 600);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, available, radarOn, frames.length, activeIndex]);

  useEffect(() => {
    radarState.current = { frames, maxZoom: manifest?.maxZoom ?? 7, activeIndex, enabled: radarOn && available };
    syncRadar.current();
  }, [frames, manifest, activeIndex, radarOn, available]);

  useEffect(() => {
    stormState.current = stormsOn ? stormsToGeoJSON(storms) : emptyStorms;
    syncStorms.current();
  }, [storms, stormsOn]);

  useEffect(() => {
    terrainState.current = terrainOn;
    syncTerrain.current();
    mapInstance?.easeTo({ ...terrainCamera(terrainOn, reducedMotion), bearing: terrainOn ? mapInstance.getBearing() : 0 });
  }, [terrainOn, mapInstance, reducedMotion]);

  useEffect(() => {
    if (!container.current) return;
    let map: Map | undefined;
    let marker: Marker | undefined;
    let waitingForStyle = true;
    try {
      map = new Map({
        container: container.current,
        style: currentStyle(),
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
      ] }), "bottom-right");
      const removeRadar = () => {
        for (let index = 0; index < 6; index++) {
          const id = radarId(index);
          if (liveMap.getLayer(id)) liveMap.removeLayer(id);
          if (liveMap.getSource(id)) liveMap.removeSource(id);
        }
      };
      const addRadar = () => {
        if (!liveMap.isStyleLoaded()) return;
        const { frames, maxZoom, activeIndex, enabled } = radarState.current;
        const firstSymbol = liveMap.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
        frames.forEach((frame, index) => {
          const id = radarId(index);
          if (!liveMap.getSource(id)) liveMap.addSource(id, { type: "raster", tiles: [frame.tileUrl], tileSize: 256, maxzoom: maxZoom });
          if (!liveMap.getLayer(id)) liveMap.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: 0 } } }, firstSymbol);
          const opacity = enabled && index === activeIndex ? 0.7 : 0;
          if (liveMap.getPaintProperty(id, "raster-opacity") !== opacity) liveMap.setPaintProperty(id, "raster-opacity", opacity);
        });
      };
      syncRadar.current = addRadar;
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
        const red = "#d9483b";
        liveMap.addLayer({ id: "storm-cone", type: "fill", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "cone"], paint: { "fill-color": red, "fill-opacity": 0.12 } });
        liveMap.addLayer({ id: "storm-track", type: "line", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "track"], paint: { "line-color": red, "line-width": 2.5 } });
        liveMap.addLayer({ id: "storm-forecast", type: "line", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "forecast"], paint: { "line-color": red, "line-width": 2, "line-dasharray": [2, 2] } });
        liveMap.addLayer({ id: "storm-center", type: "circle", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "center"], paint: { "circle-radius": 8, "circle-color": red, "circle-stroke-width": 3, "circle-stroke-color": "#ffffff" } });
        liveMap.addLayer({ id: "storm-label", type: "symbol", source: STORM_SOURCE, filter: ["==", ["get", "kind"], "center"], layout: { "text-field": ["get", "name"], "text-offset": [0, 1.4], "text-size": 13, "text-font": ["Noto Sans Regular"] }, paint: { "text-color": red, "text-halo-color": "#ffffff", "text-halo-width": 1.5 } });
      };
      const removeStorms = () => {
        applied = null;
        for (const id of STORM_LAYERS) if (liveMap.getLayer(id)) liveMap.removeLayer(id);
        if (liveMap.getSource(STORM_SOURCE)) liveMap.removeSource(STORM_SOURCE);
      };
      syncStorms.current = applyStorms;
      liveMap.on("style.load", applyStorms);
      liveMap.on("idle", applyStorms);
      liveMap.on("style.load", applyTerrain);
      liveMap.on("idle", applyTerrain);
      liveMap.on("style.load", addRadar);
      liveMap.on("idle", addRadar);
      const pin = document.createElement("div");
      pin.setAttribute("role", "img");
      pin.setAttribute("aria-label", placeName);
      pin.className = "h-5 w-5 rounded-full border-[3px] border-white bg-given shadow-lg";
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

      let style = currentStyle();
      const observer = new MutationObserver(() => {
        const next = currentStyle();
        if (next === style) return;
        style = next;
        setDark(next === styles.dark);
        waitingForStyle = true;
        setStatus("loading");
        removeRadar();
        removeStorms();
        liveMap.setStyle(next);
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => {
        observer.disconnect();
        setMapInstance(null);
        syncRadar.current = () => {};
        syncTerrain.current = () => {};
        syncStorms.current = () => {};
        liveMap.off("style.load", applyStorms);
        liveMap.off("idle", applyStorms);
        removeStorms();
        liveMap.off("style.load", applyTerrain);
        liveMap.off("idle", applyTerrain);
        liveMap.off("style.load", addRadar);
        liveMap.off("idle", addRadar);
        removeRadar();
        marker?.remove();
        liveMap.remove();
      };
    } catch {
      marker?.remove();
      map?.remove();
      const timer = window.setTimeout(() => setStatus("error"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [place.lon, place.lat, placeName, attempt]);

  return (
    <main className="mx-auto flex h-[calc(100dvh-73px-env(safe-area-inset-bottom))] max-w-3xl flex-col overflow-hidden">
      <header className="shrink-0 px-5 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <h1 className="text-lg">{t("แผนที่")} · {placeName}</h1>
      </header>
      <div className="relative min-h-0 flex-1 bg-sky">
        <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
        <div className="absolute left-3 top-3 z-10">
          <button type="button" disabled={!available} aria-pressed={available && radarOn}
            onClick={() => { setRadarOn((on) => !on); setPlaying(false); }}
            className="rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm disabled:opacity-60">
            {available ? t("เรดาร์ฝน") : t("เรดาร์ไม่พร้อมใช้งาน")}
          </button>
          <button type="button" disabled={!wind} aria-pressed={Boolean(wind) && windOn}
            onClick={() => setWindOn((on) => !on)}
            className="ml-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm disabled:opacity-60">
            {wind ? t("ลม") : t("ข้อมูลลมไม่พร้อมใช้งาน")}
          </button>
          {storms.length > 0 && (
            <button type="button" aria-pressed={stormsOn} onClick={() => setStormsOn((on) => !on)}
              className="ml-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm aria-pressed:bg-given aria-pressed:text-white">
              {t("พายุ")} ({storms.length})
            </button>
          )}
          {terrainOk && (
            <button type="button" aria-pressed={terrainOn} onClick={() => setTerrainOn((on) => !on)}
              aria-label={terrainOn ? t("ปิดแผนที่ 3 มิติ") : t("เปิดแผนที่ 3 มิติ")}
              className="ml-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm aria-pressed:bg-given aria-pressed:text-white">
              3D
            </button>
          )}
        </div>
        {mapInstance && wind && windOn && status === "ready" && (
          <WindCanvas map={mapInstance} grid={wind} hourIndex={windHour} animate={motion.animate} count={motion.count} dark={dark} />
        )}
        {available && radarOn && (
          <div className="absolute inset-x-3 bottom-[4.5rem] z-10 mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-3 text-foreground shadow-lg">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setPlaying((value) => !value)} disabled={reducedMotion}
                aria-label={playing ? t("หยุดภาพเรดาร์") : t("เล่นภาพเรดาร์")}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-given text-white disabled:opacity-50">
                {playing ? "Ⅱ" : "▶"}
              </button>
              <input type="range" min={0} max={frames.length - 1} value={Math.min(activeIndex, frames.length - 1)}
                onChange={(event) => { setPlaying(false); setActiveIndex(Number(event.target.value)); }}
                aria-label={t("เวลาเรดาร์")}
                aria-valuetext={activeFrame ? t("{time} น.", { time: formatTime(activeFrame.time, "Asia/Bangkok", t.locale) }) : ""}
                className="min-w-0 flex-1 accent-given" />
              <span className="w-16 shrink-0 text-right text-sm font-semibold">
                {activeFrame && t("{time} น.", { time: formatTime(activeFrame.time, "Asia/Bangkok", t.locale) })}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span>{t("ฝนเบา → ฝนหนัก")}</span>
              <span>{t("อัปเดตเมื่อ {n} นาทีที่แล้ว", { n: minutesSinceNewest(frames, nowIso) })}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: "linear-gradient(to right, #9cdbff, #3383db, #ffe164, #e8473f)" }} aria-hidden="true" />
          </div>
        )}
        {status !== "ready" && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/90" role="status">
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
