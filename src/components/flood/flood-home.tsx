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
import type { PixelCounts } from "@/lib/flood/viirs";
import { ThMap } from "@/components/visuals/th-map";
import { NearMe3D, nearMeVisuals } from "./near-me-3d";
import { rainGauge, streamRate, visualSummaryRain, visualSummarySatellite, visualSummaryStream, visualSummaryVillages } from "@/lib/visuals";
import { eventProvinces, nearestRainStation, previousRelease, recentFloodEvents, riskBbox, warningRegions, type FloodNowPayload } from "./home-data";

const validWarnings = (value: TmdWarnings & { error?: string }) => Array.isArray(value?.items) && !value.error;
const validEvents = (value: FloodEventsPayload) => Array.isArray(value?.items);
const validRain = (value: RainRisk) => Array.isArray(value?.all);
const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
const validTrend = (value: DamTrend) => Array.isArray(value?.dates) && !!value?.release;
const validFlood = (value: FloodNowPayload) => typeof value?.date === "string" && !!value?.regionCounts && !!value?.provinceCounts;
type NearFloodPayload = FloodNowPayload & { nearMe?: { counts: PixelCounts } };
const validNearFlood = (value: NearFloodPayload) => validFlood(value) && ["flood", "not-seen", "cloud-or-no-data"].includes(value.nearMe?.verdict ?? "");
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
  const villages = risk.data?.points.filter((point) => distanceKm(place, point) <= 10);

  const samples = satellite.data?.nearMe?.samples ?? null;
  const counts = satellite.data?.nearMe?.counts ?? null;
  const nearby = { place, date: satellite.data?.date, counts, samples, villages: villages ?? null,
    station: station?.station ?? null, dam: dam ?? null, summaries: [] };
  const summaries = [
    visualSummarySatellite(nearMeVisuals(nearby).ring, t),
    visualSummaryVillages(villages?.length ?? null, t),
    [station ? (t.locale === "en" ? station.station.nameEn || station.station.nameTh : station.station.nameTh) : "",
      visualSummaryRain(rainGauge(station?.station.rainMm ?? null, 100), t)].filter(Boolean).join(" · "),
    [dam ? (t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh) : "",
      visualSummaryStream(streamRate(dam?.releaseCms ?? null, "cms", 1000), t),
      dam?.releaseCms !== null && dam?.releaseCms !== undefined && previous !== null
        ? t("{arrow} เทียบเมื่อวาน", { arrow: dam.releaseCms > previous ? "↑" : dam.releaseCms < previous ? "↓" : "→" }) : t("ยังเทียบเมื่อวานไม่ได้")].filter(Boolean).join(" · "),
  ];
  const labels = [t("ดาวเทียมน้ำท่วมใกล้บ้าน"), t("หมู่บ้านเสี่ยง ปภ. ใกล้คุณ"), t("ฝน 24 ชม. สถานีใกล้สุด (TMD)"), t("เขื่อนต้นน้ำระบาย (เขื่อนใกล้สุด)")];
  const times = [
    <SourceTime key="satellite" source="NASA VIIRS" date={satellite.data?.date} kind="satellite" />,
    <SourceTime key="villages" source="ปภ." kind="daily" />,
    <SourceTime key="rain" source="TMD" time={rain.data?.observedAt} kind="rain24h" />,
    <SourceTime key="dam" source="กรมชลประทาน" date={dam?.date} kind="daily" />,
  ];
  const statuses = [satellite, risk, rain, dams];
  return <section className="placeholder-card !p-4 space-y-2" aria-label={t("ใกล้บ้านคุณ")}>
    <h2 className="text-lg font-semibold">{t("ใกล้บ้านคุณ")}</h2>
    <NearMe3D {...nearby} summaries={summaries} />
    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
      {summaries.map((summary, index) => <div key={labels[index]} className="min-w-0">
        <p className="truncate font-medium" title={labels[index]}>{labels[index]}</p>
        <p className="truncate text-muted" title={summary}>{summary}</p>
        <div className="leading-4">{times[index]}{!statuses[index].data && <div><SourceStatus status={statuses[index].status} /></div>}</div>
      </div>)}
    </div>
    <Link className="btn-primary flex min-h-11 items-center justify-center text-sm" href={`/map?lat=${place.lat}&lon=${place.lon}&mode=water`}>{t("ดูบนแผนที่")}</Link>
  </section>;
}

export function FloodHome() {
  const t = useT();
  const { place } = useLastPlace();
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const events = useWaterSource("/api/flood-events", validEvents);
  const satellite = useWaterSource("/api/flood-now?scope=th", validFlood);
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
  const warnedRegions = [...new Set(warnings.data?.items.flatMap((item) => warningRegions(`${item.title} ${item.description}`)) ?? [])];

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
      <ThMap counts={satellite.data?.provinceCounts ?? null} samples={satellite.data?.samples ?? []}
        affected={affected.map((entry) => entry.id)} warnedRegions={warnedRegions} onSelect={selectProvince} />
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        <span><SourceTime source="NASA VIIRS" date={satellite.data?.date} kind="satellite" />{!satellite.data && <SourceStatus status={satellite.status} />}</span>
        <span><SourceTime source="GLIDE / GDACS" time={events.data?.fetchedAt} kind="daily" />{!events.data && <SourceStatus status={events.status} />}</span>
        <span><SourceTime source="TMD" time={warnings.data?.items.length === 0 ? warnings.loadedAt : latestWarning} kind="daily" />{!warnings.data && <SourceStatus status={warnings.status} />}</span>
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
      <details>
        <summary className="min-h-11 cursor-pointer text-sm">{t("ดูรายการ")}</summary>
        {events.data ? <><SourceTime source="GLIDE / GDACS" time={events.data.fetchedAt} kind="daily" />
          {events.data.items.length ? <FloodEventList payload={events.data} /> : <p className="text-muted text-sm">{t("ไม่พบเหตุการณ์ในรายงาน 90 วันล่าสุด")}</p>}</>
          : <p className="text-muted text-sm" role="status">{t(events.status === "loading" ? "กำลังโหลดเหตุการณ์น้ำท่วม…" : "ข้อมูลเหตุการณ์น้ำท่วมไม่พร้อมใช้งาน")}</p>}
      </details>
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
