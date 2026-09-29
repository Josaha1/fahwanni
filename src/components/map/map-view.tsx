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
import { advance, DEFAULT_PLAY_SPEED, isPlaySpeed, nextPlaySpeed, PLAY_SPEEDS, type PlaySpeed } from "@/lib/timeline/play";
import { pm25Level } from "@/lib/air";
import { pm25LevelWord } from "@/lib/words";
import { sampleGrid } from "@/lib/map/probe";
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
import { useRainRiskLayer } from "./layers/use-rain-risk-layer";
import { useRainAccumulation } from "./layers/use-rain-accumulation";
import { useDamPathLayer } from "./layers/use-dam-path-layer";
import { FocusChip } from "./ui/focus-chip";
import { loadDamPaths, type DamPath, type Downstream } from "@/lib/dams/paths";
import { readWatch, refreshWatch, toggleWatch, writeWatch } from "@/lib/dams/watchlist";
import type { Dam } from "@/lib/dams/types";
import { useTerrainLayer } from "./layers/use-terrain-layer";
import { usePlateLayer } from "./layers/use-plate-layer";
import { usePlaceMarker } from "./layers/use-place-marker";
import { useIsDesktop } from "./ui/use-is-desktop";
import { MapSheet, type SheetPosition } from "./ui/map-sheet";
import { MapSidePanel } from "./ui/map-side-panel";
import { MapPanelContent } from "./ui/map-panel-content";
import { TimeBar, timeLabelText } from "./ui/time-bar";
import { seriesValueAt } from "@/lib/timeline/values";
import { MapSearchPill } from "./ui/map-search-pill";
import { ActionRail } from "./ui/action-rail";
import { PointCard } from "./ui/point-card";
import { PrimaryPicker } from "./ui/primary-picker";
import { LegendChip } from "./ui/legend-chip";
import { WaterPanel } from "./ui/water-panel";
import { LegendDialog } from "./ui/legend-dialog";
import { ModeSwitch } from "./ui/mode-switch";
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

const scalarGrid = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY };

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
  const { manifest, wind, dams, damsStatus, loadDams, damsTrend, loadDamsTrend, rainRisk, rainRiskStatus, loadRainRisk, tmdWarnings, tmdWarningsStatus, loadTmdWarnings, storms, quakes } = useMapData();
  const [watch, setWatch] = useState(readWatch);
  const toggleDamWatch = (dam: Dam) => setWatch((current) => toggleWatch(current, dam));
  useEffect(() => { writeWatch(watch); }, [watch]);
  const [mapState, dispatch] = useReducer(mapReducer, urlView, (view) => initialMapState({ mode: view.mode,
    primary: view.layer, overlays: view.ov, timeMs: view.t, focus: view.dam ? { kind: "damRoute", damId: view.dam } : null }));
  const { mode, timeMs, playing, primary, rainOn, overlays } = mapState;
  // Water mode shows observed daily dam data only: weather layers and the time bar step aside (their state is kept).
  const water = mode === "water";
  const [rainAccumOn, setRainAccumOn] = useState(true);
  const { probe, select, close, probeCenter } = useProbe(mapInstance, { points: !water });
  const { wind: windOn, storms: stormsOn, quakes: quakesOn, dams: damsOn, terrain: terrainOn } = overlays;
  const rainVisible = !water && primary === "rain" && rainOn;
  const isDesktop = useIsDesktop();
  const [sheetPosition, setSheetPosition] = useState<SheetPosition>(initialSheetPosition);
  const [showAllRainProvinces, setShowAllRainProvinces] = useState(false);
  const focusLayers = useRef(false);
  const legendButton = useRef<HTMLButtonElement>(null);
  const legendDialog = useRef<HTMLDialogElement>(null);
  const [immersive, setImmersive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>(() => {
    try {
      const saved = Number(localStorage.getItem("fah-map-play-speed"));
      return isPlaySpeed(saved) ? saved : DEFAULT_PLAY_SPEED;
    } catch { return DEFAULT_PLAY_SPEED; }
  });
  const changePlaySpeed = () => setPlaySpeed((speed) => {
    const next = nextPlaySpeed(speed);
    try { localStorage.setItem("fah-map-play-speed", String(next)); } catch { /* Keep the speed for this visit only. */ }
    return next;
  });
  const [pathData, setPathData] = useState<{ id: string; path: DamPath; downstream: Downstream } | null>(null);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const frames = useMemo(() => lastRadarFrames(manifest?.provider === "rainviewer" ? manifest.frames : []), [manifest]);
  const radarAge = minutesSinceNewest(frames, nowIso);
  const ageLabel = radarAgeLabel(radarAge, manifest?.stale);
  const nowMs = Date.parse(nowIso);
  const domain = useMemo(() => makeDomain(nowMs), [nowMs]);
  const effectiveTime = timeMs ?? nowMs;
  const { series: windSeries } = useForecastDays({ source: "wind", enabled: true, focusTime: effectiveTime, nowMs });
  const { series: pm25Series, loadedDays: pm25LoadedDays, lastAvailable: pm25LastAvailable, loading: pm25Loading, error: pm25Error } = useForecastDays({ source: "pm25", enabled: !water && primary === "pm25", focusTime: effectiveTime, nowMs });
  // Rain can be shown when there is radar for the past or model rain for the future.
  const radarAvailable = frames.length > 0 || Boolean(windSeries?.grids.precip);
  const rainSource = rainSourceAt(effectiveTime, frames.map((frame) => Date.parse(frame.time)), nowMs);
  // Always the newest frame: "where is the rain now", independent of the scrubber.
  const radarSummary = useRadarSummary(frames.at(-1), place.lon, place.lat);
  const series = useMemo(() => placeSeries(windSeries, nowMs, place, scalarGrid, radarSummary ?? undefined),
    [windSeries, nowMs, place, radarSummary]);
  const seriesSummary = placeSeriesSummary(series, nowIso);
  const legacyTempHour = wind?.tempHours?.findLastIndex((hour) => Date.parse(hour) <= effectiveTime) ?? -1;
  const locationTemp = primary === "temp"
    ? windSeries?.grids.temp
      ? { temp: seriesValueAt(windSeries, "temp", effectiveTime, place.lon, place.lat, scalarGrid), feels: seriesValueAt(windSeries, "feels", effectiveTime, place.lon, place.lat, scalarGrid) }
      : wind && legacyTempHour >= 0 && wind.temp?.[legacyTempHour] && wind.feels?.[legacyTempHour]
        ? { temp: sampleGrid(wind, wind.temp[legacyTempHour], place.lon, place.lat), feels: sampleGrid(wind, wind.feels[legacyTempHour], place.lon, place.lat) }
        : null
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
  useTimeImageLayer(mapInstance, { id: "model-rain", enabled: rainVisible && rainSource.kind === "model", series: windSeries, timeMs: effectiveTime, nowMs, kind: "rain", grid: scalarGrid, beforeSymbol: true, opacity: 1 });
  useTimeImageLayer(mapInstance, { id: "temp", enabled: !water && primary === "temp", series: windSeries, timeMs: effectiveTime, nowMs, kind: "temp", grid: scalarGrid, beforeSymbol: true, opacity: 1 });
  useTimeImageLayer(mapInstance, { id: "pm25", enabled: !water && primary === "pm25", series: pm25Series, timeMs: effectiveTime, nowMs, kind: "pm25", grid: scalarGrid, beforeSymbol: true, opacity: 1 });
  const selectStorm = useCallback((id: string, trigger: HTMLElement) => select({ kind: "storm", id }, trigger), [select]);
  useStormLayer(mapInstance, storms, !water && stormsOn, selectStorm);
  useQuakeLayer(mapInstance, quakes, !water && quakesOn);
  useTerrainLayer(mapInstance, terrainOn, reducedMotion);
  usePlateLayer(mapInstance, device.saveData);
  useDamsLayer(mapInstance, dams, damsOn);
  useRainRiskLayer(mapInstance, rainRisk, water);
  const rainAccumStatus = useRainAccumulation(mapInstance, water && rainAccumOn, nowMs);
  // The route follows `focus`, not the open card: closing the card or tapping the map keeps it.
  const activePathId = damsOn && mapState.focus?.kind === "damRoute" ? mapState.focus.damId : null;
  const activePath = activePathId && pathData?.id === activePathId ? pathData : null;
  const pathLoading = Boolean(activePathId) && pathData?.id !== activePathId;
  const focusDamName = activePathId
    ? (() => {
      const dam = dams?.dams.find((item) => item.id === activePathId);
      return dam ? (t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh) : "";
    })()
    : "";
  const activeRelease = activePath ? dams?.dams.find((dam) => dam.id === activePath.id)?.releaseCms ?? null : null;
  useDamPathLayer(mapInstance, activePath?.path ?? null, activeRelease, isDesktop, reducedMotion);
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
      if (active) { toast.error(t("โหลดเส้นทางน้ำไม่สำเร็จ")); dispatch({ type: "setFocus", focus: null }); }
    });
    return () => { active = false; };
  }, [activePathId, pathData?.id, t]);

  const togglePath = () => {
    if (probe?.kind !== "dam") return;
    dispatch({ type: "setFocus", focus: activePathId === probe.id ? null : { kind: "damRoute", damId: probe.id } });
  };

  useEffect(() => {
    if (primary !== "pm25" || !pm25Error) return;
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
    if (probe?.kind === "dam") loadDamsTrend().catch(() => {});
  }, [probe, loadDamsTrend]);

  useEffect(() => {
    if (!water || damsStatus !== "ready" || !dams) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setWatch((current) => refreshWatch(current, dams.dams));
    });
    return () => { active = false; };
  }, [water, damsStatus, dams]);

  useEffect(() => {
    if (!water || rainRiskStatus !== "idle") return;
    loadRainRisk().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error(t("ข้อมูลฝนหนักไม่พร้อมใช้งาน"));
    });
  }, [water, rainRiskStatus, loadRainRisk, t]);

  useEffect(() => {
    if (water && tmdWarningsStatus === "idle") loadTmdWarnings().catch(() => {});
  }, [water, tmdWarningsStatus, loadTmdWarnings]);

  // A newly opened card expands the sheet once; after that the user can collapse it (the card title
  // stays visible at the top of the collapsed sheet).
  const visibleSheetPosition = sheetPosition;
  const probeKey = probe ? (probe.kind === "point" ? `${probe.lat},${probe.lon}` : `${probe.kind}:${probe.id}`) : null;
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  if (probeKey !== expandedFor) {
    // Adjusting state while rendering (React's documented pattern) instead of in an effect.
    setExpandedFor(probeKey);
    if (probeKey && !isDesktop && sheetPosition !== "half") setSheetPosition("half");
  }

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

  // Playback runs in requestAnimationFrame at `playSpeed` simulated minutes per second; it reads the
  // latest time from a ref so the loop is not restarted on every minute it sets.
  const playTime = useRef(effectiveTime);
  useEffect(() => { playTime.current = effectiveTime; }, [effectiveTime]);
  const playLimit = primary === "pm25" && pm25LoadedDays.includes(4) && pm25LastAvailable !== null ? pm25LastAvailable : null;
  useEffect(() => {
    if (!playing || reducedMotion || (primary === "rain" && !rainOn)) return;
    let frame = 0;
    let last = performance.now();
    let t = playTime.current;
    const tick = (now: number) => {
      if (document.visibilityState !== "visible") { dispatch({ type: "stop" }); return; }
      const dt = Math.min(now - last, 250);
      last = now;
      // Keep sub-minute progress locally; only whole minutes go to state.
      if (roundTo(t, MINUTE) !== roundTo(playTime.current, MINUTE)) t = playTime.current;
      t = advance(t, dt, playSpeed, domain, playLimit).t;
      const minute = roundTo(t, MINUTE);
      if (minute !== roundTo(playTime.current, MINUTE)) { playTime.current = minute; dispatch({ type: "setTime", t: minute }); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, reducedMotion, primary, rainOn, playSpeed, domain, playLimit]);

  const viewQuery = useCallback(() => {
    if (!mapInstance) return null;
    const center = mapInstance.getCenter();
    const query = formatUrlView({ lat: center.lat, lon: center.lng, z: mapInstance.getZoom(), layer: primary,
      t: timeMs === null ? undefined : effectiveTime, ov: overlays, dam: activePathId ?? undefined, mode });
    return query;
  }, [mapInstance, primary, timeMs, effectiveTime, overlays, activePathId, mode]);

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
      <button type="button" className="map-chip map-time-speed" onClick={changePlaySpeed}
        aria-label={t("ความเร็วการเล่น {n} นาทีต่อวินาที", { n: playSpeed })}>×{playSpeed / PLAY_SPEEDS[0]}</button>
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
    {primary === "rain" && <button type="button" disabled={!radarAvailable} aria-pressed={radarAvailable && rainVisible} onClick={() => dispatch({ type: "toggleRain" })} className="map-chip text-sm disabled:opacity-60">
      {radarAvailable ? t("เรดาร์ฝน") : t("เรดาร์ไม่พร้อมใช้งาน")}
    </button>}
    <button type="button" disabled={!wind} aria-pressed={Boolean(wind) && windOn} onClick={() => dispatch({ type: "toggleOverlay", key: "wind" })} className="map-chip text-sm disabled:opacity-60">
      {wind ? t("ลม") : t("ข้อมูลลมไม่พร้อมใช้งาน")}
    </button>
    {storms.length > 0 && <button type="button" aria-pressed={stormsOn} onClick={() => dispatch({ type: "toggleOverlay", key: "storms" })} className="map-chip text-sm">{t("พายุ")} ({storms.length})</button>}
    {quakes.length > 0 && <button type="button" aria-pressed={quakesOn} onClick={() => dispatch({ type: "toggleOverlay", key: "quakes" })} className="map-chip text-sm">{t("แผ่นดินไหว")} ({quakes.length})</button>}
  </>;
  const card = probe && <PointCard key={probe.kind === "point" ? `${probe.kind}-${probe.lat}-${probe.lon}` : `${probe.kind}-${probe.id}`}
    probe={probe} onClose={close} frame={rainSource.kind === "radar" ? frames[rainSource.index] : frames.at(-1)} wind={wind} windHour={windHour} windField={windField} windSeries={windSeries} pm25Series={pm25Series}
    timeMs={effectiveTime} nowMs={nowMs} timeLabel={timeLabelText(t, effectiveTime, domain, { radarTime: rainSource.kind === "radar" ? rainSource.frameTime : undefined, primary, lastAvailable: primary === "pm25" ? pm25LastAvailable ?? undefined : undefined })} storms={storms} quakes={quakes} dams={dams} damsTrend={damsTrend} rainRisk={rainRisk}
    watch={watch} onToggleWatch={toggleDamWatch}
    downstream={probe.kind === "dam" && activePathId === probe.id ? activePath?.downstream ?? null : null}
    pathActive={probe.kind === "dam" && activePathId === probe.id} pathLoading={probe.kind === "dam" && activePathId === probe.id && pathLoading} onTogglePath={togglePath} />;
  const primaryPicker = <PrimaryPicker primary={primary} tempAvailable={Boolean(windSeries?.grids.temp?.length)}
    pm25Loading={pm25Loading} onChange={(next) => {
      dispatch({ type: "setPrimary", primary: next });
    }} />;
  const openLegend = () => legendDialog.current?.showModal();
  const waterPanel = water && <WaterPanel dams={dams} damsStatus={damsStatus} watch={watch} rainRisk={rainRisk} rainRiskStatus={rainRiskStatus} tmdWarnings={tmdWarnings}
    rainAccumOn={rainAccumOn} rainAccumStatus={rainAccumStatus} onToggleRainAccum={() => setRainAccumOn((on) => !on)}
    place={place} placeName={placeName} legendButton={legendButton} onOpenLegend={openLegend}
    showAllRainProvinces={showAllRainProvinces} onShowAllRainProvinces={() => setShowAllRainProvinces(true)}
    onSelectDam={(id) => {
      select({ kind: "dam", id });
      const dam = dams?.dams.find((item) => item.id === id);
      if (dam) mapInstance?.easeTo({ center: [dam.lon, dam.lat], zoom: Math.max(mapInstance.getZoom(), 8), duration: reducedMotion ? 0 : 800 });
    }} onSelectRain={(id) => select({ kind: "rain", id })} />;
  const changeMode = (next: typeof mode) => {
    if (next === mode) return;
    // A weather card does not belong in water mode and a dam card does not belong in weather mode.
    if (probe && (next === "water") !== (probe.kind === "dam" || probe.kind === "rain")) close();
    dispatch({ type: "setMode", mode: next });
  };
  const showLegend = mapState.primary !== "rain" || rainOn;
  const more = <>
    {terrainOk && <button type="button" className="map-chip text-sm" aria-pressed={terrainOn}
      onClick={() => dispatch({ type: "toggleOverlay", key: "terrain" })}>{t("แผนที่ 3 มิติ")}</button>}
    <button type="button" className="map-chip text-sm" aria-pressed={immersive} onClick={toggleFullscreen}>{immersive ? t("ออกจากเต็มจอ") : t("เต็มจอ")}</button>
    <button type="button" className="map-chip text-sm" onClick={shareView}>{t("แชร์มุมมองนี้")}</button>
  </>;
  const panelContent = <MapPanelContent placeName={placeName} compact={compact} desktop={isDesktop} timeline={isDesktop ? null : timeline}
    legend={!isDesktop && showLegend ? <LegendChip variant="strip" primary={mapState.primary} buttonRef={legendButton} onOpen={openLegend} /> : null}
    details={details} primaryPicker={primaryPicker} layers={layers} card={card} water={waterPanel || null} more={isDesktop ? null : more}
    onProbeCenter={(trigger) => probeCenter(trigger)} />;

  return <main className={`map-shell${immersive ? " map-shell--immersive" : ""}`} style={{
    "--map-bg": BASE[theme].bg, "--map-panel": BASE[theme].panel, "--map-panel-border": BASE[theme].panelBorder,
    "--map-label": BASE[theme].label, "--map-muted": BASE[theme].labelMuted, "--map-accent": DATA.pin,
  } as CSSProperties}>
    <div ref={container} className="absolute inset-0" style={{ position: "absolute" }} aria-label={t("แผนที่")} />
    {mapInstance && wind && windOn && !water && status === "ready" && <WindCanvas map={mapInstance} field={windField} animate={motion.animate} count={motion.count} />}
    {!isDesktop && <div className="map-search-position"><MapSearchPill placeName={placeName} /></div>}
    <ModeSwitch mode={mode} onChange={changeMode} />
    {isDesktop && !water && showLegend && <LegendChip variant="floating" primary={mapState.primary} buttonRef={legendButton} onOpen={openLegend} />}
    <LegendDialog mode={mode} primary={mapState.primary} active={{ wind: !water && windOn && Boolean(wind), storms: !water && stormsOn && storms.length > 0, quakes: !water && quakesOn && quakes.length > 0, dams: water && damsStatus === "ready" && Boolean(dams), rainRisk: water && rainRiskStatus === "ready" && Boolean(rainRisk), rainAccum: water && rainAccumOn }}
      dialogRef={legendDialog} triggerRef={legendButton} />
    {isDesktop ? <MapSidePanel>{panelContent}</MapSidePanel> : <MapSheet position={visibleSheetPosition} onPositionChange={setPosition}>{panelContent}</MapSheet>}
    {isDesktop && !water && <div className="map-panel map-time-floating">{timeline}</div>}
    {activePathId && focusDamName && <FocusChip damName={focusDamName} loading={pathLoading}
      onOpen={() => select({ kind: "dam", id: activePathId })} onClear={() => dispatch({ type: "setFocus", focus: null })} />}
    <ActionRail compact={!isDesktop} onLayers={openLayers} terrainOk={terrainOk} terrainOn={terrainOn}
      onTerrain={() => dispatch({ type: "toggleOverlay", key: "terrain" })}
      immersive={immersive} onFullscreen={toggleFullscreen} onShare={shareView} />
    {status !== "ready" && <div className="absolute inset-0 z-20 grid place-items-center" style={{ backgroundColor: BASE[theme].bg, color: BASE[theme].label }} role="status">
      {status === "error" ? <div className="text-center"><p>{t("โหลดแผนที่ไม่สำเร็จ")}</p><button type="button" className="install-action mt-3" onClick={retry}>{t("ลองใหม่")}</button></div>
        : t("กำลังโหลดแผนที่…")}
    </div>}
  </main>;
}
