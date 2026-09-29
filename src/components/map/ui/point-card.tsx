"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatFullDate, formatTime } from "@/lib/format";
import { pm25Level } from "@/lib/air";
import { sampleSeries, type HourlySeries } from "@/lib/timeline/store";
import { lerpGrid } from "@/lib/timeline/time";
import { WIND_BBOX, WIND_NX, WIND_NY } from "@/lib/wind/grid";
import { modelRainAt, sampleGrid, windAt } from "@/lib/map/probe";
import type { PrimaryLayer } from "@/lib/map/legend";
import type { TimelineStop } from "@/lib/timeline/frames";
import { nearestProvince, pointPlace } from "@/lib/map/nearest";
import { RAIN_RAMP } from "@/lib/map/palette";
import type { Quake } from "@/lib/quakes/usgs";
import type { RadarFrame } from "@/lib/radar/types";
import { distanceKm, type Storm } from "@/lib/storms/normalize";
import { bearingWord, stormCategoryLabel } from "@/lib/storms/present";
import type { WindGrid } from "@/lib/wind/grid";
import { pm25LevelWord, windWord } from "@/lib/words";
import type { Probe } from "../use-probe";
import type { DamsPayload } from "@/lib/dams/client";
import type { Downstream } from "@/lib/dams/paths";
import { provinces } from "@/lib/provinces";
import { damBandColor, damBandWord, stationSituationColor, situationWord } from "@/lib/dams/thaiwater";
import { readRadarLevel } from "../radar-tile";

const rainKeys = ["ไม่มีฝน", "ฝนเบา", "ฝนปานกลาง", "ฝนหนัก", "ฝนหนักมาก"] as const;

function damDate(value: string, locale: "th" | "en") {
  const iso = value.length === 10 ? `${value}T12:00:00+07:00` : value;
  return new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist-nu-latn" : "en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function PointCard({ probe, onClose, frame, wind, windHour, pm25Series, primary, activeStop, nowIso, storms, quakes, dams,
  downstream, pathActive, pathLoading, onTogglePath }: {
  probe: Probe;
  onClose: () => void;
  frame?: RadarFrame;
  wind: WindGrid | null;
  windHour: number;
  pm25Series: HourlySeries | null;
  primary: PrimaryLayer;
  activeStop?: TimelineStop;
  nowIso: string;
  storms: Storm[];
  quakes: Quake[];
  dams: DamsPayload | null;
  downstream: Downstream | null;
  pathActive: boolean;
  pathLoading: boolean;
  onTogglePath: () => void;
}) {
  const t = useT();
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(t.intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const daily = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 2 });
  const router = useRouter();
  const { place, setPlace } = useLastPlace();
  const heading = useRef<HTMLHeadingElement>(null);
  const [radarLevel, setRadarLevel] = useState<number | null>(null);
  const point = probe.kind === "point" ? pointPlace(probe.lat, probe.lon) : null;
  const province = probe.kind === "point" ? nearestProvince(probe.lat, probe.lon) : null;
  const storm = probe.kind === "storm" ? storms.find((item) => item.id === probe.id) : undefined;
  const quake = probe.kind === "quake" ? quakes.find((item) => item.id === probe.id) : undefined;
  const dam = probe.kind === "dam" ? dams?.dams.find((item) => item.id === probe.id) : undefined;
  const barrage = probe.kind === "dam" && probe.id === dams?.barrage?.id ? dams.barrage : null;
  const selectedDam = dam ?? barrage;
  const rain = probe.kind === "point" && wind ? modelRainAt(wind, probe.lon, probe.lat) : null;
  const breeze = probe.kind === "point" && wind ? windAt(wind, windHour, probe.lon, probe.lat) : null;
  const currentTempHour = wind?.tempHours?.findLastIndex((hour) => Date.parse(hour) <= Date.parse(nowIso)) ?? -1;
  const tempHour = primary === "temp" && activeStop ? wind?.tempHours?.indexOf(activeStop.time) ?? -1 : currentTempHour;
  const temp = probe.kind === "point" && wind && tempHour >= 0 && wind.temp?.[tempHour] && wind.feels?.[tempHour]
    ? { value: sampleGrid(wind, wind.temp[tempHour], probe.lon, probe.lat), feels: sampleGrid(wind, wind.feels[tempHour], probe.lon, probe.lat) }
    : null;
  const pm25Time = primary === "pm25" && activeStop ? Date.parse(activeStop.time) : Date.parse(nowIso);
  const pm25Sample = pm25Series ? sampleSeries(pm25Series, "pm25", pm25Time) : null;
  const pm25Values = pm25Sample ? (pm25Sample.exact ? pm25Sample.a : lerpGrid(pm25Sample.a, pm25Sample.b, pm25Sample.f)) : null;
  const pm25Value = probe.kind === "point" && pm25Values
    ? sampleGrid({ bbox: WIND_BBOX, nx: WIND_NX, ny: WIND_NY }, pm25Values, probe.lon, probe.lat) : null;

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
  else if (probe.kind === "dam") title = t("ไม่พบข้อมูลเขื่อนนี้");

  return <section className="map-panel map-point-card mt-3" aria-live="polite">
    <div className="flex items-start justify-between gap-2">
      <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold">{title}</h2>
      <button type="button" className="map-icon-btn shrink-0" aria-label={t("ปิดการ์ด")} onClick={onClose}>✕</button>
    </div>
    {point && province && <>
      <p className="map-muted text-sm">{probe.kind === "point" && `${probe.lat.toFixed(2)}, ${probe.lon.toFixed(2)}`}{province.km <= 100 && <> · {t("ห่างจาก{province} {km} กม.", { province: t.locale === "en" ? province.en : province.th, km: Math.round(province.km) })}</>}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-3"><dt>{t("ฝนตอนนี้")}</dt><dd className="flex items-center gap-2 font-semibold">
          {radarLevel !== null && radarLevel > 0 && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: RAIN_RAMP[radarLevel] }} aria-hidden="true" />}
          {!frame ? t("ไม่ทราบ") : radarLevel === null ? t("กำลังโหลด…") : radarLevel < 0 ? t("ไม่ทราบ") : t(rainKeys[radarLevel])}
        </dd></div>
        <div className="flex justify-between gap-3"><dt>{t("ฝน 3 ชม. ข้างหน้า")}</dt><dd className="text-right font-semibold">{!rain || rain.level === 0 ? t("ไม่มีฝน") : t("{rain} ราว {time} น.", { rain: t(rainKeys[rain.level]), time: wind?.precipHours?.[rain.hourIndex] ? formatTime(wind.precipHours[rain.hourIndex], "Asia/Bangkok", t.locale) : "" })}</dd></div>
        {temp && temp.value !== null && temp.feels !== null && <div className="flex justify-between gap-3"><dt>{t("อุณหภูมิ")}</dt><dd className="text-right font-semibold">{t("{temp}° รู้สึกเหมือน {feels}°", { temp: Math.round(temp.value), feels: Math.round(temp.feels) })}</dd></div>}
        {pm25Value !== null && <div className="flex justify-between gap-3"><dt>{t("ฝุ่น PM2.5")}</dt><dd className="text-right font-semibold">
          {t("{v} µg/m³ · {level}", { v: Math.round(pm25Value), level: pm25LevelWord(pm25Level(pm25Value), t) })}
          <small className="map-muted block font-normal">{t("ค่าประมาณจากแบบจำลอง (CAMS)")}</small>
        </dd></div>}
        <div className="flex justify-between gap-3"><dt>{t("ลม")}</dt><dd className="text-right font-semibold">{breeze ? t("{wind} {speed} กม./ชม. จากทิศ{bearing}", { wind: windWord(breeze.speedKmh, t), speed: breeze.speedKmh, bearing: bearingWord(breeze.fromDeg, t) }) : t("ไม่ทราบ")}</dd></div>
      </dl>
      <button type="button" className="map-chip mt-3 w-full" onClick={() => { setPlace(point); router.push("/"); }}>{t("ดูพยากรณ์เต็ม")}</button>
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
        // ThaiWater's agency is the reporting agency (RID for EGAT dams too), so it is not shown.
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
        {dam.usablePct !== null && <p className="map-muted">{t("ใช้การได้ {pct}%", { pct: percent.format(dam.usablePct) })}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
          <p className="map-muted">{t("น้ำไหลเข้า")}</p>
          <p className="font-semibold">{dam.inflowCms === null ? "–" : t("{value} ลบ.ม./วินาที", { value: number.format(dam.inflowCms) })}</p>
          <p className="map-muted text-xs">{dam.inflowMcmDay === null ? "–" : t("{value} ล้าน ลบ.ม./วัน", { value: daily.format(dam.inflowMcmDay) })}</p>
        </div>
        <div className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
          <p className="map-muted">{t("ระบายออก")}</p>
          <p className="font-semibold">{dam.releaseCms === null ? "–" : t("{value} ลบ.ม./วินาที", { value: number.format(dam.releaseCms) })}</p>
          <p className="map-muted text-xs">{dam.releaseMcmDay === null ? "–" : t("{value} ล้าน ลบ.ม./วัน", { value: daily.format(dam.releaseMcmDay) })}</p>
        </div>
      </div>
      {dam.spilledMcmDay !== null && dam.spilledMcmDay > 0 && <p className="map-warning">{t("น้ำล้นทางระบายน้ำล้น {value} ล้าน ลบ.ม./วัน", { value: daily.format(dam.spilledMcmDay) })}</p>}
      <p className="map-muted">{t("ข้อมูลวันที่ {date}", { date: damDate(dam.date, t.locale) })}{dams?.stale && <span className="map-warning"> {t("(ข้อมูลอาจล่าช้า)")}</span>}</p>
      <p className="map-muted text-xs">{t("ที่มา: คลังข้อมูลน้ำแห่งชาติ (สสน.)")}</p>
      <p className="map-muted text-xs">{t("เส้นทางน้ำท้ายเขื่อน (ปุ่มด้านล่าง) ไม่ใช่ขอบเขตน้ำท่วม")}</p>
      <button type="button" className="map-chip w-full" aria-pressed={pathActive} aria-busy={pathLoading} onClick={onTogglePath}>
        {t(pathActive ? "ซ่อนทิศทางน้ำ" : "ดูทิศทางน้ำท้ายเขื่อน")}
      </button>
      {pathActive && downstream && <DownstreamDetails downstream={downstream} dams={dams} />}
    </div>}
    {barrage && <div className="mt-2 space-y-3 text-sm">
      <p className="map-muted">{t("ลำน้ำเจ้าพระยา · จ.ชัยนาท")}</p>
      <div className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
        <p className="map-muted">{t("ระบายท้ายเขื่อน")}</p>
        <p className="font-semibold">{barrage.dischargeCms === null ? "–" : t("{value} ลบ.ม./วินาที", { value: number.format(barrage.dischargeCms) })}</p>
      </div>
      <p className="map-muted">{barrage.qmaxCms === null ? "–" : t("ความจุลำน้ำ ~{value} ลบ.ม./วินาที", { value: number.format(barrage.qmaxCms) })}</p>
      {barrage.dischargeCms !== null && barrage.qmaxCms !== null && barrage.qmaxCms > 0 && <div className="h-[10px] rounded-full" style={{ backgroundColor: "var(--map-panel-border)" }} role="meter" aria-label={t("สัดส่วนการระบายต่อความจุลำน้ำ")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(barrage.dischargeCms / barrage.qmaxCms * 100, 100)}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(barrage.dischargeCms / barrage.qmaxCms * 100, 100)}%`, backgroundColor: stationSituationColor(barrage.situation) ?? "var(--map-muted)" }} />
      </div>}
      <p style={{ color: stationSituationColor(barrage.situation) ?? undefined }}>{t("สถานการณ์: {situation}", { situation: barrage.situation === null ? t("ไม่ทราบ") : t(situationWord(barrage.situation) ?? "ไม่ทราบ") })}</p>
      <p className="map-muted">{t("ข้อมูลวันที่ {date}", { date: damDate(barrage.time, t.locale) })} · {formatTime(barrage.time, "Asia/Bangkok", t.locale)}{dams?.stale && <span className="map-warning"> {t("(ข้อมูลอาจล่าช้า)")}</span>}</p>
      <p className="map-muted text-xs">{t("ที่มา: คลังข้อมูลน้ำแห่งชาติ (สสน.)")}</p>
      <p className="map-muted text-xs">{t("เส้นทางน้ำท้ายเขื่อน (ปุ่มด้านล่าง) ไม่ใช่ขอบเขตน้ำท่วม")}</p>
      <button type="button" className="map-chip w-full" aria-pressed={pathActive} aria-busy={pathLoading} onClick={onTogglePath}>
        {t(pathActive ? "ซ่อนทิศทางน้ำ" : "ดูทิศทางน้ำท้ายเขื่อน")}
      </button>
      {pathActive && downstream && <DownstreamDetails downstream={downstream} dams={dams} />}
    </div>}
  </section>;
}

function DownstreamDetails({ downstream, dams }: { downstream: Downstream; dams: DamsPayload | null }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const stationByCode = new Map(dams?.stations.map((station) => [station.code, station]) ?? []);
  const provinceById = new Map(provinces.map((province) => [province.id, province]));
  const items = [
    ...downstream.stations.map((station) => ({ kind: "station" as const, ...station })),
    ...downstream.provinces.map((province) => ({ kind: "province" as const, ...province })),
  ].sort((a, b) => a.km - b.km);
  return <div className="space-y-3">
    <p>{t("น้ำที่ระบายจะไหลไปตามลำน้ำนี้ ระดับน้ำท้ายเขื่อนอาจสูงขึ้นในช่วง 1–3 วัน ติดตามประกาศจากกรมชลประทาน/ปภ. ในพื้นที่")}</p>
    <div>
      <h3 className="font-semibold">{t("ลำน้ำท้ายเขื่อน ({km} กม.)", { km: number.format(downstream.km) })}</h3>
      <ol className="mt-2 space-y-2">
        {(showAll ? items : items.slice(0, 12)).map((item) => {
          if (item.kind === "province") {
            const province = provinceById.get(item.id);
            if (!province) return null;
            return <li key={`province-${item.id}`} className="flex justify-between gap-2">
              <strong>{t("จ.{province}", { province: t.locale === "en" ? province.en : province.th })}</strong>
              <span className="map-muted shrink-0">{t("{km} กม.", { km: number.format(item.km) })}</span>
            </li>;
          }
          const station = stationByCode.get(item.code);
          return <li key={`station-${item.code}`} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <span className="font-semibold">{station ? `${station.nameTh}${station.nameTh.includes("(") ? "" : ` (${item.code})`}` : item.code}</span>
              {station ? <span className={`mt-0.5 flex items-center gap-1.5 text-xs${station.situation === null ? " map-muted" : ""}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stationSituationColor(station.situation) ?? "var(--map-muted)" }} aria-hidden="true" />
                {station.situation === null ? t("ไม่มีข้อมูลล่าสุด") : t(situationWord(station.situation) ?? "ไม่ทราบ")}
                {station.pctBank !== null && <> · {t("{pct}% ของตลิ่ง", { pct: number.format(station.pctBank) })}</>}
              </span> : <span className="map-muted block text-xs">{t("ไม่มีข้อมูลล่าสุด")}</span>}
            </span>
            <span className="map-muted shrink-0">{t("{km} กม.", { km: number.format(item.km) })}</span>
          </li>;
        })}
      </ol>
      {!showAll && items.length > 12 && <button type="button" className="map-chip mt-2 w-full" onClick={() => setShowAll(true)}>
        {t("แสดงทั้งหมด ({n})", { n: items.length })}
      </button>}
    </div>
    <details className="rounded-xl border p-2" style={{ borderColor: "var(--map-panel-border)" }}>
      <summary className="cursor-pointer font-semibold">{t("กรณีเขื่อนแตก (สมมติ)")}</summary>
      <p className="mt-2">{t("แอปนี้ไม่มีข้อมูลจำลองเขื่อนแตก หากมีประกาศเตือน ให้ปฏิบัติตามคำสั่งอพยพของทางราชการทันที ขึ้นที่สูง ออกห่างจากลำน้ำ")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a className="map-chip inline-flex items-center" href="tel:1784">{t("โทร ปภ. 1784")}</a>
        <a className="map-chip inline-flex items-center" href="tel:1460">{t("โทร กรมชลประทาน 1460")}</a>
      </div>
    </details>
    <p className="map-muted text-xs">{t("เส้นนี้คือแนวลำน้ำท้ายเขื่อน ไม่ใช่ขอบเขตน้ำท่วม ฟ้าวันนี้ไม่พยากรณ์พื้นที่น้ำท่วม")}</p>
    <p className="map-muted text-xs">{t("เส้นทางน้ำ: HydroRIVERS (CC BY 4.0)")}</p>
  </div>;
}
