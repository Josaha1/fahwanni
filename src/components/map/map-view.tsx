"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject, type CSSProperties } from "react";
import { toast } from "sonner";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { lastRadarFrames, minutesSinceNewest } from "@/lib/radar/frames";
import { renderPrecipImage } from "@/lib/precip/render";
import { renderPm25Image, renderTempImage } from "@/lib/raster/render-scalar";
import { pm25Level } from "@/lib/air";
import { pm25LevelWord } from "@/lib/words";
import { sampleGrid } from "@/lib/map/probe";
import { buildLayerTimeline, defaultIndexFor, playDelayMs, segmentShares, stopLabelKey, windHourFor } from "@/lib/timeline/frames";
import { placeSeries, placeSeriesSummary } from "@/lib/timeline/place-series";
import { levelToRgba } from "@/lib/nowcast/intensity";
import { windMotion } from "@/lib/wind/particles";
import { terrainAvailable } from "@/lib/map/terrain";
import { initialMapState, mapReducer } from "@/lib/map/map-state";
import { formatUrlView, parseUrlView, type UrlView } from "@/lib/map/url-state";
import { BASE } from "@/lib/map/base-style";
import { DATA } from "@/lib/map/palette";
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
import { useIsDesktop } from "./ui/use-is-desktop";
import { MapSheet, type SheetPosition } from "./ui/map-sheet";
import { MapSidePanel } from "./ui/map-side-panel";
import { MapPanelContent } from "./ui/map-panel-content";
import { MapSearchPill } from "./ui/map-search-pill";
import { ActionRail } from "./ui/action-rail";
import { PointCard } from "./ui/point-card";
import { PrimaryPicker } from "./ui/primary-picker";
import { LegendChip } from "./ui/legend-chip";
import { LegendDialog } from "./ui/legend-dialog";
import { useProbe } from "./use-probe";

function initialSheetPosition(): SheetPosition {
  try {
    const saved = localStorage.getItem("fah-map-sheet");
    if (saved === "peek" || saved === "half") return saved;
  } catch { /* Private browsing can deny storage. */ }
  return window.matchMedia("(max-width: 640px)").matches ? "peek" : "half";
}

function rememberSheetPosition(position: SheetPosition): void {
  try { localStorage.setItem("fah-map-sheet", position); } catch { /* Keep the sheet usable without storage. */ }
}

export function MapView() {
  const { place } = useLastPlace();
  const container = useRef<HTMLDivElement>(null);
  const [urlView] = useState(() => parseUrlView(window.location.search));
  return (
    <MapProvider containerRef={container} initialCenter={urlView.lat !== undefined && urlView.lon !== undefined
      ? [urlView.lon, urlView.lat] : [place.lon, place.lat]} initialZoom={urlView.z}>
      <MapScreen container={container} urlView={urlView} />
    </MapProvider>
  );
}

function MapScreen({ container, urlView }: { container: RefObject<HTMLDivElement | null>; urlView: UrlView }) {
  const { place } = useLastPlace();
  const t = useT();
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const { map: mapInstance, theme, status, retry } = useMapContext();
  const { probe, select, close, probeCenter } = useProbe(mapInstance);
  const { manifest, wind, windSettled, pm25, pm25Status, loadPm25, storms, quakes, initialIndex } = useMapData();
  const [mapState, dispatch] = useReducer(mapReducer, urlView, (view) => initialMapState({ primary: view.layer, overlays: view.ov }));
  const { activeIndex, playing, primary, rainOn, overlays } = mapState;
  const { wind: windOn, storms: stormsOn, quakes: quakesOn, terrain: terrainOn } = overlays;
  const rainVisible = primary === "rain" && rainOn;
  const isDesktop = useIsDesktop();
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>(initialSheetPosition);
  const focusLayers = useRef(false);
  const legendButton = useRef<HTMLButtonElement>(null);
  const legendDialog = useRef<HTMLDialogElement>(null);
  const pendingTime = useRef(urlView.t);
  const [immersive, setImmersive] = useState(false);
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
  const stops = useMemo(() => buildLayerTimeline(primary, {
    radarTimes: frames.map((frame) => frame.time), modelHours, hourly: primary === "temp" ? wind?.tempHours : primary === "pm25" ? pm25?.hours : undefined,
  }, nowIso), [primary, frames, modelHours, wind?.tempHours, pm25?.hours, nowIso]);
  const tempImages = useMemo(() => {
    if (primary !== "temp" || !wind?.tempHours || !wind.temp) return [] as (ScalarImage | null)[];
    const images: (ScalarImage | null)[] = Array(wind.tempHours.length).fill(null);
    for (const stop of stops) {
      const image = renderTempImage(wind, stop.index);
      if (!image) continue;
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      const pixels = context.createImageData(image.width, image.height);
      pixels.data.set(image.data);
      context.putImageData(pixels, 0, 0);
      images[stop.index] = { url: canvas.toDataURL(), coordinates: image.coordinates };
    }
    return images;
  }, [primary, wind, stops]);
  const pm25Images = useMemo(() => {
    if (primary !== "pm25" || !pm25) return [] as (ScalarImage | null)[];
    const images: (ScalarImage | null)[] = Array(pm25.hours.length).fill(null);
    for (const stop of stops) {
      const image = renderPm25Image(pm25, stop.index);
      if (!image) continue;
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) continue;
      const pixels = context.createImageData(image.width, image.height);
      pixels.data.set(image.data);
      context.putImageData(pixels, 0, 0);
      images[stop.index] = { url: canvas.toDataURL(), coordinates: image.coordinates };
    }
    return images;
  }, [primary, pm25, stops]);
  const defaultIdx = defaultIndexFor(primary, stops, nowIso);
  const available = stops.length > 0;
  const activeStop = stops[Math.min(activeIndex, stops.length - 1)];
  const shares = segmentShares(stops);
  const activeTimeLabel = activeStop?.kind === "model" && primary === "rain"
    ? t("+{n} ชม. · {time} น.", { n: Math.max(0, Math.ceil((Date.parse(activeStop.time) - Date.parse(nowIso)) / 3_600_000)), time: formatTime(activeStop.time, "Asia/Bangkok", t.locale) })
    : activeStop ? t("{time} น.", { time: formatTime(activeStop.time, "Asia/Bangkok", t.locale) }) : "";
  // Always the newest frame: "where is the rain now", independent of the scrubber.
  const radarSummary = useRadarSummary(frames.at(-1), place.lon, place.lat);
  const series = useMemo(() => wind ? placeSeries(wind, stops, place, radarSummary ?? undefined) : [], [wind, stops, place, radarSummary]);
  const seriesSummary = placeSeriesSummary(series, nowIso);
  const locationTemp = primary === "temp" && activeStop && wind?.temp?.[activeStop.index] && wind.feels?.[activeStop.index]
    ? { temp: sampleGrid(wind, wind.temp[activeStop.index], place.lon, place.lat), feels: sampleGrid(wind, wind.feels[activeStop.index], place.lon, place.lat) }
    : null;
  const locationPm25 = primary === "pm25" && activeStop && pm25?.pm25[activeStop.index]
    ? sampleGrid(pm25, pm25.pm25[activeStop.index], place.lon, place.lat) : null;
  const [device] = useState(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    return { saveData: nav.connection?.saveData ?? false, deviceMemory: nav.deviceMemory };
  });
  const motion = windMotion({ reducedMotion, ...device });
  const windHour = wind ? windHourFor(activeStop, wind.hours, nowIso) : 0;
  const terrainOk = terrainAvailable(device.deviceMemory);
  useRadarLayer(mapInstance, frames, manifest?.maxZoom ?? 7, activeStop?.kind === "radar" ? activeStop.index : -1, rainVisible);
  useScalarLayer(mapInstance, modelImages, activeStop?.kind === "model" ? activeStop.index : -1, rainVisible, "model-rain", 1);
  useScalarLayer(mapInstance, tempImages, activeStop?.kind === "model" && primary === "temp" ? activeStop.index : -1, primary === "temp", "temp", 1);
  useScalarLayer(mapInstance, pm25Images, activeStop?.kind === "model" && primary === "pm25" ? activeStop.index : -1, primary === "pm25", "pm25", 1);
  const selectStorm = useCallback((id: string, trigger: HTMLElement) => select({ kind: "storm", id }, trigger), [select]);
  useStormLayer(mapInstance, storms, stormsOn, selectStorm);
  useQuakeLayer(mapInstance, quakes, quakesOn);
  useTerrainLayer(mapInstance, terrainOn, reducedMotion);
  usePlateLayer(mapInstance, device.saveData);
  usePlaceMarker(mapInstance, place.lon, place.lat, placeName, reducedMotion, urlView.lat !== undefined && urlView.lon !== undefined);

  useEffect(() => {
    if (urlView.layer !== "pm25" || pm25Status !== "idle") return;
    loadPm25().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      pendingTime.current = undefined;
      toast.error(t("ข้อมูลฝุ่น PM2.5 ไม่พร้อมใช้งาน"));
      dispatch({ type: "setPrimary", primary: "rain" });
    });
  }, [urlView.layer, pm25Status, loadPm25, t]);

  useEffect(() => {
    if (manifest && !pendingTime.current && primary === "rain") dispatch({ type: "resetIndex", index: initialIndex });
  }, [manifest, initialIndex, primary]);

  useEffect(() => {
    if (!pendingTime.current || !stops.length || (primary === "rain" && !windSettled)) return;
    const target = Date.parse(pendingTime.current);
    let nearest = -1;
    let distance = 90 * 60_000 + 1;
    stops.forEach((stop, index) => {
      const difference = Math.abs(Date.parse(stop.time) - target);
      if (difference < distance) { nearest = index; distance = difference; }
    });
    pendingTime.current = undefined;
    dispatch({ type: "resetIndex", index: distance <= 90 * 60_000 ? nearest : defaultIdx });
  }, [stops, defaultIdx, primary, windSettled]);

  const visibleSheetPosition = probe && !isDesktop ? "half" : sheetPosition;

  const previousPrimary = useRef(mapState.primary);
  useEffect(() => {
    if (previousPrimary.current === mapState.primary) return;
    previousPrimary.current = mapState.primary;
    dispatch({ type: "resetIndex", index: defaultIdx });
  }, [mapState.primary, defaultIdx]);

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
    if (!playing || reducedMotion || stops.length <= 1 || (mapState.primary === "rain" && !rainOn)) return;
    const timer = window.setTimeout(() => dispatch({ type: "tick", stops }),
      playDelayMs(stops, activeIndex, defaultIdx));
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, mapState.primary, rainOn, stops, activeIndex, defaultIdx]);

  const viewQuery = useCallback(() => {
    if (!mapInstance) return null;
    const center = mapInstance.getCenter();
    return formatUrlView({ lat: center.lat, lon: center.lng, z: mapInstance.getZoom(), layer: primary,
      t: activeStop?.time ?? pendingTime.current, ov: overlays });
  }, [mapInstance, primary, activeStop?.time, overlays]);

  useEffect(() => {
    if (!mapInstance) return;
    let timer: number;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const query = viewQuery();
        if (query) window.history.replaceState(null, "", `/map${query}`);
      }, 300);
    };
    mapInstance.on("moveend", schedule);
    schedule();
    return () => { mapInstance.off("moveend", schedule); window.clearTimeout(timer); };
  }, [mapInstance, viewQuery]);

  useEffect(() => {
    if (!mapInstance) return;
    const frame = window.requestAnimationFrame(() => mapInstance.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [mapInstance, immersive]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setImmersive(false);
      mapInstance?.resize();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !immersive || probe || legendDialog.current?.open) return;
      setImmersive(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [immersive, probe, mapInstance]);

  const toggleFullscreen = () => {
    if (immersive) {
      setImmersive(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } else {
      setImmersive(true);
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  };

  const shareView = async () => {
    const query = viewQuery();
    if (!query) return;
    const url = `${window.location.origin}/map${query}`;
    try {
      if (navigator.share) await navigator.share({ title: t("ฟ้าวันนี้ — แผนที่"), url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("คัดลอกลิงก์แล้ว"));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("แชร์ไม่สำเร็จ"));
    }
  };

  useEffect(() => {
    if (!focusLayers.current || (!isDesktop && visibleSheetPosition !== "half")) return;
    const frame = window.requestAnimationFrame(() => {
      const heading = document.getElementById("map-layers");
      heading?.scrollIntoView({ block: "nearest" });
      heading?.focus({ preventScroll: true });
      focusLayers.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isDesktop, visibleSheetPosition]);

  const setPosition = (position: SheetPosition) => {
    setSheetPosition(position);
    rememberSheetPosition(position);
  };
  const openLayers = () => {
    focusLayers.current = true;
    if (!isDesktop && sheetPosition !== "half") setPosition("half");
    else {
      const heading = document.getElementById("map-layers");
      heading?.scrollIntoView({ block: "nearest" });
      heading?.focus({ preventScroll: true });
      focusLayers.current = false;
    }
  };
  const compact = !isDesktop && visibleSheetPosition === "peek";
  const playButton = <button type="button" onClick={() => dispatch({ type: "togglePlay" })} disabled={reducedMotion || stops.length <= 1}
    aria-label={playing ? t("หยุดภาพเรดาร์") : t("เล่นภาพเรดาร์")} className="map-play shrink-0 disabled:opacity-50">
    {playing ? "Ⅱ" : "▶"}
  </button>;
  const timeline = <div className="flex min-w-0 items-center gap-2">
    {playButton}
    {compact && <span className="min-w-0 flex-1 truncate text-sm font-semibold">{activeTimeLabel}</span>}
    {!compact && <>
      <div className="min-w-0 flex-1">
        <input type="range" min={0} max={Math.max(0, stops.length - 1)} value={Math.min(activeIndex, Math.max(0, stops.length - 1))}
          onChange={(event) => dispatch({ type: "setIndex", index: Number(event.target.value) })}
          disabled={!available} aria-label={t(primary === "temp" ? "เวลาอุณหภูมิ" : primary === "pm25" ? "เวลาฝุ่น PM2.5" : "เวลาฝน")}
          aria-valuetext={activeStop ? `${t(stopLabelKey(activeStop))} · ${activeTimeLabel}` : ""}
          className="map-range w-full" />
        <div className="mt-1 flex h-1 w-full overflow-hidden rounded-full" aria-hidden="true">
          <span style={{ width: `${shares.radar * 100}%`, backgroundColor: DATA.pin }} />
          <span style={{ width: `${shares.model * 100}%`, backgroundColor: "#7c3aed", opacity: 0.6 }} />
        </div>
      </div>
      <span className="w-32 shrink-0 text-right text-sm font-semibold max-[400px]:w-24">
        {activeTimeLabel}
        {activeStop && <small className="map-muted block text-xs font-normal">{t(stopLabelKey(activeStop))}</small>}
      </span>
    </>}
    {!isDesktop && <button type="button" aria-expanded={visibleSheetPosition === "half"} aria-controls="map-timeline-details"
      aria-label={visibleSheetPosition === "half" ? t("ย่อแผงเวลา") : t("ขยายแผงเวลา")}
      onClick={() => setPosition(sheetPosition === "half" ? "peek" : "half")}
      className="map-sheet-toggle map-icon-btn shrink-0 text-lg">
      <span aria-hidden="true">{visibleSheetPosition === "half" ? "⌄" : "⌃"}</span>
    </button>}
  </div>;
  const details = <div>
    {locationTemp && locationTemp.temp !== null && locationTemp.feels !== null && <p className="mt-2 text-sm font-semibold" aria-live="polite">
      {t("อุณหภูมิที่ตำแหน่งคุณ {temp}° (รู้สึกเหมือน {feels}°)", { temp: Math.round(locationTemp.temp), feels: Math.round(locationTemp.feels) })}
    </p>}
    {primary === "pm25" && locationPm25 !== null && <p className="mt-2 text-sm font-semibold" aria-live="polite">
      {t("ฝุ่น PM2.5 ที่ตำแหน่งคุณ {v} µg/m³ · {level}", { v: Math.round(locationPm25), level: pm25LevelWord(pm25Level(locationPm25), t) })}
    </p>}
    {primary === "pm25" && <p className="map-muted mt-1 text-xs">{t("ค่าประมาณจากแบบจำลอง (CAMS) — หน้าพยากรณ์ใช้ค่าจากสถานีตรวจวัด")}</p>}
    {primary === "rain" && radarSummary && <p className="mt-2 text-sm font-semibold" aria-live="polite">
      {radarSummary.overhead ? t("ตอนนี้ฝนตกอยู่ตรงตำแหน่งของคุณ")
        : radarSummary.nearestKm !== undefined
          ? t("ฝนใกล้สุดห่าง ~{km} กม. ทางทิศ{dir}", { km: radarSummary.nearestKm, dir: bearingWord(radarSummary.bearingDeg ?? 0, t) })
          : t("ไม่มีฝนในรัศมี 100 กม.")}
      {radarSummary.heavyNearby && <span className="ml-1" style={{ color: DATA.storm }}>· {t("มีฝนหนักใกล้คุณ")}</span>}
    </p>}
    {primary === "rain" && series.length > 0 && <section className="mt-3" aria-label={t("ฝนที่ตำแหน่งคุณ: {summary}", { summary: t(seriesSummary.key, seriesSummary.params) })}>
      <h2 className="text-xs font-semibold">{t("ฝนที่ตำแหน่งคุณ")}</h2>
      <div className="mt-1 flex min-w-0 gap-0.5 pb-1">
        {series.map((item) => {
          const index = stops.findIndex((stop) => stop.kind === item.kind && stop.time === item.time);
          const label = item.kind === "radar" ? t("ตอนนี้") : formatTime(item.time, "Asia/Bangkok", t.locale).slice(0, 2);
          const [r, g, b] = levelToRgba(item.level);
          return <button key={`${item.kind}-${item.time}`} type="button" onClick={() => dispatch({ type: "setIndex", index })}
            aria-label={t("{time}: {rain}", { time: label, rain: t(item.level ? "มีฝน" : "ไม่มีฝน") })}
            aria-pressed={activeIndex === index} className="map-series-item flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md py-1 text-[10px]">
            <span className="flex h-7 w-2 items-end rounded-sm" style={{ background: "rgb(127 127 127 / .2)" }} aria-hidden="true">
              {item.level > 0 && <span className="w-full rounded-sm" style={{ height: `${item.level * 25}%`, backgroundColor: `rgb(${r} ${g} ${b})` }} />}
            </span>
            <span className="whitespace-nowrap text-center leading-tight">{label}</span>
          </button>;
        })}
      </div>
      <p className="map-muted text-center text-[10px]">{t("เวลา (น.)")}</p>
    </section>}
    {primary === "rain" && frames.length > 0 && <p className="map-muted mt-2 text-right text-xs">{t("อัปเดตเมื่อ {n} นาทีที่แล้ว", { n: minutesSinceNewest(frames, nowIso) })}</p>}
  </div>;
  const layers = <>
    {primary === "rain" && <button type="button" disabled={!available} aria-pressed={available && rainVisible} onClick={() => dispatch({ type: "toggleRain" })} className="map-chip text-sm disabled:opacity-60">
      {available ? t("เรดาร์ฝน") : t("เรดาร์ไม่พร้อมใช้งาน")}
    </button>}
    <button type="button" disabled={!wind} aria-pressed={Boolean(wind) && windOn} onClick={() => dispatch({ type: "toggleOverlay", key: "wind" })} className="map-chip text-sm disabled:opacity-60">
      {wind ? t("ลม") : t("ข้อมูลลมไม่พร้อมใช้งาน")}
    </button>
    {storms.length > 0 && <button type="button" aria-pressed={stormsOn} onClick={() => dispatch({ type: "toggleOverlay", key: "storms" })} className="map-chip text-sm">{t("พายุ")} ({storms.length})</button>}
    {quakes.length > 0 && <button type="button" aria-pressed={quakesOn} onClick={() => dispatch({ type: "toggleOverlay", key: "quakes" })} className="map-chip text-sm">{t("แผ่นดินไหว")} ({quakes.length})</button>}
  </>;
  const card = probe && <PointCard key={probe.kind === "point" ? `${probe.kind}-${probe.lat}-${probe.lon}` : `${probe.kind}-${probe.id}`}
    probe={probe} onClose={close} frame={frames.at(-1)} wind={wind} windHour={windHour} pm25={pm25} primary={primary} activeStop={activeStop} nowIso={nowIso} storms={storms} quakes={quakes} />;
  const primaryPicker = <PrimaryPicker primary={primary} tempAvailable={Boolean(wind?.tempHours?.length && wind.temp?.some((hour) => hour.length > 0))}
    pm25Loading={pm25Status === "loading"} onChange={(next) => {
      dispatch({ type: "setPrimary", primary: next });
      if (next === "pm25" && pm25Status !== "loading") loadPm25().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        toast.error(t("ข้อมูลฝุ่น PM2.5 ไม่พร้อมใช้งาน"));
        dispatch({ type: "setPrimary", primary: "rain" });
      });
    }} />;
  const panelContent = <MapPanelContent placeName={placeName} compact={compact} desktop={isDesktop} timeline={timeline} details={details} primaryPicker={primaryPicker} layers={layers}
    card={card} onProbeCenter={(trigger) => probeCenter(trigger)} />;

  return <main className={`map-shell${immersive ? " map-shell--immersive" : ""}`} style={{
    "--map-bg": BASE[theme].bg, "--map-panel": BASE[theme].panel, "--map-panel-border": BASE[theme].panelBorder,
    "--map-label": BASE[theme].label, "--map-muted": BASE[theme].labelMuted, "--map-accent": DATA.pin,
  } as CSSProperties}>
    <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
    {mapInstance && wind && windOn && status === "ready" && <WindCanvas map={mapInstance} grid={wind} hourIndex={windHour} animate={motion.animate} count={motion.count} />}
    {!isDesktop && <div className="map-search-position"><MapSearchPill placeName={placeName} /></div>}
    {(mapState.primary !== "rain" || rainOn) && <LegendChip primary={mapState.primary} buttonRef={legendButton} onOpen={() => legendDialog.current?.showModal()} />}
    <LegendDialog primary={mapState.primary} active={{ wind: windOn && Boolean(wind), storms: stormsOn && storms.length > 0, quakes: quakesOn && quakes.length > 0 }}
      dialogRef={legendDialog} triggerRef={legendButton} />
    {isDesktop ? <MapSidePanel>{panelContent}</MapSidePanel> : <MapSheet position={visibleSheetPosition}>{panelContent}</MapSheet>}
    <ActionRail onLayers={openLayers} terrainOk={terrainOk} terrainOn={terrainOn}
      onTerrain={() => dispatch({ type: "toggleOverlay", key: "terrain" })}
      immersive={immersive} onFullscreen={toggleFullscreen} onShare={shareView} />
    {status !== "ready" && <div className="absolute inset-0 z-20 grid place-items-center" style={{ backgroundColor: BASE[theme].bg, color: BASE[theme].label }} role="status">
      {status === "error" ? <div className="text-center"><p>{t("โหลดแผนที่ไม่สำเร็จ")}</p><button type="button" className="install-action mt-3" onClick={retry}>{t("ลองใหม่")}</button></div>
        : t("กำลังโหลดแผนที่…")}
    </div>}
  </main>;
}
