"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLastPlace } from "@/hooks/use-favourites";
import type { Place } from "@/lib/place";
import { useT } from "@/i18n/client";
import { formatFullDate, formatTime } from "@/lib/format";
import { EMERGENCY_NUMBERS } from "@/lib/emergency";
import { pm25Level } from "@/lib/air-level";
import { type HourlySeries } from "@/lib/timeline/store";
import { modelRainLevelAt, pointHours, seriesValueAt } from "@/lib/timeline/values";
import { PointDayChart } from "./point-day-chart";
import { SourceTime } from "@/components/ui/source-time";
import { ChartTable } from "@/components/ui/chart-table";
import { damSparklineSummary, dayLabel } from "@/lib/chart-summaries";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/constants";
import { modelRainAt, sampleGrid, windAt, windAtField } from "@/lib/map/probe";
import { nearestProvince, pointPlace } from "@/lib/map/nearest";
import { RAIN_RAMP } from "@/lib/map/palette";
import type { Quake } from "@/lib/quakes/usgs";
import type { RadarFrame } from "@/lib/radar/types";
import { distanceKm, type Storm } from "@/lib/storms/normalize";
import { bearingWord, stormCategoryLabel } from "@/lib/storms/present";
import type { WindGrid } from "@/lib/wind/grid";
import type { WindField } from "@/lib/wind/field";
import { pm25LevelWord, windWord } from "@/lib/words";
import type { Probe } from "../use-probe";
import type { DamsPayload } from "@/lib/dams/client";
import type { Dam } from "@/lib/dams/types";
import { trendDelta, type DamTrend } from "@/lib/dams/trend";
import type { DamHistory } from "@/lib/dams/history";
import type { WaterWatch } from "@/lib/water/watchlist";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import type { Downstream } from "@/lib/dams/paths";
import { provinces } from "@/lib/provinces";
import { damBandColor, damBandWord } from "@/lib/dams/bands";
import { readRadarLevel } from "../radar-tile";
import { RiverDetails, type RiversPayload } from "@/components/water/river-details";
import { riverWatchValue } from "@/lib/rivers/observed";
import { isStale } from "@/lib/dams/dwr";
import { reservoirKindWord, type ReservoirPoint } from "@/lib/dams/reservoirs";
import type { FloodEvent } from "@/lib/water/flood-events";
import { FLOOD_RISK_COLORS, FLOOD_RISK_LEVEL_WORDS, type FloodRiskPoint } from "@/lib/water/flood-risk";
import { FloodEventItem, FLOOD_EVENT_WORDS } from "@/components/water/flood-events";

const rainKeys = ["ไม่มีฝน", "ฝนเบา", "ฝนปานกลาง", "ฝนหนัก", "ฝนหนักมาก"] as const;

function damDate(value: string, locale: "th" | "en") {
  const iso = value.length === 10 ? `${value}T12:00:00+07:00` : value;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist-nu-latn" : "en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function PointCard({ probe, favourites, onClose, frame, wind, windHour, windField, windSeries, pm25Series, timeMs, nowMs, timeLabel, storms, quakes, dams, damsTrend, damsHistory, rainRisk,
  rivers, riversStatus, reservoirs = null, floodEvents = null, floodRisk = null, waterDay, watch, onToggleWatch, onToggleRiverWatch, downstream, pathActive, pathLoading, onTogglePath, onSelectDam }: {
  probe: Probe;
  favourites: Place[];
  onClose: () => void;
  frame?: RadarFrame;
  wind: WindGrid | null;
  windHour: number;
  windField: WindField | null;
  windSeries: HourlySeries | null;
  pm25Series: HourlySeries | null;
  /** The minute shown on the map; values are interpolated between model hours. */
  timeMs: number;
  nowMs: number;
  /** Same wording as the time bar, e.g. "พ. 14:37 · พยากรณ์ · ค่าประมาณระหว่างชั่วโมง". */
  timeLabel: string;
  storms: Storm[];
  quakes: Quake[];
  dams: DamsPayload | null;
  damsTrend: DamTrend | null;
  damsHistory: DamHistory | null;
  rivers: RiversPayload | null;
  riversStatus: "idle" | "loading" | "ready" | "error";
  /** DWR reservoirs + OSM dams (water mode, "เขื่อน/อ่างทั้งหมด"). */
  reservoirs?: ReservoirPoint[] | null;
  floodEvents?: FloodEvent[] | null;
  floodRisk?: globalThis.Map<string, FloodRiskPoint> | null;
  waterDay: number;
  watch: WaterWatch;
  onToggleWatch: (dam: Dam) => void;
  onToggleRiverWatch: (id: string) => void;
  rainRisk: RainRisk | null;
  downstream: Downstream | null;
  pathActive: boolean;
  pathLoading: boolean;
  onTogglePath: () => void;
  /** Opens a dam listed on a river card (upstream dams). */
  onSelectDam?: (id: string) => void;
}) {
  const t = useT();
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const daily = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 2 });
  const router = useRouter();
  const { place, setPlace } = useLastPlace();
  const heading = useRef<HTMLHeadingElement>(null);
  const [radarLevel, setRadarLevel] = useState<number | null>(null);
  const point = probe.kind === "point" ? favourites.find((item) => item.lat === probe.lat && item.lon === probe.lon) ?? pointPlace(probe.lat, probe.lon) : null;
  const province = probe.kind === "point" ? nearestProvince(probe.lat, probe.lon) : null;
  const storm = probe.kind === "storm" ? storms.find((item) => item.id === probe.id) : undefined;
  const quake = probe.kind === "quake" ? quakes.find((item) => item.id === probe.id) : undefined;
  const dam = probe.kind === "dam" ? dams?.dams.find((item) => item.id === probe.id) : undefined;
  const damTrend = dam && damsTrend?.dates.at(-1) === dam.date ? damsTrend?.pct[dam.id] : undefined;
  const damHistory = dam && damsHistory?.dataDate === dam.date ? damsHistory : null;
  const historyRows = dam && damHistory ? ([
    { label: "ปีที่แล้ว ({date}) {pct}% · วันนี้ต่างไป {change}", entry: damHistory.lastYear },
    { label: "ปี 2554 ({date}) {pct}% · วันนี้ต่างไป {change}", entry: damHistory.year2554 },
  ] as const).flatMap(({ label, entry }) => {
    const value = entry?.pct[dam.id];
    if (!entry || value === undefined) return [];
    const difference = dam.storagePct - value;
    const change = `${difference >= 0 ? "+" : ""}${percent.format(difference)}`;
    return [{ label, date: entry.date, value, change }];
  }) : [];
  const rainStation = probe.kind === "rain" ? rainRisk?.stations.find((item) => item.id === probe.id) : undefined;
  const river = probe.kind === "river" ? rivers?.points.find((item) => item.id === probe.id) : undefined;
  const reservoir = probe.kind === "reservoir" ? reservoirs?.find((item) => item.id === probe.id) : undefined;
  const floodEvent = probe.kind === "floodEvent" ? floodEvents?.find((item) => item.id === probe.id) : undefined;
  const riskPoint = probe.kind === "floodRisk" ? floodRisk?.get(probe.id) : undefined;
  const upstream = river?.downstreamOfDam ? dams?.dams.find((item) => item.id === river.downstreamOfDam) : undefined;
  const selectedDam = dam;
  const future = timeMs > nowMs;
  const geo = { bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY };
  // "Next 3 hours" only makes sense when the map shows now.
  const rain = probe.kind === "point" && wind && !future && Math.abs(timeMs - nowMs) < 5 * 60_000 ? modelRainAt(wind, probe.lon, probe.lat) : null;
  const modelRain = probe.kind === "point" && future ? modelRainLevelAt(windSeries, timeMs, probe.lon, probe.lat, geo) : null;
  const breeze = probe.kind === "point" ? windField ? windAtField(windField, probe.lon, probe.lat)
    : wind ? windAt(wind, windHour, probe.lon, probe.lat) : null : null;
  const legacyTempHour = wind?.tempHours?.findLastIndex((hour) => Date.parse(hour) <= timeMs) ?? -1;
  const temp = probe.kind === "point"
    ? windSeries?.grids.temp
      ? { value: seriesValueAt(windSeries, "temp", timeMs, probe.lon, probe.lat, geo), feels: seriesValueAt(windSeries, "feels", timeMs, probe.lon, probe.lat, geo) }
      : wind && legacyTempHour >= 0 && wind.temp?.[legacyTempHour] && wind.feels?.[legacyTempHour]
        ? { value: sampleGrid(wind, wind.temp[legacyTempHour], probe.lon, probe.lat), feels: sampleGrid(wind, wind.feels[legacyTempHour], probe.lon, probe.lat) }
        : null
    : null;
  const pm25Value = probe.kind === "point" ? seriesValueAt(pm25Series, "pm25", timeMs, probe.lon, probe.lat, geo) : null;

  useEffect(() => { heading.current?.focus(); }, [probe]);
  useEffect(() => {
    if (probe.kind !== "point" || !frame) return;
    let active = true;
    readRadarLevel(frame, probe.lon, probe.lat).then((level) => { if (active) setRadarLevel(level); });
    return () => { active = false; };
  }, [probe, frame]);

  let title = "";
  if (point) title = t.locale === "en" ? point.admin ?? point.name : point.name;
  else if (storm) title = t("{category} {name}", { category: stormCategoryLabel(storm, t), name: storm.name });
  else if (quake) title = t("แผ่นดินไหว M{mag}", { mag: quake.mag });
  else if (selectedDam) title = t.locale === "en" ? selectedDam.nameEn || selectedDam.nameTh : selectedDam.nameTh;
  else if (rainStation) title = t.locale === "en" ? rainStation.nameEn || rainStation.nameTh : rainStation.nameTh;
  else if (river) title = t.locale === "en" ? river.nameEn || river.nameTh : river.nameTh;
  else if (reservoir) title = (t.locale === "en" ? reservoir.nameEn || reservoir.nameTh : reservoir.nameTh) || t("เขื่อน/ฝาย (ไม่มีชื่อ)");
  else if (probe.kind === "reservoir") title = t("ไม่พบข้อมูลแหล่งน้ำนี้");
  else if (floodEvent) title = t(FLOOD_EVENT_WORDS[floodEvent.type]);
  else if (probe.kind === "floodEvent") title = t("ไม่พบข้อมูลเหตุการณ์นี้");
  else if (riskPoint) title = riskPoint.village || t("หมู่บ้านเสี่ยงน้ำท่วม");
  else if (probe.kind === "dam") title = t("ไม่พบข้อมูลเขื่อนนี้");
  else if (probe.kind === "rain") title = t("ไม่พบข้อมูลฝนของสถานีนี้");
  else if (probe.kind === "river") title = t("แม่น้ำใกล้คุณ");

  return <section className="map-panel map-point-card mt-3" aria-live="polite">
    <div className="flex items-start justify-between gap-2">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">{title}</h2>
      <div className="flex shrink-0 gap-1">
        {dam && <button type="button" className="map-icon-btn" aria-pressed={Object.hasOwn(watch, `dam:${dam.id}`)}
          aria-label={t(Object.hasOwn(watch, `dam:${dam.id}`) ? "เลิกติดตามเขื่อนนี้" : "ติดตามเขื่อนนี้")}
          onClick={() => onToggleWatch(dam)}>{Object.hasOwn(watch, `dam:${dam.id}`) ? "★" : "☆"}</button>}
        {river && riverWatchValue(river) && <button type="button" className="map-icon-btn" aria-pressed={Object.hasOwn(watch, `river:${river.id}`)}
          aria-label={t(Object.hasOwn(watch, `river:${river.id}`) ? "เลิกติดตามแม่น้ำนี้" : "ติดตามแม่น้ำนี้")}
          onClick={() => onToggleRiverWatch(river.id)}>{Object.hasOwn(watch, `river:${river.id}`) ? "★" : "☆"}</button>}
        <button type="button" className="map-icon-btn" aria-label={t("ปิดการ์ด")} onClick={onClose}>✕</button>
      </div>
    </div>
    {point && province && <>
      <p className="map-muted text-xs">{t("ข้อมูล ณ {time}", { time: timeLabel })}</p>
      <p className="map-muted text-sm">{probe.kind === "point" && `${probe.lat.toFixed(2)}, ${probe.lon.toFixed(2)}`}{province.km <= 100 && <> · {t("ห่างจาก{province} {km} กม.", { province: t.locale === "en" ? province.en : province.th, km: Math.round(province.km) })}</>}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {future
          ? <div className="flex justify-between gap-3"><dt>{t("ฝน (พยากรณ์)")}</dt><dd className="flex items-center gap-2 font-semibold">
            {modelRain !== null && modelRain > 0 && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: RAIN_RAMP[modelRain] }} aria-hidden="true" />}
            {modelRain === null ? t("ไม่มีข้อมูล") : t(rainKeys[modelRain])}
          </dd></div>
          : <div className="flex justify-between gap-3"><dt>{t("ฝน (เรดาร์)")}</dt><dd className="flex items-center gap-2 font-semibold">
            {radarLevel !== null && radarLevel > 0 && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: RAIN_RAMP[radarLevel] }} aria-hidden="true" />}
            {!frame ? t("ไม่ทราบ") : radarLevel === null ? t("กำลังโหลด…") : radarLevel < 0 ? t("ไม่ทราบ") : t(rainKeys[radarLevel])}
          </dd></div>}
        {rain && <div className="flex justify-between gap-3"><dt>{t("ฝน 3 ชม. ข้างหน้า")}</dt><dd className="text-right font-semibold">{rain.level === 0 ? t("ไม่มีฝน") : t("{rain} ราว {time} น.", { rain: t(rainKeys[rain.level]), time: wind?.precipHours?.[rain.hourIndex] ? formatTime(wind.precipHours[rain.hourIndex], "Asia/Bangkok", t.locale) : "" })}</dd></div>}
        {temp && temp.value !== null && temp.feels !== null && <div className="flex justify-between gap-3"><dt>{t("อุณหภูมิ")}</dt><dd className="text-right font-semibold">{t("{temp}° รู้สึกเหมือน {feels}°", { temp: Math.round(temp.value), feels: Math.round(temp.feels) })}</dd></div>}
        {pm25Value !== null && <div className="flex justify-between gap-3"><dt>{t("ฝุ่น PM2.5")}</dt><dd className="text-right font-semibold">
          {t("{v} µg/m³ · {level}", { v: Math.round(pm25Value), level: pm25LevelWord(pm25Level(pm25Value), t) })}
          <small className="map-muted block font-normal">{t("ค่าประมาณจากแบบจำลอง (CAMS)")}</small>
        </dd></div>}
        <div className="flex justify-between gap-3"><dt>{t("ลม")}</dt><dd className="text-right font-semibold">{breeze ? t("{wind} {speed} กม./ชม. จากทิศ{bearing}", { wind: windWord(breeze.speedKmh, t), speed: breeze.speedKmh, bearing: bearingWord(breeze.fromDeg, t) }) : t("ไม่ทราบ")}</dd></div>
      </dl>
      {probe.kind === "point" && <PointDayChart hours={pointHours(windSeries, Math.max(timeMs, nowMs), probe.lon, probe.lat, geo)} />}
      <button type="button" className="map-chip mt-3 w-full" onClick={() => { setPlace(point); router.push("/rain"); }}>{t("ดูพยากรณ์เต็ม")}</button>
    </>}
    {storm && <div className="mt-2 space-y-1 text-sm">
      {storm.windKmh !== undefined && <p>{t("ลมสูงสุด {speed} กม./ชม.", { speed: storm.windKmh })}</p>}
      {storm.pressureHpa !== undefined && <p>{t("ความกดอากาศ {pressure} hPa", { pressure: storm.pressureHpa })}</p>}
      <p>{t("ห่างจากตำแหน่งของคุณ {km} กม.", { km: Math.round(distanceKm(place, storm.position)) })}</p>
      {storm.url && <a href={storm.url} target="_blank" rel="noopener noreferrer" className="underline">{t("ดูข้อมูลพายุ")}</a>}
    </div>}
    {quake && <div className="mt-2 space-y-1 text-sm">
      <p>{quake.place}</p>
      <p>{formatTime(quake.time, "Asia/Bangkok", t.locale)}{new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date(quake.time)) !== new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()) ? ` · ${formatFullDate(quake.time, "Asia/Bangkok", t.locale)}` : ""}</p>
      <p>{t("ลึก {depth} กม.", { depth: quake.depthKm })}</p>
      {quake.tsunami && <p className="font-semibold">{t("มีประกาศเตือนสึนามิ")}</p>}
      {quake.url && <a href={quake.url} target="_blank" rel="noopener noreferrer" className="underline">{t("ดูข้อมูล USGS")}</a>}
    </div>}
    {dam && <div className="mt-2 space-y-3 text-sm">
      <p className="map-muted">{[
        t.locale === "en" ? dam.basin.en || dam.basin.th : dam.basin.th,
        t("จ.{province}", { province: t.locale === "en" ? dam.province.en || dam.province.th : dam.province.th }),
      ].filter(Boolean).join(" · ")}</p>
      {dam.highRelease && <span className="inline-block rounded-full bg-[#e5484d] px-2 py-0.5 text-xs font-semibold text-white">{t("ระบายน้ำมาก")}</span>}
      <div>
        <div className="relative h-[10px] rounded-full" style={{ backgroundColor: "var(--map-panel-border)" }} role="meter" aria-label={t("ปริมาณน้ำในเขื่อน")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.max(dam.storagePct, 0), 100)} aria-valuetext={`${percent.format(dam.storagePct)}%`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(dam.storagePct, 0), 100)}%`, backgroundColor: damBandColor(dam.band) }} />
          {dam.storagePct > 100 && <span className="absolute -top-0.5 right-0 h-[14px] border-r-2" style={{ borderColor: damBandColor(dam.band) }} aria-hidden="true" />}
        </div>
        <p className="mt-1 font-semibold">{percent.format(dam.storagePct)}% · {t(damBandWord(dam.band))}</p>
        <p className="map-muted">{t("{storage} / {capacity} ล้าน ลบ.ม.", { storage: number.format(dam.storageMcm), capacity: number.format(dam.capacityMcm) })}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
          <p className="map-muted">{t("น้ำไหลผ่านเขื่อน (ระบาย)")}</p>
          <p className="font-semibold">{dam.releaseCms === null ? "–" : t("{value} ลบ.ม./วินาที", { value: number.format(dam.releaseCms) })}</p>
          <p className="map-muted text-xs">{dam.releaseMcmDay === null ? "–" : t("{value} ล้าน ลบ.ม./วัน", { value: daily.format(dam.releaseMcmDay) })}</p>
        </div>
        <div className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
          <p className="map-muted">{t("น้ำไหลเข้า")}</p>
          <p className="font-semibold">{dam.inflowCms === null ? "–" : t("{value} ลบ.ม./วินาที", { value: number.format(dam.inflowCms) })}</p>
          <p className="map-muted text-xs">{dam.inflowMcmDay === null ? "–" : t("{value} ล้าน ลบ.ม./วัน", { value: daily.format(dam.inflowMcmDay) })}</p>
        </div>
      </div>
      <button type="button" className="map-chip w-full" aria-pressed={pathActive} aria-busy={pathLoading} onClick={onTogglePath}>
        {t(pathActive ? "ซ่อนทิศทางน้ำ" : "ดูทิศทางน้ำท้ายเขื่อน")}
      </button>
      {pathActive && downstream && <DownstreamDetails downstream={downstream} />}
      <p><SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" nowMs={nowMs} className="map-muted" /></p>
      <details className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
        <summary className="cursor-pointer font-semibold">{t("รายละเอียดเพิ่มเติม")}</summary>
        <div className="mt-2 space-y-3">
          {dam.usablePct !== null && <p className="map-muted">{t("ใช้การได้ {pct}%", { pct: percent.format(dam.usablePct) })}</p>}
          {damTrend && damsTrend && trendDelta(damTrend) !== null && <DamSparkline values={damTrend} dates={damsTrend.dates} color={damBandColor(dam.band)} />}
          {historyRows.length > 0 && <div className="space-y-1">
            {historyRows.map((row) => <p key={row.label}>{t(row.label, { date: damDate(row.date, t.locale), pct: percent.format(row.value), change: row.change })}</p>)}
            <p className="map-muted text-xs">{t("ปริมาณน้ำในเขื่อนอย่างเดียวไม่ได้บอกว่าจะท่วม")}</p>
          </div>}
          {dam.spilledMcmDay !== null && dam.spilledMcmDay > 0 && <p className="map-warning">{t("น้ำล้นทางระบายน้ำล้น {value} ล้าน ลบ.ม./วัน", { value: daily.format(dam.spilledMcmDay) })}</p>}
          {pathActive && downstream && <>
            <p>{t("น้ำที่ระบายจะไหลไปตามลำน้ำนี้ ระดับน้ำท้ายเขื่อนอาจสูงขึ้นในช่วง 1–3 วัน ติดตามประกาศจากกรมชลประทาน/ปภ. ในพื้นที่")}</p>
            <p className="map-muted text-xs">{t("เส้นนี้คือแนวลำน้ำท้ายเขื่อน ไม่ใช่ขอบเขตน้ำท่วม ฟ้าวันนี้ไม่พยากรณ์พื้นที่น้ำท่วม")} · {t("เส้นทางน้ำ: HydroRIVERS (CC BY 4.0)")}</p>
          </>}
          {pathActive && downstream && <DamFailureDetails />}
        </div>
      </details>
    </div>}
    {rainStation && <div className="mt-2 space-y-2 text-sm">
      <p className="map-muted">{rainStation.provinceTh === "กรุงเทพมหานคร" ? t.locale === "en" ? "Bangkok" : rainStation.provinceTh : t("จ.{province}", { province: t.locale === "en" ? provinces.find((item) => item.th === rainStation.provinceTh)?.en ?? rainStation.provinceTh : rainStation.provinceTh })}</p>
      <p className="text-xl font-semibold">{t("{mm} มม. ใน 24 ชม.", { mm: number.format(rainStation.rainMm) })}</p>
      <p className="font-semibold" style={{ color: rainStation.category === "veryHeavy" ? "#6b21a8" : "#a855f7" }}>{t(rainStation.category === "veryHeavy" ? "ฝนหนักมาก" : "ฝนหนัก")}</p>
      <span className="map-water-badge">{t("สังเกต")}</span>
      <p><SourceTime source="TMD" time={rainRisk?.observedAt} kind="rain24h" nowMs={nowMs} className="map-muted" /></p>
      <p className="map-muted text-xs">{t("ฝนเข้าเกณฑ์ฝนหนักไม่ได้แปลว่ามีน้ำท่วม")}</p>
    </div>}
    {river && <RiverDetails point={river} upstream={upstream} mapCard showDisclaimers={false} waterDay={waterDay} dams={dams?.dams ?? []} onSelectDam={onSelectDam} />}
    {reservoir && <ReservoirDetails point={reservoir} nowMs={nowMs} />}
    {riskPoint && <div className="mt-2 space-y-1 text-sm">
      <p className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: FLOOD_RISK_COLORS[riskPoint.level] }} aria-hidden="true" />{t(FLOOD_RISK_LEVEL_WORDS[riskPoint.level])}</p>
      <p>{t("ต.{tambon} อ.{amphoe} จ.{province}", { tambon: riskPoint.tambon, amphoe: riskPoint.amphoe, province: riskPoint.province })}</p>
      <p className="map-muted text-xs">{t("ความเสี่ยงจากประวัติ (ปภ. ข้อมูลปี 2567) ไม่ใช่น้ำท่วมตอนนี้")}</p>
      <p className="map-muted text-xs">{t("ที่มา: กรมป้องกันและบรรเทาสาธารณภัย (CC BY)")}</p>
    </div>}
    {floodEvent && <div className="mt-2"><FloodEventItem event={floodEvent} muted="map-muted" border="var(--map-panel-border)" /></div>}
    {probe.kind === "river" && !river && <p className="map-muted mt-2 text-sm" role="status">{t(riversStatus === "error" ? "ข้อมูลแม่น้ำไม่พร้อมใช้งาน" : riversStatus === "ready" ? "ข้อมูลจุดนี้ไม่พร้อมใช้งาน" : "กำลังโหลดข้อมูลแม่น้ำ…")}</p>}
  </section>;
}

function DamSparkline({ values, dates, color }: { values: (number | null)[]; dates: string[]; color: string }) {
  const t = useT();
  const delta = trendDelta(values);
  if (delta === null) return null;
  const present = values.filter((value): value is number => value !== null);
  const min = Math.min(...present), max = Math.max(...present);
  const y = (value: number) => max === min ? 18 : 30 - (value - min) / (max - min) * 24;
  const x = (index: number) => 4 + index / Math.max(values.length - 1, 1) * 92;
  const segments: string[] = [];
  let segment: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (segment.length > 1) segments.push(segment.join(" "));
      segment = [];
    } else segment.push(`${x(index)},${y(value)}`);
  });
  if (segment.length > 1) segments.push(segment.join(" "));
  const change = `${delta >= 0 ? "+" : ""}${new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(delta)}`;
  return <div className="mt-2">
    <svg className="w-full" height="36" viewBox="0 0 100 36" preserveAspectRatio="none" role="img" aria-label={damSparklineSummary(values, dates, t)}>
      {segments.map((points) => <polyline key={points} points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
    </svg>
    <p className="map-muted text-xs">{t("7 วัน: {change}%", { change })}</p>
    <ChartTable caption={t("ตารางปริมาณน้ำในเขื่อน 7 วัน")}
      columns={[t("วัน"), t("ปริมาณน้ำในเขื่อน (%)")]}
      rows={values.map((value, index) => [dates[index] ? dayLabel(dates[index], t) : "—", value === null ? "—" : new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(value)])} />
  </div>;
}

function DownstreamDetails({ downstream }: { downstream: Downstream }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  // Provinces along the route (no river stations: no source with published terms).
  const items = [...downstream.provinces].sort((a, b) => a.km - b.km);
  return <div>
    <h3 className="font-semibold">{t("ลำน้ำท้ายเขื่อน ({km} กม.)", { km: number.format(downstream.km) })}</h3>
    <ol className="mt-2 space-y-2">
      {(showAll ? items : items.slice(0, 12)).map((item) => {
        const province = provinceById.get(item.id);
        if (!province) return null;
        return <li key={`province-${item.id}`} className="flex justify-between gap-2">
          {/* Bangkok is not a จังหวัด, so it has no "จ." prefix. */}
          <strong>{item.id === "bangkok" ? (t.locale === "en" ? province.en : province.th)
            : t("จ.{province}", { province: t.locale === "en" ? province.en : province.th })}</strong>
          <span className="map-muted shrink-0">{t("{km} กม.", { km: number.format(item.km) })}</span>
        </li>;
      })}
    </ol>
    {!showAll && items.length > 12 && <button type="button" className="map-chip mt-2 w-full" onClick={() => setShowAll(true)}>
      {t("แสดงทั้งหมด ({n})", { n: items.length })}
    </button>}
  </div>;
}

function DamFailureDetails() {
  const t = useT();
  return <details className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
    <summary className="cursor-pointer font-semibold">{t("กรณีเขื่อนแตก (สมมติ)")}</summary>
    <p className="mt-2">{t("แอปนี้ไม่มีข้อมูลจำลองเขื่อนแตก หากมีประกาศเตือน ให้ปฏิบัติตามคำสั่งอพยพของทางราชการทันที ขึ้นที่สูง ออกห่างจากลำน้ำ")}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      {EMERGENCY_NUMBERS.slice(0, 2).map(({ label, number, href }) => <a key={number} className="map-chip inline-flex items-center" href={href}>{t("โทร {name}", { name: t(label) })}</a>)}
    </div>
  </details>;
}

function ReservoirDetails({ point, nowMs }: { point: ReservoirPoint; nowMs: number }) {
  const t = useT();
  const volume = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 2 });
  const pct = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const date = point.measuredAt && new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })
    .format(new Date(`${point.measuredAt}T12:00:00+07:00`));
  const stale = isStale(point.measuredAt, nowMs);
  const owner = point.owner === "RID" ? "กรมชลประทาน" : point.owner === "DWR" ? "กรมทรัพยากรน้ำ" : null;
  return <div className="mt-2 space-y-1 text-sm">
    <p className="map-muted text-xs">{t(reservoirKindWord(point.kind))}{owner && ` · ${t("ดูแลโดย{owner}", { owner: t(owner) })}`}</p>
    {point.source === "osm" ? <p>{t("ตำแหน่งจาก OpenStreetMap · ไม่มีข้อมูลน้ำรายวันที่เปิดให้ใช้")}</p> : point.storageMcm === null
      ? <p>{t("ยังไม่มีข้อมูลปริมาณน้ำ")}</p>
      : <>
        <p className="font-semibold">{point.pct !== null
          ? t("ปริมาณน้ำ {volume} ล้าน ลบ.ม. ({pct}% ของความจุ)", { volume: volume.format(point.storageMcm), pct: pct.format(point.pct) })
          : t("ปริมาณน้ำ {volume} ล้าน ลบ.ม.", { volume: volume.format(point.storageMcm) })}</p>
        {point.pct === null && <p className="map-muted text-xs">{t("ไม่ทราบความจุ จึงไม่แสดงเปอร์เซ็นต์")}</p>}
        {date && <p className={stale ? "map-warning text-xs" : "map-muted text-xs"}>{t(stale ? "ข้อมูลเก่า วันที่ {date}" : "ข้อมูลวันที่ {date}", { date })}</p>}
      </>}
    <p className="map-muted text-xs">{t(point.source === "osm" ? "© OpenStreetMap contributors (ODbL)" : "ที่มา: กรมทรัพยากรน้ำ open data (CC BY)")}</p>
  </div>;
}
