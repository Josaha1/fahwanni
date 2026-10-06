"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { useWaterSource } from "@/hooks/use-water-source";
import { FollowButton } from "@/components/follow-button";
import { useFollowed } from "@/hooks/use-followed";
import { EmergencyStrip } from "@/components/emergency-strip";
import { SourceTime } from "@/components/ui/source-time";
import { MapBackLink } from "@/components/sheet/map-back-link";
import { ShareButton } from "@/components/share-button";
import { provinceSummaryCard } from "@/components/share/summary-card";
import { ShareExtras } from "@/components/share/share-extras";
import { useFloodReplay } from "@/components/map/use-flood-replay";
import { cloudPercent, waterPoints } from "@/components/sheet/home-data";
import { TmdWarningList } from "@/components/water/tmd-warnings";
import type { Bbox } from "@/lib/water/flood-risk";
import { riverSystemForDam, riverSystems } from "@/lib/rivers/systems";
import { thAttribution } from "@/lib/visuals/th-provinces";
import downstream from "../../../public/data/dam-downstream.json";
import { provinceWarnings, validDams, validFlood, validModel, validRain, validWarnings, type Province } from "./data";
import { useProvinceRisk } from "./use-province-risk";
import { ProvinceMap } from "./province-map";
import "../dams/dam-detail.css";
import "./province-detail.css";

export function ProvinceDetail({ province, bbox }: { province: Province; bbox: Bbox }) {
  const t = useT();
  const [nowMs] = useState(() => Date.now());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const flood = useWaterSource("/api/flood-now", validFlood);
  const dams = useWaterSource("/api/dams", validDams);
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  useFollowed({ dams: dams.data, flood: flood.data, warnings: warnings.data, warningDate: warnings.cachedAt ?? warnings.loadedAt });
  const rain = useWaterSource("/api/rain-risk", validRain);
  // Mounted only on the province route, so the home page never requests this model.
  const model = useWaterSource(`/api/wind?rain=1&lat=${province.lat}&lon=${province.lon}`, validModel);
  const risk = useProvinceRisk(bbox);
  const reports = useFloodReplay(true, nowMs);
  const report = reports.find((entry) => entry.date === selectedDate) ?? reports.at(-1);
  const counts = flood.data?.provinceCounts[province.id];
  const observed = !!counts && counts.sampled > counts.insufficientData + counts.noData;
  const number = (value: number | null | undefined) => value == null ? "—" : new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(value);
  const name = t.locale === "en" ? province.en : province.th;
  const points = observed ? waterPoints(counts) : null;
  const cloud = cloudPercent(counts);
  const maxPoints = Math.max(1, ...Object.values(flood.data?.provinceCounts ?? {}).map(waterPoints));
  const relevantWarnings = provinceWarnings(warnings.data?.items ?? [], province);
  const warningDate = relevantWarnings.length ? relevantWarnings.map((entry) => entry.announcedAt).filter((date): date is string => !!date).sort()[0] : warnings.loadedAt;
  const upstreamIds = Object.entries(downstream.dams).filter(([, entry]) => entry.provinces.some((stop) => stop.id === province.id)).map(([id]) => id);
  const upstream = (dams.data?.dams ?? []).filter((entry) => upstreamIds.includes(entry.id)).sort((a, b) => (b.releaseCms ?? -1) - (a.releaseCms ?? -1));
  const systems = riverSystems.filter((system) => system.nodes.some((node) => node.provinceId === province.id) || upstreamIds.some((id) => riverSystemForDam(id)?.id === system.id));
  const damDate = upstream.map((dam) => dam.date).sort()[0] ?? dams.data?.dataDate;
  const stations = (rain.data?.all ?? []).filter((station) => station.provinceTh.replace(/^จังหวัด/, "").trim() === province.th).sort((a, b) => b.rainMm - a.rainMm);
  const modelData = model.data?.place.lat === province.lat && model.data.place.lon === province.lon ? model.data : null;
  const stamp = (date?: string | null) => date ?? t("ไม่ทราบวันที่ข้อมูล");
  const missing = t("ข้อมูลส่วนนี้ไม่พร้อมใช้งาน");
  const riskCount = risk.count === null ? "—" : `${risk.incomplete ? "≥ " : ""}${number(risk.count)}`;
  const shareText = [name,
    `${t("ดาวเทียมพบน้ำ")}: ${number(points)} ${t("จุด")} · ${t("เมฆ {n}%", { n: number(cloud) })} · NASA VIIRS · ${stamp(flood.data?.date)}`,
    t("จุดตรวจ ไม่ใช่ขนาดพื้นที่"),
    ...(cloud !== null && cloud >= 50 ? [t("เมฆบังมาก อาจมีน้ำที่มองไม่เห็น")] : []),
    `${t("ประกาศเตือน")}: ${warnings.data ? number(relevantWarnings.length) : "—"} · TMD · ${stamp(warningDate)}`,
    ...relevantWarnings.map((warning) => `${warning.title} · TMD · ${stamp(warning.announcedAt)}${warning.url ? ` · ${warning.url}` : ""}`),
    ...upstream.map((dam) => `${t.locale === "en" ? dam.nameEn : dam.nameTh}: ${t("ระบาย")} ${number(dam.releaseCms)} ${t("ลบ.ม./วินาที")} · ${t("กรมชลประทาน")} · ${dam.date}`),
    `${t("หมู่บ้านเสี่ยง ปภ.")}: ${riskCount} · ${t("ความเสี่ยงจากประวัติ · นับในกรอบจังหวัด ไม่ใช่น้ำท่วมตอนนี้")} · DDPM (CC BY) · ${stamp()}`,
    ...stations.map((station) => `${t.locale === "en" ? station.nameEn : station.nameTh}: ${number(station.rainMm)} ${t("มม.")} · TMD · ${stamp(rain.data?.observedAt)}`),
    `${t("ฝนคาดการณ์สะสม 3 วัน ณ เมืองจังหวัด")}: ${number(modelData?.totals[1])} ${t("มม.")} · ${t("แบบจำลอง")} · Open-Meteo (CC BY 4.0) · ${stamp(modelData?.date)}`,
    `${t("ที่มา")}: https://www.tmd.go.th/ · https://app.rid.go.th/reservoir/ · https://www.earthdata.nasa.gov/ · https://catalog.disaster.go.th/ · https://open-meteo.com/`,
  ].join("\n");
  return <main className="dam-page province-page"><div className="dam-sheet province-sheet">
    <header><MapBackLink /><h1>{name}</h1></header>
    <div className="dam-actions"><FollowButton item={{ kind: "province", id: province.id, value: points ?? 0, unit: "points", date: flood.data?.date ?? "" }} /></div>
    <section><ProvinceMap province={province} bbox={bbox} />
      <p className="province-big">{t("{n} จุด", { n: number(points) })}</p>
      <p>{t("ดาวเทียมพบน้ำ")} · {t("เมฆ {n}%", { n: number(cloud) })}</p>
      <div className="province-bar" role="img" aria-label={t("เทียบจังหวัดที่พบน้ำมากสุดในประเทศ {n}%", { n: number(points === null ? null : 100 * points / maxPoints) })}><i style={{ width: `${points === null ? 0 : 100 * points / maxPoints}%` }} /></div>
      <p className="text-muted text-xs">{t("เทียบจังหวัดที่พบน้ำมากสุดในประเทศ")}</p>
      <p className="text-muted text-xs">{t("จุดตรวจ ไม่ใช่ขนาดพื้นที่")}{cloud !== null && cloud >= 50 && ` · ${t("เมฆบังมาก อาจมีน้ำที่มองไม่เห็น")}`}</p>
      {!observed && <p className="text-muted text-sm">{missing}</p>}
      <SourceTime source="NASA VIIRS" date={flood.data?.date} kind="satellite" />
      <p className="text-muted text-xs">{thAttribution}</p>
    </section>
    {reports.length > 0 && <section><h2>{t("ภาพดาวเทียม 7 วัน · เฉพาะวันที่มีภาพ")}</h2>
      <ProvinceMap province={province} bbox={bbox} report={report} />
      <div className="province-days">{reports.map((entry) => <button type="button" key={entry.date} aria-pressed={report?.date === entry.date} onClick={() => setSelectedDate(entry.date)}>{new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(`${entry.date}T12:00:00Z`))}</button>)}</div>
      <SourceTime source={report?.layer.startsWith("MODIS") ? "NASA MODIS" : "NASA VIIRS"} date={report?.date} kind="satellite" />
    </section>}
    <section><h2>{t("ประกาศเตือน")}</h2>
      {warnings.data ? relevantWarnings.length ? <TmdWarningList items={relevantWarnings} limit={relevantWarnings.length} showSource={false} /> : <p className="text-muted text-sm">{t("ไม่มีประกาศเตือนที่ระบุจังหวัดหรือภาคนี้")}</p> : <p className="text-muted text-sm">{missing}</p>}
      <SourceTime source="TMD" time={warningDate} kind="daily" />
    </section>
    <section><h2>{t("เขื่อนต้นน้ำที่ระบายมาทางนี้")}</h2>
      <div className="province-rows">{upstream.map((dam) => <Link href={`/dam/${dam.id}`} key={dam.id}><span>{t.locale === "en" ? dam.nameEn : dam.nameTh}</span><span className="province-bar release"><i style={{ width: `${Math.min(100, dam.storagePct)}%` }} /></span><span>{number(dam.releaseCms)} {t("ลบ.ม./วิ")}</span></Link>)}</div>
      {!upstream.length && <p className="text-muted text-sm">{dams.data ? t("ไม่พบเขื่อนใหญ่ต้นน้ำในข้อมูล") : missing}</p>}
      <p className="text-muted text-xs">{t("ตามเส้นทางแม่น้ำโดยประมาณ")}</p>
      <SourceTime source="กรมชลประทาน" date={damDate} kind="daily" />
      <div className="dam-actions">{systems.map((system) => <Link className="dam-river-link" href={`/river/${system.id}`} key={system.id}>{t("ลุ่มน้ำ {name}", { name: t.locale === "en" ? system.en : system.th })} ▸</Link>)}</div>
    </section>
    <section><h2>{t("หมู่บ้านเสี่ยง ปภ.")}</h2><p className="province-big">{riskCount}</p><p className="text-muted text-xs">{t("ความเสี่ยงจากประวัติ · นับในกรอบจังหวัด ไม่ใช่น้ำท่วมตอนนี้")}</p>
      {risk.incomplete && <p className="text-muted text-xs">{t("รายงานไม่ครบ จำนวนที่พบเป็นอย่างน้อย")}</p>}{risk.stale && <p className="text-muted text-xs">{t("ข้อมูลเก่า")}</p>}
      <SourceTime source="DDPM (CC BY)" kind="daily" />
    </section>
    <section><h2>{t("ฝน 24 ชม. สถานี TMD ในจังหวัด")}</h2><div className="province-rows">{stations.map((station) => <div key={station.id}><span>{t.locale === "en" ? station.nameEn : station.nameTh}</span><span>{number(station.rainMm)} {t("มม.")}</span></div>)}</div>
      {!stations.length && <p className="text-muted text-sm">{rain.data ? t("ไม่มีสถานีรายงานฝนในจังหวัดนี้") : missing}</p>}
      <SourceTime source="TMD" time={rain.data?.observedAt} kind="rain24h" />
    </section>
    <section><h2>{t("ฝนคาดการณ์สะสม 3 วัน ณ เมืองจังหวัด")}</h2><p className="province-model">{number(modelData?.totals[1])} {t("มม.")}</p><SourceTime source="Open-Meteo (CC BY 4.0)" date={modelData?.date} kind="model" /></section>
    <div className="dam-actions"><ShareButton card={provinceSummaryCard(province, counts, flood.data?.date, dams.data?.dams, t)} imageLabel={t("แชร์ภาพสรุปจังหวัด")} /><ShareExtras path={`/province/${province.id}`} title={name} /><button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`); toast.success(t("คัดลอกแล้ว")); }
      catch { toast.error(t("คัดลอกไม่สำเร็จ")); }
    }}>{t("คัดลอกพร้อมที่มา")}</button></div>
    <EmergencyStrip />
  </div></main>;
}
