"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject, type CSSProperties } from "react";
import { toast } from "sonner";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatTime } from "@/lib/format";
import { lastRadarFrames, minutesSinceNewest, radarAgeLabel } from "@/lib/radar/frames";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";
import { sampleSeries } from "@/lib/timeline/store";
import { rainSourceAt } from "@/lib/timeline/rain-source";
import { HOUR, lerpGrid, makeDomain, MINUTE, roundTo } from "@/lib/timeline/time";
import { pm25Level } from "@/lib/air";
import { pm25LevelWord } from "@/lib/words";
import { sampleGrid } from "@/lib/map/probe";
import { buildLayerTimeline, defaultIndexFor, type TimelineStop } from "@/lib/timeline/frames";
import { placeSeries, placeSeriesSummary } from "@/lib/timeline/place-series";
import { levelToRgba } from "@/lib/nowcast/intensity";
import { windMotion } from "@/lib/wind/particles";
import { fieldFromGrid, windFieldAt } from "@/lib/wind/field";
import { terrainAvailable } from "@/lib/map/terrain";
import { initialMapState, mapReducer } from "@/lib/map/map-state";
import { formatUrlView, parseUrlView, type UrlView } from "@/lib/map/url-state";
import { BASE } from "@/lib/map/base-style";
import { DATA } from "@/lib/map/palette";
import { WindCanvas } from "./wind-canvas";
import { useRadarSummary } from "./use-radar-summary";
import { useMapData } from "./use-map-data";
import { useForecastDays } from "./use-forecast-days";
import { MapProvider, useMapContext } from "./map-provider";
import { bearingWord } from "@/lib/storms/present";
import { useRadarLayer } from "./layers/use-radar-layer";
import { useTimeImageLayer } from "./layers/use-time-image-layer";
import { useStormLayer } from "./layers/use-storm-layer";
import { useQuakeLayer } from "./layers/use-quake-layer";
import { useDamsLayer } from "./layers/use-dams-layer";
import { useDamPathLayer } from "./layers/use-dam-path-layer";
import { loadDamPaths, type DamPath, type Downstream } from "@/lib/dams/paths";
import type { RiverStation } from "@/lib/dams/types";
import { useTerrainLayer } from "./layers/use-terrain-layer";
import { usePlateLayer } from "./layers/use-plate-layer";
import { usePlaceMarker } from "./layers/use-place-marker";
import { useIsDesktop } from "./ui/use-is-desktop";
import { MapSheet, type SheetPosition } from "./ui/map-sheet";
import { MapSidePanel } from "./ui/map-side-panel";
import { MapPanelContent } from "./ui/map-panel-content";
import { TimeBar } from "./ui/time-bar";
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

const emptyStations: RiverStation[] = [];
const scalarGrid = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY };

export function MapView() {
  const { place } = useLastPlace();
  const container = useRef<HTMLDivElement>(null);
  const [urlView] = useState(() => parseUrlView(window.location.search));
  const [initialFocus] = useState(() => {
    const value = new URLSearchParams(window.location.search).get("focus");
    return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
  });
  return (
    <MapProvider containerRef={container} initialCenter={urlView.lat !== undefined && urlView.lon !== undefined
      ? [urlView.lon, urlView.lat] : [place.lon, place.lat]} initialZoom={urlView.z}>
      <MapScreen container={container} urlView={urlView} initialFocus={initialFocus} />
    </MapProvider>
  );
}

function MapScreen({ container, urlView, initialFocus }: { container: RefObject<HTMLDivElement | null>; urlView: UrlView; initialFocus: string | null }) {
  const { place } = useLastPlace();
  const t = useT();
  const placeName = place.source === "gps" ? t("ตำแหน่งปัจจุบัน") : t.locale === "en" && place.source === "province" ? place.admin ?? place.name : place.name;
  const { map: mapInstance, theme, status, retry } = useMapContext();
  const { probe, select, close, probeCenter } = useProbe(mapInstance);
  const { manifest, wind, windSettled, dams, damsStatus, loadDams, storms, quakes, initialIndex } = useMapData();
  const [mapState, dispatch] = useReducer(mapReducer, urlView, (view) => {
    const initial = initialMapState({ primary: view.layer, overlays: view.ov });
    if (view.dam) initial.overlays.dams = true;
    const focus = initialFocus ?? view.t;
    if (focus) initial.timeMs = Date.parse(focus);
    return initial;
  });
  const { activeIndex, timeMs, playing, primary, rainOn, overlays } = mapState;
  const { wind: windOn, storms: stormsOn, quakes: quakesOn, dams: damsOn, terrain: terrainOn } = overlays;
  const rainVisible = primary === "rain" && rainOn;
  const isDesktop = useIsDesktop();
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>(initialSheetPosition);
  const focusLayers = useRef(false);
  const legendButton = useRef<HTMLButtonElement>(null);
  const legendDialog = useRef<HTMLDialogElement>(null);
  const pendingTime = useRef(urlView.t);
  const previousTimeline = useRef<{ manifest: typeof manifest; stops: TimelineStop[]; defaultIdx: number; primary: typeof primary } | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pathRequestedId, setPathRequestedId] = useState<string | null>(urlView.dam ?? null);
  const [pathData, setPathData] = useState<{ id: string; path: DamPath; downstream: Downstream } | null>(null);
  const [pathLoading, setPathLoading] = useState(Boolean(urlView.dam));
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const frames = useMemo(() => lastRadarFrames(manifest?.provider === "rainviewer" ? manifest.frames : []), [manifest]);
  const radarAge = minutesSinceNewest(frames, nowIso);
  const ageLabel = radarAgeLabel(radarAge, manifest?.stale);
  const nowMs = Date.parse(nowIso);
  const domain = useMemo(() => makeDomain(nowMs), [nowMs]);
  const effectiveTime = timeMs ?? nowMs;
  const { series: windSeries } = useForecastDays({ source: "wind", enabled: true, focusTime: effectiveTime, nowMs });
  const { series: pm25Series, loadedDays: pm25LoadedDays, lastAvailable: pm25LastAvailable, loading: pm25Loading, error: pm25Error } = useForecastDays({ source: "pm25", enabled: primary === "pm25", focusTime: effectiveTime, nowMs });
  const modelHours = useMemo(() => windSeries?.times.map((time) => new Date(time).toISOString()) ?? [], [windSeries]);
  const stops = useMemo(() => buildLayerTimeline(primary, {
    radarTimes: frames.map((frame) => frame.time), modelHours, hourly: primary === "temp" ? modelHours : primary === "pm25" ? pm25Series?.times.map((time) => new Date(time).toISOString()) : undefined,
  }, nowIso), [primary, frames, modelHours, pm25Series, nowIso]);
  const defaultIdx = defaultIndexFor(primary, stops, nowIso);
  const available = stops.length > 0;
  const activeStop = stops[Math.min(activeIndex, stops.length - 1)];
  const rainSource = rainSourceAt(effectiveTime, frames.map((frame) => Date.parse(frame.time)), nowMs);
  // Always the newest frame: "where is the rain now", independent of the scrubber.
  const radarSummary = useRadarSummary(frames.at(-1), place.lon, place.lat);
  const series = useMemo(() => wind ? placeSeries(wind, stops.map((stop) => stop.kind === "model"
    ? { ...stop, index: wind.precipHours?.indexOf(stop.time) ?? -1 } : stop), place, radarSummary ?? undefined) : [], [wind, stops, place, radarSummary]);
  const seriesSummary = placeSeriesSummary(series, nowIso);
  const legacyTempHour = activeStop ? wind?.tempHours?.indexOf(activeStop.time) ?? -1 : -1;
  const locationTemp = primary === "temp" && wind && legacyTempHour >= 0 && wind.temp?.[legacyTempHour] && wind.feels?.[legacyTempHour]
    ? { temp: sampleGrid(wind, wind.temp[legacyTempHour], place.lon, place.lat), feels: sampleGrid(wind, wind.feels[legacyTempHour], place.lon, place.lat) }
    : null;
  const pm25Sample = pm25Series ? sampleSeries(pm25Series, "pm25", effectiveTime) : null;
  const pm25Values = pm25Sample ? (pm25Sample.exact ? pm25Sample.a : lerpGrid(pm25Sample.a, pm25Sample.b, pm25Sample.f)) : null;
  const locationPm25 = primary === "pm25" && pm25Values ? sampleGrid(scalarGrid, pm25Values, place.lon, place.lat) : null;
  const [device] = useState(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
    return { saveData: nav.connection?.saveData ?? false, deviceMemory: nav.deviceMemory };
  });
  const motion = windMotion({ reducedMotion, ...device });
  const windHour = wind ? Math.max(0, wind.hours.findLastIndex((hour) => Date.parse(hour) <= effectiveTime)) : 0;
  const windMinute = roundTo(effectiveTime, MINUTE);
  const interpolatedWindField = useMemo(() => windFieldAt(windSeries, windMinute, scalarGrid), [windSeries, windMinute]);
  const windField = interpolatedWindField ?? (wind ? fieldFromGrid(wind, windHour) : null);
  const terrainOk = terrainAvailable(device.deviceMemory);
  useRadarLayer(mapInstance, frames, manifest?.maxZoom ?? 7, rainSource.kind === "radar" ? rainSource.index : -1, rainVisible && rainSource.kind === "radar");
  useTimeImageLayer(mapInstance, { id: "model-rain", enabled: rainVisible && rainSource.kind === "model", series: windSeries, timeMs: effectiveTime, kind: "rain", grid: scalarGrid, beforeSymbol: true, opacity: 1 });
  useTimeImageLayer(mapInstance, { id: "temp", enabled: primary === "temp", series: windSeries, timeMs: effectiveTime, kind: "temp", grid: scalarGrid, beforeSymbol: true, opacity: 1 });
  useTimeImageLayer(mapInstance, { id: "pm25", enabled: primary === "pm25", series: pm25Series, timeMs: effectiveTime, kind: "pm25", grid: scalarGrid, beforeSymbol: true, opacity: 1 });
  const selectStorm = useCallback((id: string, trigger: HTMLElement) => select({ kind: "storm", id }, trigger), [select]);
  useStormLayer(mapInstance, storms, stormsOn, selectStorm);
  useQuakeLayer(mapInstance, quakes, quakesOn);
  useTerrainLayer(mapInstance, terrainOn, reducedMotion);
  usePlateLayer(mapInstance, device.saveData);
  const selectDam = useCallback((id: string, trigger: HTMLElement) => select({ kind: "dam", id }, trigger), [select]);
  useDamsLayer(mapInstance, dams, damsOn, selectDam);
  const activePathId = damsOn && probe?.kind === "dam" && pathRequestedId === probe.id ? probe.id : null;
  const activePath = activePathId && pathData?.id === activePathId ? pathData : null;
  useDamPathLayer(mapInstance, activePath?.path ?? null, activePath?.downstream ?? null, dams?.stations ?? emptyStations, isDesktop, reducedMotion);
  usePlaceMarker(mapInstance, place.lon, place.lat, placeName, reducedMotion, urlView.lat !== undefined && urlView.lon !== undefined);

  useEffect(() => {
    if (urlView.dam) select({ kind: "dam", id: urlView.dam });
  }, [urlView.dam, select]);

  useEffect(() => {
    if (!activePathId || pathData?.id === activePathId) return;
    let active = true;
    loadDamPaths().then(({ paths, downstream }) => {
      const path = paths.get(activePathId);
      const details = downstream[activePathId];
      if (!path || !details) throw new Error("Dam path missing");
      if (active) setPathData({ id: activePathId, path, downstream: details });
    }).catch(() => {
      if (active) { toast.error(t("โหลดเส้นทางน้ำไม่สำเร็จ")); setPathRequestedId(null); }
    }).finally(() => { if (active) setPathLoading(false); });
    return () => { active = false; };
  }, [activePathId, pathData?.id, t]);

  const togglePath = () => {
    if (activePathId) { setPathRequestedId(null); setPathLoading(false); }
    else if (probe?.kind === "dam") { setPathLoading(pathData?.id !== probe.id); setPathRequestedId(probe.id); }
  };

  useEffect(() => {
    if (primary !== "pm25" || !pm25Error) return;
    pendingTime.current = undefined;
    toast.error(t("ข้อมูลฝุ่น PM2.5 ไม่พร้อมใช้งาน"));
    dispatch({ type: "setPrimary", primary: "rain" });
  }, [primary, pm25Error, t]);

  useEffect(() => {
    if (!damsOn || damsStatus !== "idle") return;
    loadDams().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("ข้อมูลเขื่อนไม่พร้อมใช้งาน"));
      dispatch({ type: "setOverlay", key: "dams", enabled: false });
    });
  }, [damsOn, damsStatus, loadDams, t]);

  useEffect(() => {
    const previous = previousTimeline.current;
    if (!manifest || previous?.manifest === manifest || pendingTime.current || primary !== "rain") return;
    if (!previous?.manifest || previous.primary !== primary) {
      dispatch({ type: "resetIndex", index: initialIndex });
      return;
    }
    const oldStop = previous.stops[Math.min(activeIndex, previous.stops.length - 1)];
    if (!oldStop) return;
    if (!playing && activeIndex === previous.defaultIdx) {
      dispatch({ type: "resetIndex", index: defaultIdx });
      return;
    }
    let nearest = stops.findIndex((stop) => stop.time === oldStop.time && stop.kind === oldStop.kind);
    if (nearest < 0) nearest = stops.findIndex((stop) => stop.time === oldStop.time);
    if (nearest < 0) {
      nearest = 0;
      stops.forEach((stop, index) => {
        if (Math.abs(Date.parse(stop.time) - Date.parse(oldStop.time)) < Math.abs(Date.parse(stops[nearest].time) - Date.parse(oldStop.time))) nearest = index;
      });
    }
    if (stops.length && nearest !== activeIndex) dispatch({ type: "resetIndex", index: nearest });
  }, [manifest, initialIndex, primary, activeIndex, playing, defaultIdx, stops]);

  useEffect(() => {
    previousTimeline.current = { manifest, stops, defaultIdx, primary };
  });

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
    const onVisibilityChange = () => { if (document.visibilityState === "visible") setNowIso(new Date().toISOString()); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisibilityChange); };
  }, []);

  useEffect(() => {
    if (!playing || reducedMotion || (primary === "rain" && !rainOn)) return;
    const step = effectiveTime < nowMs ? 10 * MINUTE : HOUR;
    const limit = primary === "pm25" && pm25LoadedDays.includes(4) && pm25LastAvailable !== null ? Math.min(domain.end, pm25LastAvailable) : domain.end;
    const next = effectiveTime + step;
    const timer = window.setTimeout(() => dispatch({ type: "setTime", t: next > limit ? domain.start : next }), 600);
    return () => window.clearTimeout(timer);
  }, [playing, reducedMotion, primary, rainOn, effectiveTime, nowMs, domain.start, domain.end, pm25LoadedDays, pm25LastAvailable]);

  const viewQuery = useCallback(() => {
    if (!mapInstance) return null;
    const center = mapInstance.getCenter();
    const query = formatUrlView({ lat: center.lat, lon: center.lng, z: mapInstance.getZoom(), layer: primary,
      t: timeMs === null ? undefined : new Date(effectiveTime).toISOString(), ov: overlays, dam: activePathId ?? undefined });
    return initialFocus && timeMs === Date.parse(initialFocus) ? `${query}&focus=${encodeURIComponent(initialFocus)}` : query;
  }, [mapInstance, primary, timeMs, effectiveTime, overlays, activePathId, initialFocus]);

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
  const playButton = <button type="button" onClick={() => dispatch({ type: "togglePlay" })} disabled={reducedMotion}
    aria-label={playing ? t("หยุดภาพเรดาร์") : t("เล่นภาพเรดาร์")} aria-pressed={playing} className="map-play shrink-0 disabled:opacity-50">
    {playing ? "Ⅱ" : "▶"}
  </button>;
  const timeline = <div className="map-time-layout">
    <div className="map-time-actions">
      {playButton}
      {timeMs !== null && Math.abs(effectiveTime - nowMs) >= MINUTE && <button type="button" className="map-chip map-time-now-button" aria-label={t("กลับไปเวลาปัจจุบัน")} onClick={() => { dispatch({ type: "stop" }); dispatch({ type: "setTime", t: null }); }}>{t("ตอนนี้")}</button>}
    </div>
    <TimeBar domain={domain} t={effectiveTime} onChange={(value) => { dispatch({ type: "stop" }); dispatch({ type: "setTime", t: value }); }}
      onTogglePlay={() => { if (!reducedMotion) dispatch({ type: "togglePlay" }); }}
      radarStart={frames[0] ? Date.parse(frames[0].time) : undefined}
      radarTime={rainSource.kind === "radar" ? rainSource.frameTime : undefined} primary={primary}
      lastAvailable={primary === "pm25" && pm25LoadedDays.includes(4) ? pm25LastAvailable ?? undefined : undefined}
      mode={isDesktop ? "fit" : "scroll"} />
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
          const label = item.kind === "radar" ? t("ตอนนี้") : formatTime(item.time, "Asia/Bangkok", t.locale).slice(0, 2);
          const [r, g, b] = levelToRgba(item.level);
          return <button key={`${item.kind}-${item.time}`} type="button" onClick={() => { dispatch({ type: "stop" }); dispatch({ type: "setTime", t: Date.parse(item.time) }); }}
            aria-label={t("{time}: {rain}", { time: label, rain: t(item.level ? "มีฝน" : "ไม่มีฝน") })}
            aria-pressed={Math.floor(effectiveTime / HOUR) === Math.floor(Date.parse(item.time) / HOUR)} className="map-series-item flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md py-1 text-[10px]">
            <span className="flex h-7 w-2 items-end rounded-sm" style={{ background: "rgb(127 127 127 / .2)" }} aria-hidden="true">
              {item.level > 0 && <span className="w-full rounded-sm" style={{ height: `${item.level * 25}%`, backgroundColor: `rgb(${r} ${g} ${b})` }} />}
            </span>
            <span className="whitespace-nowrap text-center leading-tight">{label}</span>
          </button>;
        })}
      </div>
      <p className="map-muted text-center text-[10px]">{t("เวลา (น.)")}</p>
    </section>}
    {primary === "rain" && frames.length > 0 && <p className={`${ageLabel.warn ? "map-warning" : "map-muted"} mt-2 text-right text-xs`}>
      {ageLabel.warn && <span aria-hidden="true">⚠ </span>}{t(ageLabel.key, { n: radarAge })}
    </p>}
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
    <button type="button" aria-pressed={damsOn} aria-busy={damsStatus === "loading"} className="map-chip text-sm"
      onClick={() => {
        dispatch({ type: "toggleOverlay", key: "dams" });
        if (damsOn) { setPathRequestedId(null); setPathLoading(false); }
        if (!damsOn && damsStatus === "error") loadDams().catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          toast.error(t("ข้อมูลเขื่อนไม่พร้อมใช้งาน"));
          dispatch({ type: "setOverlay", key: "dams", enabled: false });
        });
      }}>
      {t("เขื่อน")}{damsStatus === "ready" && dams ? ` (${dams.dams.length + (dams.barrage ? 1 : 0)})` : ""}
    </button>
  </>;
  const card = probe && <PointCard key={probe.kind === "point" ? `${probe.kind}-${probe.lat}-${probe.lon}` : `${probe.kind}-${probe.id}`}
    probe={probe} onClose={() => { close(); setPathRequestedId(null); }} frame={frames.at(-1)} wind={wind} windHour={windHour} windField={windField} pm25Series={pm25Series} primary={primary} activeStop={activeStop} nowIso={nowIso} storms={storms} quakes={quakes} dams={dams}
    downstream={activePath?.downstream ?? null} pathActive={Boolean(activePathId)} pathLoading={pathLoading && Boolean(activePathId)} onTogglePath={togglePath} />;
  const primaryPicker = <PrimaryPicker primary={primary} tempAvailable={Boolean(windSeries?.grids.temp?.length)}
    pm25Loading={pm25Loading} onChange={(next) => {
      dispatch({ type: "setPrimary", primary: next });
    }} />;
  const panelContent = <MapPanelContent placeName={placeName} compact={compact} desktop={isDesktop} timeline={isDesktop ? null : timeline} details={details} primaryPicker={primaryPicker} layers={layers}
    card={card} onProbeCenter={(trigger) => probeCenter(trigger)} />;

  return <main className={`map-shell${immersive ? " map-shell--immersive" : ""}`} style={{
    "--map-bg": BASE[theme].bg, "--map-panel": BASE[theme].panel, "--map-panel-border": BASE[theme].panelBorder,
    "--map-label": BASE[theme].label, "--map-muted": BASE[theme].labelMuted, "--map-accent": DATA.pin,
  } as CSSProperties}>
    <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
    {mapInstance && wind && windOn && status === "ready" && <WindCanvas map={mapInstance} field={windField} animate={motion.animate} count={motion.count} />}
    {!isDesktop && <div className="map-search-position"><MapSearchPill placeName={placeName} /></div>}
    {(mapState.primary !== "rain" || rainOn) && <LegendChip primary={mapState.primary} buttonRef={legendButton} onOpen={() => legendDialog.current?.showModal()} />}
    <LegendDialog primary={mapState.primary} active={{ wind: windOn && Boolean(wind), storms: stormsOn && storms.length > 0, quakes: quakesOn && quakes.length > 0, dams: damsOn && damsStatus === "ready" && Boolean(dams) }}
      dialogRef={legendDialog} triggerRef={legendButton} />
    {isDesktop ? <MapSidePanel>{panelContent}</MapSidePanel> : <MapSheet position={visibleSheetPosition}>{panelContent}</MapSheet>}
    {isDesktop && <div className="map-panel map-time-floating">{timeline}</div>}
    <ActionRail onLayers={openLayers} terrainOk={terrainOk} terrainOn={terrainOn}
      onTerrain={() => dispatch({ type: "toggleOverlay", key: "terrain" })}
      immersive={immersive} onFullscreen={toggleFullscreen} onShare={shareView} />
    {status !== "ready" && <div className="absolute inset-0 z-20 grid place-items-center" style={{ backgroundColor: BASE[theme].bg, color: BASE[theme].label }} role="status">
      {status === "error" ? <div className="text-center"><p>{t("โหลดแผนที่ไม่สำเร็จ")}</p><button type="button" className="install-action mt-3" onClick={retry}>{t("ลองใหม่")}</button></div>
        : t("กำลังโหลดแผนที่…")}
    </div>}
  </main>;
}
