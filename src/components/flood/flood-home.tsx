"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useLastPlace } from "@/hooks/use-favourites";
import { useWaterSource, type Load } from "@/hooks/use-water-source";
import { useT } from "@/i18n/client";
import { EMERGENCY_NUMBERS } from "@/lib/emergency";
import { SourceTime } from "@/components/ui/source-time";
import type { TmdWarnings } from "@/lib/tmd";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import type { DamsPayload } from "@/lib/dams/client";
import type { DamTrend } from "@/lib/dams/trend";
import type { Place } from "@/lib/place";
import type { FloodRiskPoint } from "@/lib/water/flood-risk";
import { nearestDams } from "@/lib/dams/summary";
import { nearestProvince } from "@/lib/map/nearest";
import { provinces } from "@/lib/provinces";
import { distanceKm } from "@/lib/storms/normalize";
import { freshnessRows } from "@/lib/freshness";
import { MenuTip } from "@/components/menu-tip";
import { OfflineSupport } from "@/components/offline-support";
import { FloodEventList, type FloodEventsPayload } from "@/components/water/flood-events";
import { TmdWarningList } from "@/components/water/tmd-warnings";
import { eventProvinces, floodRegions, nearestRainStation, previousRelease, recentFloodEvents, riskBbox, warningRegions, type FloodNowPayload } from "./home-data";

const validWarnings = (value: TmdWarnings & { error?: string }) => Array.isArray(value?.items) && !value.error;
const validEvents = (value: FloodEventsPayload) => Array.isArray(value?.items);
const validRain = (value: RainRisk) => Array.isArray(value?.all);
const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
const validTrend = (value: DamTrend) => Array.isArray(value?.dates) && !!value?.release;
const validFlood = (value: FloodNowPayload) => typeof value?.date === "string" && !!value?.regionCounts && !!value?.provinceCounts;
const validNearFlood = (value: FloodNowPayload) => validFlood(value) && ["flood", "not-seen", "cloud-or-no-data"].includes(value.nearMe?.verdict ?? "");
const validRisk = (value: { points: FloodRiskPoint[] }) => Array.isArray(value?.points);
function subscribeProvince(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}
const provinceSnapshot = () => new URLSearchParams(window.location.search).get("province");
const serverProvince = () => null;

function SourceStatus({ status }: { status: Load<unknown>["status"] }) {
  const t = useT();
  return <span className="text-muted text-sm" role="status">{t(status === "loading" ? "กำลังโหลดข้อมูลส่วนนี้…" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน")}</span>;
}

function NearHome({ place, rain, dams, trend }: { place: Place; rain: Load<RainRisk>; dams: Load<DamsPayload>; trend: Load<DamTrend> }) {
  const t = useT();
  const satellite = useWaterSource(`/api/flood-now?lat=${place.lat}&lon=${place.lon}`, validNearFlood);
  const risk = useWaterSource(`/api/flood-risk?bbox=${riskBbox(place)}`, validRisk);
  const station = nearestRainStation(rain.data?.all ?? [], place);
  const dam = nearestDams(dams.data?.dams ?? [], place, 1)[0]?.dam;
  const previous = dam ? previousRelease(trend.data, dam.id, dam.date) : null;
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const verdict = satellite.data?.nearMe?.verdict;
  const villages = risk.data?.points.filter((point) => distanceKm(place, point) <= 10);

  return <section className="placeholder-card !p-4 space-y-2" aria-label={t("ใกล้บ้านคุณ")}>
    <h2 className="text-lg font-semibold">{t("ใกล้บ้านคุณ")}</h2>
    <ul className="divide-y divide-[var(--border)] text-sm">
      <li className="py-2">
        {satellite.data ? <><p>{t(verdict === "flood" ? "ดาวเทียมเห็นน้ำท่วมในรัศมี 30 กม." : verdict === "not-seen" ? "ดาวเทียมไม่พบน้ำท่วมในรัศมี 30 กม." : "เมฆบัง/ข้อมูลไม่พอ")}</p>
          <SourceTime source="NASA VIIRS" date={satellite.data.date} kind="satellite" /></>
          : <><p className="font-medium">{t("ดาวเทียมน้ำท่วมใกล้บ้าน")}</p><SourceStatus status={satellite.status} /></>}
      </li>
      <li className="py-2">
        <p className="font-medium">{t("หมู่บ้านเสี่ยง ปภ. ใกล้คุณ")}</p>
        {villages ? <><p>{t("{n} หมู่บ้าน · ความเสี่ยงจากประวัติ", { n: villages.length })}</p>
          <SourceTime source="ปภ." kind="daily" /></> : <SourceStatus status={risk.status} />}
      </li>
      <li className="py-2">
        <p className="font-medium">{t("ฝน 24 ชม. สถานีใกล้สุด (TMD)")}</p>
        {rain.data ? <>{station ? <p>{t("{name} · {mm} มม. · {km} กม.", {
          name: t.locale === "en" ? station.station.nameEn || station.station.nameTh : station.station.nameTh,
          mm: number.format(station.station.rainMm), km: number.format(station.km),
        })}</p> : <p>{t("ไม่พบสถานีฝนที่มีข้อมูล")}</p>}
          <SourceTime source="TMD" time={rain.data.observedAt} kind="rain24h" /></> : <SourceStatus status={rain.status} />}
      </li>
      <li className="py-2">
        <p className="font-medium">{t("เขื่อนต้นน้ำระบาย (เขื่อนใกล้สุด)")}</p>
        {dams.data ? <>{dam ? <><p>{t("{name} · {cms} ลบ.ม./วินาที", {
          name: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
          cms: dam.releaseCms === null ? "—" : number.format(dam.releaseCms),
        })}{dam.releaseCms !== null && previous !== null ? <> · {t("{arrow} เทียบเมื่อวาน", { arrow: dam.releaseCms > previous ? "↑" : dam.releaseCms < previous ? "↓" : "→" })}</> : <> · {t("ยังเทียบเมื่อวานไม่ได้")}</>}</p>
          <SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" /></> : <p>{t("ไม่พบข้อมูลเขื่อน")}</p>}</> : <SourceStatus status={dams.status} />}
      </li>
    </ul>
    <Link className="btn-primary flex min-h-11 items-center justify-center text-sm" href={`/map?lat=${place.lat}&lon=${place.lon}&mode=water`}>{t("ดูบนแผนที่")}</Link>
  </section>;
}

export function FloodHome() {
  const t = useT();
  const { place } = useLastPlace();
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const events = useWaterSource("/api/flood-events", validEvents);
  const satellite = useWaterSource("/api/flood-now", validFlood);
  const rain = useWaterSource("/api/rain-risk", validRain);
  const dams = useWaterSource("/api/dams", validDams);
  const trend = useWaterSource("/api/dams-trend", validTrend);
  const provinceId = useSyncExternalStore(subscribeProvince, provinceSnapshot, serverProvince);
  const province = provinces.find((entry) => entry.id === provinceId) ?? nearestProvince(place.lat, place.lon);
  // Anchor the lookback to the report's fetch time, so rendering never invents a new observation time.
  const recent = events.data ? recentFloodEvents(events.data.items, Date.parse(events.data.fetchedAt)) : [];
  const affectedIds = new Set(recent.flatMap(eventProvinces).map((entry) => entry.id));
  const affected = provinces.filter((entry) => affectedIds.has(entry.id));
  const provinceEvents = events.data?.items.filter((event) => eventProvinces(event).some((entry) => entry.id === province.id)) ?? [];
  const latestWarning = warnings.data?.items.map((item) => item.announcedAt).filter((at): at is string => !!at).sort().at(-1);
  const rows = freshnessRows({ damsDate: dams.data?.dataDate, rainObservedAt: rain.data?.observedAt,
    satFloodDate: satellite.data?.date, warningAt: warnings.data?.items.length === 0 ? null : latestWarning,
  }).filter((row) => ["dams", "rain", "sat-flood", "warnings"].includes(row.key));
  const number = new Intl.NumberFormat(t.intl);

  function selectProvince(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("province", id);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("popstate"));
  }

  return <main className="app-shell space-y-4" style={{ paddingBottom: "calc(var(--nav-h, 88px) + 2rem)" }}>
    <header>
      <h1 id="flood-home-title" tabIndex={-1} className="text-2xl font-semibold">{t("สถานการณ์น้ำท่วมตอนนี้")}</h1>
      <p className="text-muted text-sm">{t.locale === "en" ? place.admin ?? place.name : place.name}</p>
    </header>
    <OfflineSupport />
    <section className="placeholder-card !p-4 space-y-1" aria-label={t("ประกาศเตือนภัยกรมอุตุฯ")}>
      {warnings.data ? warnings.data.items.length > 0 ? <>
        <h2 className="text-base font-semibold">{t("ประกาศเตือนภัยกรมอุตุฯ")}</h2>
        <details>
          <summary className="cursor-pointer text-sm"><span className="line-clamp-2">⚠ {warnings.data.items[0].title}</span></summary>
          <TmdWarningList items={warnings.data.items} limit={warnings.data.items.length} />
        </details>
        <SourceTime source="กรมอุตุนิยมวิทยา" time={latestWarning} kind="daily" />
      </> : <p className="text-sm">{t("ไม่มีประกาศเตือนภัย")} · <SourceTime source="กรมอุตุนิยมวิทยา" time={warnings.loadedAt} kind="daily" /></p>
        : <p className="text-muted text-sm" role="status">{t(warnings.status === "loading" ? "กำลังโหลดประกาศเตือนภัย…" : "ข้อมูลประกาศเตือนภัยไม่พร้อมใช้งาน")}</p>}
      <a className="inline-flex min-h-11 items-center text-sm font-semibold text-given underline" href="tel:1784">{t("สายด่วน ปภ. 1784")}</a>
    </section>
    <NearHome key={`${place.lat},${place.lon}`} place={place} rain={rain} dams={dams} trend={trend} />
    <MenuTip onClose={() => document.getElementById("flood-home-title")?.focus()} />
    <section className="placeholder-card space-y-3" aria-label={t("ทั้งประเทศ")}>
      <h2 className="text-lg font-semibold">{t("ทั้งประเทศ")}</h2>
      <div className="space-y-1 text-sm">
        <h3 className="font-semibold">{t("จังหวัดที่มีเหตุการณ์น้ำท่วม 14 วันล่าสุด")}</h3>
        {events.data ? <><p>{t("{n} จังหวัดที่ระบุชื่อในรายงาน", { n: affected.length })}</p>
          <SourceTime source="GLIDE / GDACS" time={events.data.fetchedAt} kind="daily" />
          {affected.length > 0 && <div className="flex flex-wrap gap-2">{affected.map((entry) => <button key={entry.id} type="button" className="min-h-11 rounded-full border border-[var(--border)] px-3" onClick={() => selectProvince(entry.id)}>{t.locale === "en" ? entry.en : entry.th}</button>)}</div>}
          <p className="text-muted text-xs">{t("นับเฉพาะชื่อจังหวัดในสถานที่ของรายงาน · รายงานที่ระบุเพียงประเทศไทยยังอยู่ในรายการเหตุการณ์")}</p>
        </> : <SourceStatus status={events.status} />}
      </div>
      <div className="space-y-1 text-sm">
        <h3 className="font-semibold">{t("จุดตรวจน้ำท่วมจากดาวเทียมตามภาค")}</h3>
        {satellite.data ? <><p className="font-medium">{t("{n} จุดตรวจ", { n: number.format(Object.values(satellite.data.regionCounts).reduce((sum, counts) => sum + counts.flood + counts.recurringFlood, 0)) })}</p>
          <ul className="grid grid-cols-2 gap-1">{Object.entries(floodRegions).map(([region, label]) => {
          const counts = satellite.data!.regionCounts[region as keyof typeof floodRegions];
          return <li key={region}>{t(label)}: {counts ? t("{n} จุดตรวจ", { n: number.format(counts.flood + counts.recurringFlood) }) : "—"}</li>;
        })}</ul><SourceTime source="NASA VIIRS" date={satellite.data.date} kind="satellite" />
          <p className="text-muted text-xs">{t("จุดตรวจไม่ใช่ขนาดพื้นที่น้ำท่วม · เมฆและข้อมูลไม่พออาจทำให้ไม่พบ")}</p>
        </> : <SourceStatus status={satellite.status} />}
      </div>
      <div className="space-y-1 text-sm">
        <h3 className="font-semibold">{t("ประกาศเตือน TMD ตามภาค")}</h3>
        {warnings.data ? <><p>{t("{n} ประกาศเตือนภัย", { n: warnings.data.items.length })}</p>
          <SourceTime source="TMD" time={warnings.data.items.length === 0 ? warnings.loadedAt : latestWarning} kind="daily" />
          {warnings.data.items.length === 0 ? <p>{t("ไม่มีประกาศเตือนภัย")}</p> : <ul className="space-y-1">{warnings.data.items.map((item, index) => {
          const regions = warningRegions(`${item.title} ${item.description}`);
          return <li key={`${item.title}-${index}`}><p>{regions.length ? regions.map((region) => t(floodRegions[region])).join(" · ") : t("ประกาศไม่ได้ระบุภาค")}: {item.title}</p>
            <SourceTime source="TMD" time={item.announcedAt} kind="daily" /></li>;
        })}</ul>}</> : <SourceStatus status={warnings.status} />}
      </div>
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("เหตุการณ์ตามจังหวัด")}>
      <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">{t("เหตุการณ์ตามจังหวัด")}
        <select className="min-h-11 max-w-full rounded-full border border-[var(--border)] bg-[var(--card)] px-3" value={province.id} onChange={(event) => selectProvince(event.target.value)}>
          {provinces.map((entry) => <option key={entry.id} value={entry.id}>{t.locale === "en" ? entry.en : entry.th}</option>)}
        </select>
      </label>
      {events.data ? provinceEvents.length ? <FloodEventList key={province.id} payload={{ ...events.data, items: provinceEvents }} />
        : <><p className="text-muted text-sm">{t("ไม่พบเหตุการณ์ที่ระบุชื่อจังหวัดนี้ในรายงาน")}</p><SourceTime source="GLIDE / GDACS" time={events.data.fetchedAt} kind="daily" /></>
        : <SourceStatus status={events.status} />}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("เหตุการณ์ 90 วันล่าสุด")}>
      <h2 className="text-lg font-semibold">{t("เหตุการณ์ 90 วันล่าสุด")}</h2>
      {events.data ? <><SourceTime source="GLIDE / GDACS" time={events.data.fetchedAt} kind="daily" />
        {events.data.items.length ? <FloodEventList payload={events.data} /> : <p className="text-muted text-sm">{t("ไม่พบเหตุการณ์ในรายงาน 90 วันล่าสุด")}</p>}</>
        : <p className="text-muted text-sm" role="status">{t(events.status === "loading" ? "กำลังโหลดเหตุการณ์น้ำท่วม…" : "ข้อมูลเหตุการณ์น้ำท่วมไม่พร้อมใช้งาน")}</p>}
    </section>
    <div className="flex flex-wrap gap-3 text-sm">
      <Link className="inline-flex min-h-11 items-center text-given underline" href="/water">{t("ติดตามการระบายน้ำจากเขื่อน")}</Link>
      <Link className="inline-flex min-h-11 items-center text-given underline" href="/rain">{t("ติดตามฝน")}</Link>
    </div>
    <p className="text-muted text-sm">{t("ยังไม่มีระดับน้ำแม่น้ำแบบเรียลไทม์ — ใช้ข้อมูลเขื่อนรายวันและดาวเทียมแทน")}</p>
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer font-semibold">{t("ข้อมูลล่าสุด")}</summary>
      <ul className="space-y-2">{rows.map((row) => <li key={row.key}><p>{t(row.label)}{row.none && ` · ${t("ไม่มีประกาศในขณะนี้")}`}</p>
        <SourceTime source={row.source} time={row.key === "warnings" && row.none ? warnings.loadedAt : row.time}
          kind={row.key === "rain" ? "rain24h" : row.key === "sat-flood" ? "satellite" : "daily"} /></li>)}</ul>
    </details>
    <footer className="space-y-2 border-t border-[var(--border)] pt-4 text-sm" aria-label={t("เบอร์ฉุกเฉิน")}>
      <h2 className="text-lg font-semibold">{t("เบอร์ฉุกเฉิน")}</h2>
      <div className="flex flex-wrap gap-3">{EMERGENCY_NUMBERS.map(({ label, number: phone, href }) => <a key={phone} className="inline-flex min-h-11 items-center font-semibold text-given underline" href={href}>{t(label)}</a>)}</div>
    </footer>
  </main>;
}
