"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type RefObject } from "react";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { lastRadarFrames, minutesSinceNewest } from "@/lib/radar/frames";
import { renderPrecipImage } from "@/lib/precip/render";
import { buildTimeline, segmentShares, stopLabelKey } from "@/lib/timeline/frames";
import { placeSeries, placeSeriesSummary } from "@/lib/timeline/place-series";
import { levelToRgba } from "@/lib/nowcast/intensity";
import { currentHourIndex, windMotion } from "@/lib/wind/particles";
import { terrainAvailable } from "@/lib/map/terrain";
import { initialMapState, mapReducer } from "@/lib/map/map-state";
import { BASE } from "@/lib/map/base-style";
import { DATA } from "@/lib/map/palette";
import { legendGradient } from "@/lib/map/legend";
import { WindCanvas } from "./wind-canvas";
import { useRadarSummary } from "./use-radar-summary";
import { useMapData } from "./use-map-data";
import { MapProvider, useMapContext } from "./map-provider";
import { bearingWord } from "@/lib/storms/present";
import { useRadarLayer } from "./layers/use-radar-layer";
import { useScalarLayer, type ScalarImage } from "./layers/use-scalar-layer";
import { useStormLayer } from "./layers/use-storm-layer";
import { useQuakeLayer } from "./layers/use-quake-layer";
import { useTerrainLayer } from "./layers/use-terrain-layer";
import { usePlateLayer } from "./layers/use-plate-layer";
import { usePlaceMarker } from "./layers/use-place-marker";

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
  const container = useRef<HTMLDivElement>(null);
  return (
    <MapProvider containerRef={container} initialCenter={[place.lon, place.lat]}>
      <MapScreen container={container} />
    </MapProvider>
  );
}

function MapScreen({ container }: { container: RefObject<HTMLDivElement | null> }) {
  const { place } = useLastPlace();
  const t = useT();
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const { map: mapInstance, theme, status, retry } = useMapContext();
  const { manifest, wind, storms, quakes, initialIndex } = useMapData();
  const [mapState, dispatch] = useReducer(mapReducer, undefined, initialMapState);
  const { activeIndex, playing, rainOn, overlays } = mapState;
  const { wind: windOn, storms: stormsOn, quakes: quakesOn, terrain: terrainOn } = overlays;
  const rainVisible = mapState.primary === "rain" && rainOn;
  const [layersOpen, setLayersOpen] = useState(() => initialControlOpen("fah-map-layers-open"));
  const [panelOpen, setPanelOpen] = useState(() => initialControlOpen("fah-map-panel-open"));
  const [reducedMotion, setReducedMotion] = useState(false);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const frames = useMemo(() => lastRadarFrames(manifest?.provider === "rainviewer" ? manifest.frames : []), [manifest]);
  const modelImages = useMemo(() => {
    if (!wind?.precipHours || !wind.precip || !wind.prob) return [] as (ScalarImage | null)[];
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
  const [device] = useState(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    return { saveData: nav.connection?.saveData ?? false, deviceMemory: nav.deviceMemory };
  });
  const motion = windMotion({ reducedMotion, ...device });
  const windHour = wind ? currentHourIndex(wind.hours, nowIso) : 0;
  const terrainOk = terrainAvailable(device.deviceMemory);
  useRadarLayer(mapInstance, frames, manifest?.maxZoom ?? 7, activeStop?.kind === "radar" ? activeStop.index : -1, rainVisible);
  useScalarLayer(mapInstance, modelImages, activeStop?.kind === "model" ? activeStop.index : -1, rainVisible, "model-rain", 1);
  useStormLayer(mapInstance, storms, stormsOn);
  useQuakeLayer(mapInstance, quakes, quakesOn);
  useTerrainLayer(mapInstance, terrainOn, reducedMotion);
  usePlateLayer(mapInstance, device.saveData);
  usePlaceMarker(mapInstance, place.lon, place.lat, placeName, reducedMotion);

  useEffect(() => {
    if (manifest) dispatch({ type: "resetIndex", index: initialIndex });
  }, [manifest, initialIndex]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { setReducedMotion(query.matches); if (query.matches) dispatch({ type: "stop" }); };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowIso(new Date().toISOString()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion || !frames.length || !rainVisible) return;
    const timer = window.setTimeout(() => dispatch({ type: "tick", stops }),
      activeStop?.kind === "radar" && activeStop.index === frames.length - 1 ? 1500 : 600);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, rainVisible, frames.length, activeIndex, activeStop, stops]);

  return (
    <main className="neon-map mx-auto flex h-[calc(100dvh-73px-env(safe-area-inset-bottom))] max-w-3xl flex-col overflow-hidden"
      style={{ "--neon-bg": BASE[theme].bg, "--neon-label": BASE[theme].label, "--neon-muted": BASE[theme].labelMuted, "--neon-pin": DATA.pin, "--neon-accent": DATA.storm } as React.CSSProperties}>
      <header className="shrink-0 px-5 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <h1 className="text-lg">{t("แผนที่")} · {placeName}</h1>
      </header>
      <div className="relative min-h-0 flex-1" style={{ backgroundColor: BASE[theme].bg }}>
        <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
        <div className="absolute left-3 top-3 z-10" style={{ maxWidth: "calc(100% - 5rem)" }}>
          <button type="button" aria-expanded={layersOpen} aria-controls="map-layer-chips"
            aria-label={layersOpen ? t("ซ่อนชั้นข้อมูล") : t("ชั้นข้อมูล")}
            onClick={() => { const open = !layersOpen; setLayersOpen(open); rememberControlOpen("fah-map-layers-open", open); }}
            className="neon-glass neon-toggle grid size-10 place-items-center rounded-full text-lg">
            <span aria-hidden="true">{layersOpen ? "✕" : "☰"}</span>
          </button>
          <div id="map-layer-chips" hidden={!layersOpen} className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={!available} aria-pressed={available && rainVisible}
              onClick={() => dispatch({ type: "toggleRain" })}
              className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-60">
              {available ? t("เรดาร์ฝน") : t("เรดาร์ไม่พร้อมใช้งาน")}
            </button>
            <button type="button" disabled={!wind} aria-pressed={Boolean(wind) && windOn}
              onClick={() => dispatch({ type: "toggleOverlay", key: "wind" })}
              className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold disabled:opacity-60">
              {wind ? t("ลม") : t("ข้อมูลลมไม่พร้อมใช้งาน")}
            </button>
            {storms.length > 0 && (
              <button type="button" aria-pressed={stormsOn} onClick={() => dispatch({ type: "toggleOverlay", key: "storms" })}
                className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold">
                {t("พายุ")} ({storms.length})
              </button>
            )}
            {quakes.length > 0 && (
              <button type="button" aria-pressed={quakesOn} onClick={() => dispatch({ type: "toggleOverlay", key: "quakes" })}
                className="neon-glass neon-chip rounded-full px-3 py-2 text-sm font-semibold">
                {t("แผ่นดินไหว")} ({quakes.length})
              </button>
            )}
            {terrainOk && (
              <button type="button" aria-pressed={terrainOn} onClick={() => dispatch({ type: "toggleOverlay", key: "terrain" })}
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
        {available && rainVisible && (
          <div className={`neon-glass absolute z-10 rounded-2xl p-3 ${panelOpen ? "inset-x-3 bottom-[4.5rem] mx-auto max-w-md" : "bottom-3 left-3"}`}
            style={!panelOpen ? { maxWidth: "calc(100% - 1.5rem)" } : undefined}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => dispatch({ type: "togglePlay" })} disabled={reducedMotion || !frames.length}
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
                    onChange={(event) => dispatch({ type: "setIndex", index: Number(event.target.value) })}
                    aria-label={t("เวลาฝน")}
                    aria-valuetext={activeStop ? `${t(stopLabelKey(activeStop))} · ${activeTimeLabel}` : ""}
                    className="neon-range w-full" />
                  <div className="mt-1 flex h-1 w-full overflow-hidden rounded-full" aria-hidden="true">
                    <span style={{ width: `${shares.radar * 100}%`, backgroundColor: DATA.pin }} />
                    <span style={{ width: `${shares.model * 100}%`, backgroundColor: DATA.storm, opacity: 0.6 }} />
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
                  {radarSummary.heavyNearby && <span className="ml-1" style={{ color: DATA.storm }}>· {t("มีฝนหนักใกล้คุณ")}</span>}
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
                        <button key={`${item.kind}-${item.time}`} type="button" onClick={() => dispatch({ type: "setIndex", index })}
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
              <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: legendGradient("rain") }} aria-hidden="true" />
            </div>
          </div>
        )}
        {status !== "ready" && (
          <div className="absolute inset-0 z-10 grid place-items-center" style={{ backgroundColor: BASE[theme].bg, color: BASE[theme].label }} role="status">
            {status === "error" ? (
              <div className="text-center">
                <p>{t("โหลดแผนที่ไม่สำเร็จ")}</p>
                <button type="button" className="install-action mt-3" onClick={retry}>{t("ลองใหม่")}</button>
              </div>
            ) : t("กำลังโหลดแผนที่…")}
          </div>
        )}
      </div>
    </main>
  );
}
