"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import "./rain.css";
import { useT } from "@/i18n/client";
import { useLite } from "@/hooks/use-lite";
import { useWaterSource } from "@/hooks/use-water-source";
import { SourceTime } from "@/components/ui/source-time";
import { RainTube } from "./rain-tube";
import { observedSummary, stationRegion, rainRegions, periods, nextFrame, type RainTotals } from "@/lib/rain/summary";
import type { DamRain } from "@/lib/rain/dam-model";
import { DAM_REGISTRY } from "@/lib/dams/registry";
import { distanceKm } from "@/lib/storms/normalize";
import { globalPixel } from "@/lib/radar/summary";
import type { RadarManifest } from "@/lib/radar/types";
import type { RainRisk, ReportingRainStation } from "@/lib/rain-risk/tmd";
import type { Place } from "@/lib/place";
import { forceGlFromSearch, glTier, readRendererString, type GlTier } from "@/lib/map/gl-tier";

const RainMap = dynamic(() => import("./rain-map").then((module) => module.RainMap), { ssr: false });
const validRain = (value: RainRisk) => Array.isArray(value.all);
const validRadar = (value: RadarManifest) => Array.isArray(value.frames);
type PlaceRain = { date: string | null; totals: RainTotals; place: { lat: number; lon: number } };
const validModel = (value: PlaceRain) => Array.isArray(value.totals);
const validDams = (value: DamRain[]) => Array.isArray(value);
const emptyStations: ReportingRainStation[] = [];
const emptyTotals: RainTotals = [null, null, null];

export function RainPillar({ place }: { place: Place }) {
  const t = useT();
  const { lite, reducedMotion, device } = useLite();
  const [tier, setTier] = useState<GlTier>("svg");
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [region, setRegion] = useState("");
  const rain = useWaterSource<RainRisk>("/api/rain-risk", validRain);
  const radar = useWaterSource<RadarManifest>("/api/radar", validRadar);
  const model = useWaterSource<PlaceRain>(`/api/wind?rain=1&lat=${place.lat}&lon=${place.lon}`, validModel);
  const nearestDams = [...DAM_REGISTRY].sort((a, b) => distanceKm(place, a) - distanceKm(place, b)).slice(0, 3);
  const ids = nearestDams.map((dam) => dam.id).sort().join(",");
  const damRain = useWaterSource<DamRain[]>(`/api/rain-dams?ids=${ids}`, validDams);
  const currentModel = model.data?.place.lat === place.lat && model.data.place.lon === place.lon ? model.data : null;
  const stations = rain.data?.all ?? emptyStations;
  const summary = observedSummary(stations, place);
  const frames = radar.data?.frames ?? [];
  const index = Math.min(activeIndex, Math.max(0, frames.length - 1));
  const frame = frames[index];
  const newest = frames.at(-1);
  const pixel = globalPixel(place.lon, place.lat, 6);
  const thumbnail = newest?.tileUrl.replace("{z}", "6").replace("{x}", String(Math.floor(pixel.x / 256))).replace("{y}", String(Math.floor(pixel.y / 256)));
  const name = (station: ReportingRainStation) => t.locale === "en" ? station.nameEn : station.nameTh;
  const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(value);
  const onReady = useCallback((value: boolean) => setReady(value), []);

  useEffect(() => {
    let active = true;
    let next: GlTier = "svg";
    if (!lite && !reducedMotion) {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      next = glTier({ lite, reducedMotion, deviceMemory: device.deviceMemory, webgl2: Boolean(gl), rendererString: readRendererString(gl), contextLosses: 0, forceGl: forceGlFromSearch(window.location.search) });
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    }
    queueMicrotask(() => { if (active) setTier(next); });
    return () => { active = false; };
  }, [lite, reducedMotion, device.deviceMemory]);
  const mode = lite || reducedMotion ? "svg" : tier;
  const replaying = playing && mode === "full" && frames.length > 1;
  useEffect(() => {
    if (!replaying) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActiveIndex((current) => nextFrame(current, frames.length));
    }, 900);
    return () => window.clearInterval(timer);
  }, [replaying, frames.length]);

  function tubes(totals: RainTotals) {
    return <div className="grid grid-cols-3 gap-2">{periods.map((period, at) => <div key={period}><p className="text-center text-sm">{t("สะสม {n} วัน", { n: period })}</p><RainTube mm={totals[at]} model /></div>)}</div>;
  }

  return <section className="space-y-4" aria-label={t("ฝนตกสะสม")}>
    <h2 className="text-2xl">{t("ฝนตกสะสม")}</h2>
    <section className="placeholder-card space-y-2" aria-label={t("เรดาร์ฝน")}>
      <div className="relative h-80 overflow-hidden rounded-xl bg-slate-800" data-frame-index={index} data-scene-state={JSON.stringify({ mode, pitch: mode === "svg" ? 0 : 55, frameIndex: index, playing: replaying })}>
        {(!ready || mode === "svg") && <Link href="/map?layer=rain" className="absolute inset-0 flex items-center justify-center" aria-label={t("ดูบนแผนที่")}>
          {/* RainViewer serves an external raster tile, including in lite mode. */}
          {thumbnail ? <Image unoptimized src={thumbnail} alt={t("เรดาร์ฝน")} width={256} height={256} className="h-full w-full object-contain" /> : <span className="text-white">{t("ไม่มีข้อมูลเรดาร์")}</span>}
        </Link>}
        {mode !== "svg" && <RainMap place={place} radar={radar.data} stations={stations} activeIndex={index} tier={mode} onTier={setTier} onReady={onReady} />}
      </div>
      <div className="flex items-center gap-3"><button type="button" className="min-h-11 rounded border border-border px-3" disabled={mode !== "full" || frames.length < 2} aria-pressed={replaying} onClick={() => setPlaying((value) => !value)}>{replaying ? t("หยุดเล่น") : t("เล่น")}</button><input className="min-h-11 min-w-0 flex-1" type="range" aria-label={t("เวลาเรดาร์")} min={0} max={Math.max(0, frames.length - 1)} value={index} disabled={mode === "svg" || !frames.length} onChange={(event) => { setPlaying(false); setActiveIndex(Number(event.target.value)); }} /></div>
      <p><SourceTime source="RainViewer" time={mode === "svg" ? newest?.time : frame?.time} kind="rain24h" /></p>
      {mode !== "svg" && <p className="text-muted text-xs">{t("ภูมิประเทศขยายแนวดิ่ง 1.3 เท่า")}</p>}
    </section>
    <section className="placeholder-card space-y-3" aria-label={t("ภาพรวมประเทศ")}>
      <h3 className="text-lg">{t("ฝน 24 ชม. · ภาพรวมประเทศ")}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><p className="text-sm">{t("สถานีฝนมากสุด")}</p><p>{summary.top ? `${name(summary.top)} · ${number(summary.top.rainMm)} ${t("มม.")}` : t("ไม่มีข้อมูลฝน")}</p><SourceTime source="กรมอุตุฯ" time={rain.data?.observedAt} kind="rain24h" /></div>
        <div><p className="text-sm">{t("สถานีฝนมากกว่า 35 / 90 มม.")}</p><p className="text-xl tabular-nums">{rain.data ? `${number(summary.over35)} / ${number(summary.over90)}` : "— / —"}</p><SourceTime source="กรมอุตุฯ" time={rain.data?.observedAt} kind="rain24h" /></div>
        <div><p className="text-sm">{t("ภาคที่ฝนเฉลี่ยมากสุด")}</p><p>{summary.regions[0] ? `${t(rainRegions[summary.regions[0].region])} · ${number(summary.regions[0].mm)} ${t("มม.")}` : t("ไม่มีข้อมูลฝน")}</p><SourceTime source="กรมอุตุฯ" time={rain.data?.observedAt} kind="rain24h" /></div>
      </div>
      <label className="text-sm">{t("ภาค")} <select value={region} onChange={(event) => setRegion(event.target.value)} className="min-h-11 rounded border border-border bg-card px-2"><option value="">{t("ทุกภาค")}</option>{Object.entries(rainRegions).map(([id, label]) => <option value={id} key={id}>{t(label)}</option>)}</select></label>
      <ol className="space-y-1 text-sm">{stations.filter((station) => !region || stationRegion(station) === region).sort((a, b) => b.rainMm - a.rainMm).slice(0, 3).map((station) => <li key={station.id}>{name(station)} · {number(station.rainMm)} {t("มม.")} <SourceTime source="กรมอุตุฯ" time={rain.data?.observedAt} kind="rain24h" /></li>)}</ol>
      {rain.status === "error" && <p className="text-muted text-sm">{t("ไม่มีข้อมูลฝน")}</p>}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("ใกล้คุณ")}><h3 className="text-lg">{t("ใกล้คุณ")}</h3><p>{summary.near ? name(summary.near) : t("ไม่มีข้อมูลฝน")}</p><RainTube mm={summary.near?.rainMm ?? null} /><SourceTime source="กรมอุตุฯ" time={rain.data?.observedAt} kind="rain24h" /></section>
    <section className="placeholder-card space-y-3" aria-label={t("แบบจำลองฝนสะสม")}><h3 className="text-lg">{t("แบบจำลองฝนสะสม")}</h3><p className="text-sm">{t("สะสมตั้งแต่วันนี้ · กริดแบบจำลอง")}</p>{tubes(currentModel?.totals ?? emptyTotals)}<SourceTime source="Open-Meteo" date={currentModel?.date} kind="model" model /></section>
    <section className="placeholder-card space-y-3" aria-label={t("ฝนรอบเขื่อน (ไม่ใช่ทั้งลุ่มน้ำ)")}><h3 className="text-lg">{t("ฝนรอบเขื่อน (ไม่ใช่ทั้งลุ่มน้ำ)")}</h3><p className="text-muted text-sm">{t("เฉลี่ยจุดกริดในรัศมี 30 กม. · สะสมตั้งแต่วันนี้")}</p>{nearestDams.map((dam) => {
      const data = damRain.data?.find((row) => row.id === dam.id);
      return <div key={dam.id} className="space-y-2 border-t border-border pt-3"><Link href={`/water/dam/${dam.id}`} className="inline-flex min-h-11 items-center text-given underline">{t.locale === "en" ? dam.nameEn : dam.nameTh}</Link>{tubes(data?.totals ?? emptyTotals)}<SourceTime source="Open-Meteo" date={data?.date} kind="model" model /></div>;
    })}</section>
  </section>;
}
