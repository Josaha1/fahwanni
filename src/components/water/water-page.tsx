"use client";

import { DrainagePillar } from "@/components/dams/drainage-pillar";
import { isOn } from "@/lib/features";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { useWaterSource, type Load } from "@/hooks/use-water-source";
import { useLastPlace } from "@/hooks/use-favourites";
import type { DamsPayload } from "@/lib/dams/client";
import { nearestDams, oldestDifferentDamDate, waterSummary } from "@/lib/dams/summary";
import { EMERGENCY_NUMBERS } from "@/lib/emergency";
import { SourceTime } from "@/components/ui/source-time";
import { nearestProvince } from "@/lib/map/nearest";
import type { Place } from "@/lib/place";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import { distanceKm } from "@/lib/storms/normalize";
import { riverWatchValue } from "@/lib/rivers/observed";
import { statusWord } from "@/lib/rivers/status";
import type { TmdWarnings } from "@/lib/tmd";
import type { TideSeries } from "@/lib/tide/tide";
import { diffSinceSeen, markSeen, readSeen, type NewsItem, type Seen } from "@/lib/water/whats-new";
import { readWatch, refreshWatch, toggleWatch, watchRows, writeWatch, type WaterWatch, type WatchItem } from "@/lib/water/watchlist";
import { TmdWarningList } from "./tmd-warnings";
import { FloodEventList, type FloodEventsPayload } from "./flood-events";
import { EnsoBadge } from "@/components/enso-badge";
import { DamRowHeader } from "./dam-row";
import { RiverDetails, RiverRowHeader, type RiversPayload } from "./river-details";
import { TideChart } from "./tide-chart";
const validRivers = (value: RiversPayload) => Array.isArray(value?.points);
const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
const validRain = (value: RainRisk) => Array.isArray(value?.stations);
const validWarnings = (value: TmdWarnings & { error?: string }) => Array.isArray(value?.items) && !value.error;
const validEvents = (value: FloodEventsPayload) => Array.isArray(value?.items);
const validTide = (value: TideSeries) => Array.isArray(value?.times) && value.times.length === value?.heights?.length;
const tideProvinces = new Set(["bangkok", "nonthaburi", "pathum-thani", "samut-prakan", "samut-sakhon", "phra-nakhon-si-ayutthaya"]);
function TideSection() {
  const t = useT();
  const tide = useWaterSource("/api/tide", validTide);
  return <section id="tide" className="placeholder-card space-y-2" aria-label={t("น้ำขึ้นน้ำลง (ปากเจ้าพระยา)")}>
    <h2 className="text-lg font-semibold">{t("น้ำขึ้นน้ำลง (ปากเจ้าพระยา)")}</h2>
    {tide.data ? <TideChart series={tide.data} />
      : <p className="text-muted text-sm" role="status">{t(tide.status === "loading" ? "กำลังโหลดข้อมูลน้ำขึ้นน้ำลง…" : "ข้อมูลน้ำขึ้นน้ำลงไม่พร้อมใช้งาน")}</p>}
  </section>;
}

export function showTideForPlace(place: Place) {
  return tideProvinces.has(nearestProvince(place.lat, place.lon).id);
}
function stored(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function subscribeWater(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("fah-water-seen-change", onChange);
  window.addEventListener("fah-water-watch-change", onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener("fah-water-seen-change", onChange); window.removeEventListener("fah-water-watch-change", onChange); };
}

export function WaterPage() {
  const t = useT();
  const { place } = useLastPlace();
  const rivers = useWaterSource("/api/rivers", validRivers);
  const dams = useWaterSource("/api/dams", validDams);
  const rain = useWaterSource("/api/rain-risk", validRain);
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const events = useWaterSource("/api/flood-events", validEvents);
  const seenRaw = useSyncExternalStore(subscribeWater, () => stored("fah-water-seen"), () => null);
  const watchRaw = useSyncExternalStore(subscribeWater, () => stored("fah-water-watch") ?? stored("fah-dam-watch"), () => null);
  const seen: Seen | null = useMemo(() => seenRaw ? readSeen() : null, [seenRaw]);
  const watch: WaterWatch = useMemo(() => watchRaw ? readWatch() : {}, [watchRaw]);
  const [showAll, setShowAll] = useState(false);
  const [expandedRivers, setExpandedRivers] = useState<Set<string>>(new Set());
  const [collapsedNearest, setCollapsedNearest] = useState<Set<string>>(new Set());
  const [expandedDams, setExpandedDams] = useState<Set<string>>(new Set());
  const [expandedWatchedRivers, setExpandedWatchedRivers] = useState<Set<string>>(new Set());
  const [expandedWatchedDams, setExpandedWatchedDams] = useState<Set<string>>(new Set());
  const oneDecimal = useMemo(() => new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }), [t.intl]);
  const nearbyRivers = useMemo(() => (rivers.data?.points ?? []).map((point) => ({ point, km: distanceKm(place, point) }))
    .sort((a, b) => a.km - b.km || a.point.id.localeCompare(b.point.id)), [rivers.data, place]);
  const nearestRiverId = nearbyRivers[0]?.point.id;
  const isRiverExpanded = (id: string) => expandedRivers.has(id) || (id === nearestRiverId && !collapsedNearest.has(id));
  const nearbyDams = dams.data ? nearestDams(dams.data.dams, place) : [];
  const oldestDamDate = dams.data?.dataDate ? oldestDifferentDamDate(dams.data.dams, dams.data.dataDate) : null;
  const currentWatch: WatchItem[] = useMemo(() => [
    ...(dams.data?.dams ?? []).map((dam) => ({ kind: "dam" as const, id: dam.id, value: dam.storagePct, unit: "pct" as const, date: dam.date })),
    ...(rivers.data?.points ?? []).flatMap((point) => {
      const watched = riverWatchValue(point);
      return watched ? [{ kind: "river" as const, id: point.id, value: watched.value, unit: "cms" as const, date: watched.date }] : [];
    }),
  ], [dams.data, rivers.data]);
  const newsItems: NewsItem[] = useMemo(() => {
    const riverIds = new Set(nearbyRivers.slice(0, 3).map(({ point }) => point.id));
    return [
      ...(rivers.data?.points ?? []).filter((point) => riverWatchValue(point) && (riverIds.has(point.id) || watch[`river:${point.id}`]))
        .map((point) => ({ key: `river:${point.id}` as const, label: t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh,
          value: riverWatchValue(point)!.value, unit: "cms" as const,
          ...(point.summary ? { status: statusWord(point.summary.today.status) } : {}), date: riverWatchValue(point)!.date })),
      ...(dams.data?.dams ?? []).filter((dam) => watch[`dam:${dam.id}`])
        .map((dam) => ({ key: `dam:${dam.id}` as const, label: t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh,
          value: dam.storagePct, unit: "pct" as const, date: dam.date })),
    ];
  }, [nearbyRivers, rivers.data, dams.data, watch, t.locale]);
  const latestItems = useRef<NewsItem[]>([]);
  useEffect(() => { latestItems.current = newsItems; }, [newsItems]);

  useEffect(() => {
    if (!currentWatch.length) return;
    const next = refreshWatch(watch, currentWatch);
    if (next !== watch) { writeWatch(next); window.dispatchEvent(new Event("fah-water-watch-change")); }
  }, [currentWatch, watch]);
  useEffect(() => {
    const save = () => {
      if (latestItems.current.length) { markSeen(latestItems.current); window.dispatchEvent(new Event("fah-water-seen-change")); }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") save(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); save(); };
  }, []);

  function changeWatch(item: WatchItem) {
    const next = toggleWatch(watch, item);
    writeWatch(next);
    window.dispatchEvent(new Event("fah-water-watch-change"));
  }
  function toggleExpanded(setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleRiver(id: string) {
    if (id === nearestRiverId && !expandedRivers.has(id)) toggleExpanded(setCollapsedNearest, id);
    else toggleExpanded(setExpandedRivers, id);
  }
  const news = diffSinceSeen(seen, newsItems);
  const watched = watchRows(watch, currentWatch);
  const rainNear = (rain.data?.stations ?? []).filter((station) => distanceKm(place, station) <= 150);
  const summary = dams.data ? waterSummary(dams.data.dams, rain.data?.stations ?? null) : null;
  const sourceLine = (status: Load<unknown>["status"], loading: string, error: string) => status === "ready" ? null
    : <p className="text-muted text-sm" role="status">{t(status === "loading" ? loading : error)}</p>;

  return <main className="app-shell space-y-4" style={{ paddingBottom: "calc(var(--nav-h, 88px) + 2rem)" }}>
    <header className="flex flex-wrap items-center justify-between gap-x-3">
      <h1 className="text-2xl font-semibold">{t("การระบายน้ำจากเขื่อน")}</h1>
      <Link className="inline-flex min-h-11 items-center font-semibold text-given underline underline-offset-2" href="/map?mode=water">{t("ดูบนแผนที่")}</Link>
    </header>
    <DrainagePillar dams={dams} place={place} />
    {warnings.data && warnings.data.items.length > 0 && <section className="placeholder-card space-y-2" aria-label={t("ประกาศเตือนภัยกรมอุตุฯ")}>
      <h2 className="text-lg font-semibold">{t("ประกาศเตือนภัยกรมอุตุฯ")}</h2>
      <TmdWarningList items={warnings.data.items} limit={3} />
    </section>}
    {isOn("enso") && <EnsoBadge />}
    {events.data && events.data.items.length > 0 && <section className="placeholder-card space-y-2" aria-label={t("เหตุการณ์น้ำท่วม/ภัยพิบัติ")}>
      <h2 className="text-lg font-semibold">{t("เหตุการณ์น้ำท่วม/ภัยพิบัติ")}</h2>
      <FloodEventList payload={events.data} />
    </section>}
    {news.length > 0 && <section className="placeholder-card space-y-2" aria-label={t("มีอะไรใหม่")}>
      <h2 className="text-lg font-semibold">{t("มีอะไรใหม่")}</h2>
      <ul className="space-y-1 text-sm">{news.slice(0, 3).map((item) => <li key={item.key}>{t(item.text, {
          ...item.params, from: t(String(item.params.from ?? "—")), to: t(String(item.params.to ?? "—")),
        })}</li>)}</ul>
    </section>}
    {watched.length > 0 && <section className="placeholder-card space-y-2" aria-label={t("ที่ติดตาม")}>
      <h2 className="text-lg font-semibold">{t("ที่ติดตาม")}</h2>
      <ul className="divide-y divide-[var(--border)]">{watched.map(({ item }) => {
        const dam = item.kind === "dam" ? dams.data?.dams.find((entry) => entry.id === item.id) : null;
        const river = item.kind === "river" ? nearbyRivers.find(({ point }) => point.id === item.id) : null;
        if (dam) return <li key={`dam:${dam.id}`} className="py-1"><DamRowHeader dam={dam} dataDate={dams.data?.dataDate ?? undefined} expanded={expandedWatchedDams.has(dam.id)} onToggle={() => toggleExpanded(setExpandedWatchedDams, dam.id)} detailsId={`watched-dam-details-${dam.id}`} showDate={false} /></li>;
        if (river) return <li key={`river:${river.point.id}`} className="py-1">
          <RiverRowHeader point={river.point} expanded={expandedWatchedRivers.has(river.point.id)} onToggle={() => toggleExpanded(setExpandedWatchedRivers, river.point.id)} detailsId={`watched-river-details-${river.point.id}`} />
          {expandedWatchedRivers.has(river.point.id) ? <RiverDetails point={river.point} expanded showDisclaimers={false} showDate={false} showSummary={false} detailsId={`watched-river-details-${river.point.id}`} />
            : <div id={`watched-river-details-${river.point.id}`} hidden />}
        </li>;
        return null;
      })}</ul>
    </section>}
    <section className="placeholder-card space-y-3" aria-label={t("แม่น้ำใกล้คุณ")}>
      <div><h2 className="text-lg font-semibold">{t("แม่น้ำใกล้คุณ")}</h2>
        {rivers.data?.today && <p><SourceTime source="GloFAS / Open-Meteo" date={rivers.data.today} kind="model" /></p>}
      </div>
      {sourceLine(rivers.status, "กำลังโหลดข้อมูลแม่น้ำ…", "ข้อมูลแม่น้ำไม่พร้อมใช้งาน")}
      {rivers.data && <>
        <ul className="divide-y divide-[var(--border)]">{(showAll ? nearbyRivers : nearbyRivers.slice(0, 3)).map(({ point, km }) => {
          const upstream = dams.data?.dams.find((dam) => dam.id === point.downstreamOfDam);
          const watchedNow = Boolean(watch[`river:${point.id}`]);
          const expanded = isRiverExpanded(point.id);
          return <li key={point.id} className="py-1 first:pt-0 last:pb-0">
            <RiverRowHeader point={point} km={km} watched={watchedNow} expanded={expanded}
              onToggle={() => toggleRiver(point.id)}
              onToggleWatch={riverWatchValue(point) ? () => changeWatch({ kind: "river", id: point.id, unit: "cms", ...riverWatchValue(point)! }) : undefined} />
            {expanded ? <><RiverDetails point={point} upstream={upstream} dams={dams.data?.dams ?? []} expanded showDisclaimers={false} showDate={false} showSummary={false}
              damHref={(id) => `/map?mode=water&dam=${encodeURIComponent(id)}`} />
              <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-given underline underline-offset-2" href={`/map?mode=water&river=${encodeURIComponent(point.id)}&lat=${point.lat}&lon=${point.lon}&z=8`}>{t("ดูบนแผนที่")}</Link></>
              : <div id={`river-details-${point.id}`} hidden />}
          </li>;
        })}</ul>
        {!showAll && nearbyRivers.length > 3 && <button type="button" className="min-h-11 font-semibold text-given underline" onClick={() => setShowAll(true)}>{t("ดูทุกจุด ({n})", { n: nearbyRivers.length })}</button>}
      </>}
    </section>
    {showTideForPlace(place) && <TideSection />}
    <section className="placeholder-card space-y-2" aria-label={t("เขื่อนใกล้คุณ")}>
      <div><h2 className="text-lg font-semibold">{t("เขื่อนใกล้คุณ")}</h2>
        {dams.data?.dataDate && <p><SourceTime source="กรมชลประทาน" date={dams.data.dataDate} kind="daily" />{oldestDamDate && <> · <SourceTime source="กรมชลประทาน" date={oldestDamDate} kind="daily" /></>}</p>}
      </div>
      {sourceLine(dams.status, "กำลังโหลดข้อมูลเขื่อน…", "ข้อมูลเขื่อนไม่พร้อมใช้งาน")}
      {summary && <>
        <p className="text-muted text-sm">{t("เขื่อนน้ำมาก (เกิน 80%)")} {summary.over80} · {t("เกินความจุ")} {summary.over100} · {t("ระบายน้ำมาก")} {summary.highRelease}{summary.heavyRain !== null && <> · {t("สถานีฝนหนัก")} {summary.heavyRain}</>}</p>
        <ul className="divide-y divide-[var(--border)]">{nearbyDams.map(({ dam, km }) => <li key={dam.id} className="py-1"><DamRowHeader dam={dam} dataDate={dams.data?.dataDate ?? undefined} km={km} expanded={expandedDams.has(dam.id)} onToggle={() => toggleExpanded(setExpandedDams, dam.id)} showDate={false} /></li>)}</ul>
      </>}
    </section>
    <section className={rainNear.length ? "placeholder-card space-y-2" : "space-y-2"} aria-label={t("ฝนหนัก 24 ชม. ใกล้คุณ")}>
      <h2 className="text-lg font-semibold">{t("ฝนหนัก 24 ชม. ใกล้คุณ")}</h2>
      {sourceLine(rain.status, "กำลังโหลดข้อมูลฝนหนัก…", "ข้อมูลฝนหนักไม่พร้อมใช้งาน")}
      {rain.data && (rainNear.length ? <ul className="space-y-2 text-sm">{rainNear.map((station) => <li key={station.id} className="flex justify-between gap-2"><span>{t.locale === "en" ? station.nameEn || station.nameTh : station.nameTh}<span className="block"><SourceTime source="TMD" time={rain.data?.observedAt} kind="rain24h" /></span></span><span>{t("{mm} มม. · {category}", { mm: oneDecimal.format(station.rainMm), category: t(station.category === "veryHeavy" ? "ฝนหนักมาก" : "ฝนหนัก") })}</span></li>)}</ul> : <p className="text-muted text-sm">{t("ไม่มีสถานีฝนหนักภายใน 150 กม.")}</p>)}
      {!rainNear.length && rain.data?.observedAt && <p><SourceTime source="TMD" time={rain.data.observedAt} kind="rain24h" /></p>}
    </section>
    <footer className="space-y-2 border-t border-[var(--border)] pt-4 text-sm" aria-label={t("เบอร์ฉุกเฉิน")}>
      <h2 className="text-lg font-semibold">{t("เบอร์ฉุกเฉิน")}</h2>
      <div className="flex flex-wrap gap-3">{EMERGENCY_NUMBERS.map(({ label, number: phone, href }) => <a key={phone} className="font-semibold text-given underline" href={href}>{t(label)}</a>)}</div>
      <p className="text-muted">{t("ปริมาณน้ำไหลผ่าน: แบบจำลอง GloFAS ผ่าน Open-Meteo (CC BY 4.0) · เขื่อน: กรมชลประทาน · ฝน/ประกาศ: กรมอุตุนิยมวิทยา")}</p>
      <p className="text-muted">{t("ประมาณการจากแบบจำลอง GloFAS ความละเอียด 5 กม. · ไม่ใช่ค่าที่วัดจริงจากสถานี · ไม่ใช่แผนที่น้ำท่วม")}</p>
      <p className="text-muted">{t("ตัวเลขปี 2554 อย่างเดียวไม่ได้บอกว่าจะท่วม ปี 2554 ท่วมเพราะฝน เขื่อนเต็ม และจังหวะเวลาประกอบกัน")}</p>
    </footer>
  </main>;
}
