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

setWorkerUrl(`/vendor/maplibre/${version}/maplibre-gl-worker.mjs`);

const styles = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const radarId = (index: number) => `rain-radar-${index}`;

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
  const radarState = useRef({ frames: [] as RadarFrame[], maxZoom: 7, activeIndex: 0, enabled: true });
  const syncRadar = useRef<() => void>(() => {});

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/radar", { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("radar unavailable"); return response.json() as Promise<RadarManifest>; })
      .then((data) => { setManifest(data); setActiveIndex(Math.max(0, lastRadarFrames(data.frames).length - 1)); })
      .catch(() => { if (!controller.signal.aborted) setManifest(null); });
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
        maxBounds: [[80, -5], [130, 30]],
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        fadeDuration: 100,
        attributionControl: false,
      });
      const liveMap = map;
      liveMap.addControl(new NavigationControl(), "top-right");
      liveMap.addControl(new AttributionControl({ compact: true, customAttribution: '<a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">Weather data by RainViewer</a>' }), "bottom-right");
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
      liveMap.on("style.load", addRadar);
      liveMap.on("idle", addRadar);
      const pin = document.createElement("div");
      pin.setAttribute("role", "img");
      pin.setAttribute("aria-label", placeName);
      pin.className = "h-5 w-5 rounded-full border-[3px] border-white bg-given shadow-lg";
      marker = new Marker({ element: pin }).setLngLat([place.lon, place.lat]).addTo(liveMap);

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
        waitingForStyle = true;
        setStatus("loading");
        removeRadar();
        liveMap.setStyle(next);
      });
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      return () => {
        observer.disconnect();
        syncRadar.current = () => {};
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
        </div>
        {available && radarOn && (
          <div className="absolute inset-x-3 bottom-10 z-10 mx-auto max-w-md rounded-2xl border border-border bg-card/95 p-3 text-foreground shadow-lg">
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
