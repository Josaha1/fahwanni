"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLastPlace } from "@/hooks/use-favourites";
import { useT } from "@/i18n/client";
import { formatFullDate, formatTime } from "@/lib/format";
import { pm25Level } from "@/lib/air";
import type { Pm25Grid } from "@/lib/pm25/grid";
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
import { readRadarLevel } from "../radar-tile";

const rainKeys = ["ไม่มีฝน", "ฝนเบา", "ฝนปานกลาง", "ฝนหนัก", "ฝนหนักมาก"] as const;

export function PointCard({ probe, onClose, frame, wind, windHour, pm25, primary, activeStop, nowIso, storms, quakes }: {
  probe: Probe;
  onClose: () => void;
  frame?: RadarFrame;
  wind: WindGrid | null;
  windHour: number;
  pm25: Pm25Grid | null;
  primary: PrimaryLayer;
  activeStop?: TimelineStop;
  nowIso: string;
  storms: Storm[];
  quakes: Quake[];
}) {
  const t = useT();
  const router = useRouter();
  const { place, setPlace } = useLastPlace();
  const heading = useRef<HTMLHeadingElement>(null);
  const [radarLevel, setRadarLevel] = useState<number | null>(null);
  const point = probe.kind === "point" ? pointPlace(probe.lat, probe.lon) : null;
  const province = probe.kind === "point" ? nearestProvince(probe.lat, probe.lon) : null;
  const storm = probe.kind === "storm" ? storms.find((item) => item.id === probe.id) : undefined;
  const quake = probe.kind === "quake" ? quakes.find((item) => item.id === probe.id) : undefined;
  const rain = probe.kind === "point" && wind ? modelRainAt(wind, probe.lon, probe.lat) : null;
  const breeze = probe.kind === "point" && wind ? windAt(wind, windHour, probe.lon, probe.lat) : null;
  const currentTempHour = wind?.tempHours?.findLastIndex((hour) => Date.parse(hour) <= Date.parse(nowIso)) ?? -1;
  const tempHour = primary === "temp" && activeStop ? activeStop.index : currentTempHour;
  const temp = probe.kind === "point" && wind && tempHour >= 0 && wind.temp?.[tempHour] && wind.feels?.[tempHour]
    ? { value: sampleGrid(wind, wind.temp[tempHour], probe.lon, probe.lat), feels: sampleGrid(wind, wind.feels[tempHour], probe.lon, probe.lat) }
    : null;
  const currentPm25Hour = pm25?.hours.findLastIndex((hour) => Date.parse(hour) <= Date.parse(nowIso)) ?? -1;
  const pm25Hour = primary === "pm25" && activeStop ? activeStop.index : currentPm25Hour;
  const pm25Value = probe.kind === "point" && pm25 && pm25Hour >= 0 && pm25.pm25[pm25Hour]
    ? sampleGrid(pm25, pm25.pm25[pm25Hour], probe.lon, probe.lat) : null;

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
  </section>;
}
