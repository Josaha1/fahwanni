"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { useLastPlace } from "@/hooks/use-favourites";
import type { DamsPayload } from "@/lib/dams/client";
import { nearestDams, waterSummary } from "@/lib/dams/summary";
import { damBandColor } from "@/lib/dams/bands";
import { EMERGENCY_NUMBERS } from "@/lib/emergency";
import { formatFullDate } from "@/lib/format";
import type { RainRisk } from "@/lib/rain-risk/tmd";
import { distanceKm } from "@/lib/storms/normalize";
import { rareLevelWord, statusWord } from "@/lib/rivers/status";
import type { RiverBand, RiverStatus, RiverTrend } from "@/lib/rivers/types";
import type { TmdWarnings } from "@/lib/tmd";
import { diffSinceSeen, markSeen, readSeen, type NewsItem, type Seen } from "@/lib/water/whats-new";
import { readWatch, refreshWatch, toggleWatch, watchRows, writeWatch, type WaterWatch, type WatchItem } from "@/lib/water/watchlist";
import { TmdWarningList } from "./tmd-warnings";

type RiverRow = {
  id: string; nameTh: string; nameEn: string; lat: number; lon: number; downstreamOfDam: string | null;
  summary: null | { today: { date: string; value: number; status: RiverStatus }; trend: RiverTrend | null;
    peak: { date: string; value: number } | null; rare: "about5y" | "yearly" | null;
    value2554Today: number | null; days: { date: string; value: number; doyBand: RiverBand }[] };
};
type RiversPayload = { today: string; points: RiverRow[] };
type Load<T> = { status: "loading" | "ready" | "error"; data: T | null };

function useWaterSource<T>(url: string, valid: (value: T) => boolean): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: "loading", data: null });
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      const value = await response.json() as T;
      if (!valid(value)) throw new Error("Invalid response");
      if (!controller.signal.aborted) setState({ status: "ready", data: value });
    }).catch(() => { if (!controller.signal.aborted) setState({ status: "error", data: null }); });
    return () => controller.abort();
  }, [url, valid]);
  return state;
}

const validRivers = (value: RiversPayload) => Array.isArray(value?.points);
const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
const validRain = (value: RainRisk) => Array.isArray(value?.stations);
const validWarnings = (value: TmdWarnings & { error?: string }) => Array.isArray(value?.items) && !value.error;
const riverColors: Record<RiverStatus, string> = { low: "#64748b", normal: "#16a34a", high: "#d97706", veryHigh: "#dc2626" };
function stored(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function subscribeWater(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("fah-water-seen-change", onChange);
  window.addEventListener("fah-water-watch-change", onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener("fah-water-seen-change", onChange); window.removeEventListener("fah-water-watch-change", onChange); };
}

function dateLabel(date: string, locale: "th" | "en") {
  return formatFullDate(`${date}T12:00:00+07:00`, "Asia/Bangkok", locale);
}

function RiverChart({ days, color }: { days: NonNullable<RiverRow["summary"]>["days"]; color: string }) {
  const t = useT();
  const shown = days.slice(0, 7);
  if (!shown.length) return null;
  // Scale to the data and the normal band (not from zero) so a week's change is visible.
  const values = shown.flatMap((day) => [day.value, day.doyBand?.p25 ?? day.value, day.doyBand?.p75 ?? day.value]);
  const low = Math.min(...values), high = Math.max(...values);
  const pad = Math.max((high - low) * 0.15, high * 0.02, 1);
  const floor = Math.max(0, low - pad), ceiling = high + pad;
  const y = (value: number) => 6 + (1 - (value - floor) / (ceiling - floor)) * 44;
  const x = (index: number) => 6 + index * (148 / Math.max(1, shown.length - 1));
  const banded = shown.every((day) => day.doyBand);
  const band = banded ? [
    ...shown.map((day, index) => `${x(index)},${y(day.doyBand.p75)}`),
    ...shown.map((day, index) => `${x(index)},${y(day.doyBand.p25)}`).reverse(),
  ].join(" ") : null;
  const weekday = (date: string) => new Intl.DateTimeFormat(t.intl, { weekday: "short", timeZone: "Asia/Bangkok" })
    .format(new Date(`${date}T12:00:00+07:00`));
  return <svg className="mt-2 w-full" viewBox="0 0 160 64" role="img" aria-label={t("กราฟปริมาณน้ำไหลผ่าน 7 วัน")}>
    {band && <polygon points={band} fill="currentColor" opacity="0.12" />}
    <polyline points={shown.map((day, index) => `${x(index)},${y(day.value)}`).join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {shown.map((day, index) => <circle key={day.date} cx={x(index)} cy={y(day.value)} r="1.8" fill={color}><title>{day.date}: {day.value.toFixed(0)} m³/s; p25–p75 {day.doyBand?.p25.toFixed(0)}–{day.doyBand?.p75.toFixed(0)}</title></circle>)}
    {shown.map((day, index) => <text key={`label-${day.date}`} x={x(index)} y="62" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.6">{weekday(day.date)}</text>)}
  </svg>;
}

export function WaterPage() {
  const t = useT();
  const { place } = useLastPlace();
  const rivers = useWaterSource("/api/rivers", validRivers);
  const dams = useWaterSource("/api/dams", validDams);
  const rain = useWaterSource("/api/rain-risk", validRain);
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const seenRaw = useSyncExternalStore(subscribeWater, () => stored("fah-water-seen"), () => null);
  const watchRaw = useSyncExternalStore(subscribeWater, () => stored("fah-water-watch") ?? stored("fah-dam-watch"), () => null);
  const seen: Seen | null = useMemo(() => seenRaw ? readSeen() : null, [seenRaw]);
  const watch: WaterWatch = useMemo(() => watchRaw ? readWatch() : {}, [watchRaw]);
  const [showAll, setShowAll] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 }), [t.intl]);
  const oneDecimal = useMemo(() => new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }), [t.intl]);
  const nearbyRivers = useMemo(() => (rivers.data?.points ?? []).map((point) => ({ point, km: distanceKm(place, point) }))
    .sort((a, b) => a.km - b.km || a.point.id.localeCompare(b.point.id)), [rivers.data, place]);
  const nearbyDams = dams.data ? nearestDams(dams.data.dams, place) : [];
  const currentWatch: WatchItem[] = useMemo(() => [
    ...(dams.data?.dams ?? []).map((dam) => ({ kind: "dam" as const, id: dam.id, value: dam.storagePct, unit: "pct" as const, date: dam.date })),
    ...(rivers.data?.points ?? []).flatMap((point) => point.summary ? [{ kind: "river" as const, id: point.id,
      value: point.summary.today.value, unit: "cms" as const, date: point.summary.today.date }] : []),
  ], [dams.data, rivers.data]);
  const newsItems: NewsItem[] = useMemo(() => {
    const riverIds = new Set(nearbyRivers.slice(0, 3).map(({ point }) => point.id));
    return [
      ...(rivers.data?.points ?? []).filter((point) => point.summary && (riverIds.has(point.id) || watch[`river:${point.id}`]))
        .map((point) => ({ key: `river:${point.id}` as const, label: t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh,
          value: point.summary!.today.value, unit: "cms" as const, status: statusWord(point.summary!.today.status), date: point.summary!.today.date })),
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
  const news = diffSinceSeen(seen, newsItems);
  const watched = watchRows(watch, currentWatch);
  const rainNear = (rain.data?.stations ?? []).filter((station) => distanceKm(place, station) <= 150);
  const summary = dams.data ? waterSummary(dams.data.dams, rain.data?.stations ?? null) : null;
  const sourceLine = (status: Load<unknown>["status"], loading: string, error: string) => status === "ready" ? null
    : <p className="text-muted text-sm" role="status">{t(status === "loading" ? loading : error)}</p>;

  return <main className="app-shell space-y-4" style={{ paddingBottom: "calc(var(--nav-h, 88px) + 2rem)" }}>
    <section className="placeholder-card">
      <h1 className="text-2xl font-semibold">{t("สถานการณ์น้ำ")}</h1>
      <p className="text-muted mt-1">{place.name}</p>
      <Link className="mt-3 inline-flex min-h-11 items-center font-semibold text-given underline underline-offset-2" href="/map?mode=water">{t("ดูบนแผนที่")}</Link>
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("ประกาศเตือนภัยกรมอุตุฯ")}>
      <h2 className="text-lg font-semibold">{t("ประกาศเตือนภัยกรมอุตุฯ")}</h2>
      {sourceLine(warnings.status, "กำลังโหลดประกาศเตือน…", "ประกาศเตือนไม่พร้อมใช้งาน")}
      {warnings.data && (warnings.data.items.length ? <TmdWarningList items={warnings.data.items} limit={3} /> : <p className="text-muted text-sm">{t("ไม่มีประกาศเตือนในขณะนี้")}</p>)}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("มีอะไรใหม่ตั้งแต่ครั้งก่อน")}>
      <h2 className="text-lg font-semibold">{t("มีอะไรใหม่ตั้งแต่ครั้งก่อน")}</h2>
      {!seen
        ? <p className="text-muted text-sm">{t("ครั้งแรกที่เปิด — ครั้งหน้าจะบอกว่ามีอะไรเปลี่ยน")}</p>
        : rivers.status === "loading" || dams.status === "loading" ? <p className="text-muted text-sm">{t("กำลังโหลดการเปลี่ยนแปลง…")}</p>
        : rivers.status === "error" || dams.status === "error" ? <p className="text-muted text-sm">{t("ข้อมูลการเปลี่ยนแปลงไม่พร้อมใช้งาน")}</p>
        : news.length ? <ul className="space-y-1 text-sm">{news.map((item) => <li key={item.key}>{t(item.text, {
          ...item.params, from: t(String(item.params.from ?? "—")), to: t(String(item.params.to ?? "—")),
        })}</li>)}</ul>
        : <p className="text-muted text-sm">{t("ยังไม่มีข้อมูลเปลี่ยนแปลง")}</p>}
    </section>
    <section className="placeholder-card space-y-3" aria-label={t("แม่น้ำใกล้คุณ")}>
      <h2 className="text-lg font-semibold">{t("แม่น้ำใกล้คุณ")}</h2>
      {sourceLine(rivers.status, "กำลังโหลดข้อมูลแม่น้ำ…", "ข้อมูลแม่น้ำไม่พร้อมใช้งาน")}
      {rivers.data && <>
        <ul className="divide-y divide-[var(--border)]">{(showAll ? nearbyRivers : nearbyRivers.slice(0, 3)).map(({ point, km }) => {
          const detail = point.summary;
          const upstream = dams.data?.dams.find((dam) => dam.id === point.downstreamOfDam);
          const watchedNow = Boolean(watch[`river:${point.id}`]);
          return <li key={point.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="font-semibold">{t.locale === "en" ? point.nameEn || point.nameTh : point.nameTh}</h3><p className="text-muted text-xs">{t("{km} กม.", { km: number.format(km) })}</p></div>
              {detail && <button type="button" className="min-h-11 min-w-11 text-xl" aria-label={t(watchedNow ? "เลิกติดตามแม่น้ำนี้" : "ติดตามแม่น้ำนี้")} aria-pressed={watchedNow} onClick={() => changeWatch({ kind: "river", id: point.id, value: detail.today.value, unit: "cms", date: detail.today.date })}>{watchedNow ? "★" : "☆"}</button>}
            </div>
            {detail ? <div className="mt-1 space-y-1 text-sm">
              <p><span className="font-semibold" style={{ color: riverColors[detail.today.status] }}>{t(statusWord(detail.today.status))}</span> · {t("{value} ลบ.ม./วินาที (แบบจำลอง)", { value: number.format(detail.today.value) })} <span aria-label={t(detail.trend === "rising" ? "กำลังเพิ่ม" : detail.trend === "falling" ? "กำลังลด" : "คงที่")}>{detail.trend === "rising" ? "↗" : detail.trend === "falling" ? "↘" : "→"}</span></p>
              <p className="text-muted text-xs">{t("ข้อมูลวันที่ {date}", { date: dateLabel(detail.today.date, t.locale) })}</p>
              <RiverChart days={detail.days} color={riverColors[detail.today.status]} />
              <p className="text-muted text-xs">{t("เส้น: ปริมาณน้ำไหลผ่านแบบจำลอง · แถบ: ช่วงปกติ p25–p75")}</p>
              {detail.peak && <p>{t("สูงสุดใน 7 วัน {value} วันที่ {date}", { value: number.format(detail.peak.value), date: dateLabel(detail.peak.date, t.locale) })}</p>}
              {detail.rare && <p>{t(rareLevelWord(detail.rare))}</p>}
              {upstream && <p>{t("ปริมาณจริงขึ้นกับการระบายของเขื่อน{name} (ระบาย {release} ลบ.ม./วินาที)", { name: t.locale === "en" ? upstream.nameEn || upstream.nameTh : upstream.nameTh, release: upstream.releaseCms === null ? "—" : number.format(upstream.releaseCms) })}</p>}
              {detail.value2554Today !== null && <p>{t("วันนี้ปี 2554: {value} ลบ.ม./วินาที", { value: number.format(detail.value2554Today) })}</p>}
            </div> : <p className="text-muted text-sm">{t("ข้อมูลจุดนี้ไม่พร้อมใช้งาน")}</p>}
          </li>;
        })}</ul>
        {!showAll && nearbyRivers.length > 3 && <button type="button" className="min-h-11 font-semibold text-given underline" onClick={() => setShowAll(true)}>{t("ดูทุกจุด ({n})", { n: nearbyRivers.length })}</button>}
      </>}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("ที่ติดตาม")}>
      <h2 className="text-lg font-semibold">{t("ที่ติดตาม")}</h2>
      {(rivers.status === "error" || dams.status === "error") && <p className="text-muted text-sm" role="status">{t("รายการติดตามบางส่วนไม่พร้อมใช้งาน")}</p>}
      {rivers.status === "loading" || dams.status === "loading" ? <p className="text-muted text-sm">{t("กำลังโหลดรายการติดตาม…")}</p>
        : watched.length ? <ul className="divide-y divide-[var(--border)]">{watched.map(({ item, change, since }) => {
          const dam = item.kind === "dam" ? dams.data?.dams.find((entry) => entry.id === item.id) : null;
          const river = item.kind === "river" ? rivers.data?.points.find((entry) => entry.id === item.id) : null;
          return <li key={`${item.kind}:${item.id}`} className="flex flex-wrap justify-between gap-1 py-2 text-sm">
            <span>{dam ? t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh : river ? t.locale === "en" ? river.nameEn || river.nameTh : river.nameTh : item.id}</span>
            <span>{oneDecimal.format(item.value)} {item.unit === "pct" ? "%" : t("ลบ.ม./วินาที")}{change !== null && <span className="text-muted"> · {change > 0 ? "+" : ""}{oneDecimal.format(change)} {item.unit === "pct" ? "%" : t("ลบ.ม./วินาที")}{since && ` (${dateLabel(since, t.locale)})`}</span>}</span>
          </li>;
        })}</ul> : <p className="text-muted text-sm">{t("ยังไม่มีรายการติดตาม")}</p>}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("เขื่อนใกล้คุณ")}>
      <h2 className="text-lg font-semibold">{t("เขื่อนใกล้คุณ")}</h2>
      {sourceLine(dams.status, "กำลังโหลดข้อมูลเขื่อน…", "ข้อมูลเขื่อนไม่พร้อมใช้งาน")}
      {summary && <>
        {dams.data?.dataDate && <p className="text-muted text-xs">{t("ข้อมูลวันที่ {date}", { date: dateLabel(dams.data.dataDate, t.locale) })}</p>}
        <p className="text-muted text-sm">{t("เขื่อนน้ำมาก (เกิน 80%)")} {summary.over80} · {t("เกินความจุ")} {summary.over100} · {t("ระบายน้ำมาก")} {summary.highRelease}{summary.heavyRain !== null && <> · {t("สถานีฝนหนัก")} {summary.heavyRain}</>}</p>
        <ul className="divide-y divide-[var(--border)]">{nearbyDams.map(({ dam, km }) => <li key={dam.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh} · {t("{km} กม.", { km: number.format(km) })}</span><span className="font-semibold" style={{ color: damBandColor(dam.band) }}>● {oneDecimal.format(dam.storagePct)}%</span><span className="text-muted text-xs">{t("ข้อมูลวันที่ {date}", { date: dateLabel(dam.date, t.locale) })}</span></li>)}</ul>
      </>}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("ฝนหนัก 24 ชม. ใกล้คุณ")}>
      <h2 className="text-lg font-semibold">{t("ฝนหนัก 24 ชม. ใกล้คุณ")}</h2>
      {sourceLine(rain.status, "กำลังโหลดข้อมูลฝนหนัก…", "ข้อมูลฝนหนักไม่พร้อมใช้งาน")}
      {rain.data && (rainNear.length ? <ul className="space-y-2 text-sm">{rainNear.map((station) => <li key={station.id} className="flex justify-between gap-2"><span>{t.locale === "en" ? station.nameEn || station.nameTh : station.nameTh}</span><span>{t("{mm} มม. · {category}", { mm: oneDecimal.format(station.rainMm), category: t(station.category === "veryHeavy" ? "ฝนหนักมาก" : "ฝนหนัก") })}</span></li>)}</ul> : <p className="text-muted text-sm">{t("ไม่มีสถานีฝนหนักภายใน 150 กม.")}</p>)}
      {rain.data?.observedAt && <p className="text-muted text-xs">{t("ข้อมูลวันที่ {date}", { date: formatFullDate(rain.data.observedAt, "Asia/Bangkok", t.locale) })}</p>}
    </section>
    <section className="placeholder-card space-y-3 text-sm" aria-label={t("เบอร์ฉุกเฉิน")}>
      <h2 className="text-lg font-semibold">{t("เบอร์ฉุกเฉิน")}</h2>
      <div className="flex flex-wrap gap-3">{EMERGENCY_NUMBERS.map(({ label, number: phone, href }) => <a key={phone} className="font-semibold text-given underline" href={href}>{t(label)}</a>)}</div>
      <p className="text-muted">{t("ปริมาณน้ำไหลผ่าน: แบบจำลอง GloFAS ผ่าน Open-Meteo (CC BY 4.0) · เขื่อน: กรมชลประทาน · ฝน/ประกาศ: กรมอุตุนิยมวิทยา")}</p>
      <p className="text-muted">{t("ประมาณการจากแบบจำลอง GloFAS ความละเอียด 5 กม. · ไม่ใช่ค่าที่วัดจริงจากสถานี · ไม่ใช่แผนที่น้ำท่วม")}</p>
    </section>
  </main>;
}
