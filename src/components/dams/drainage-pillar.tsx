"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useT } from "@/i18n/client";
import { SourceTime } from "@/components/ui/source-time";
import { useWaterSource, type Load } from "@/hooks/use-water-source";
import type { DamsPayload } from "@/lib/dams/client";
import type { DamTrend } from "@/lib/dams/trend";
import type { Place } from "@/lib/place";
import { nationalDrainage, inProvince, sevenDayChange } from "@/lib/dams/pillar";
import { nearestDams } from "@/lib/dams/summary";
import { nearestProvince } from "@/lib/map/nearest";
import { provinces } from "@/lib/provinces";
import { distanceKm } from "@/lib/storms/normalize";
import downstream from "../../../public/data/dam-downstream.json";
import { TankGrid } from "./tank-grid";

export const validTrend = (value: DamTrend) => Array.isArray(value?.dates) && !!value?.release && !!value?.inflow && !!value?.pct;
function subscribeProvince(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}
const provinceSnapshot = () => new URLSearchParams(window.location.search).get("province");
const serverProvince = () => null;
const routes: Record<string, { provinces: { id: string }[] }> = downstream.dams;
export const downstreamProvinceIds = (id: string) => (routes[id]?.provinces ?? []).slice(0, 4).map((entry) => entry.id);

export function DownstreamProvinces({ id }: { id: string }) {
  const t = useT();
  const entries = downstreamProvinceIds(id).flatMap((id) => provinces.filter((province) => province.id === id));
  return <p className="text-muted text-sm">{t("จังหวัดท้ายน้ำโดยประมาณ")}: {entries.length ? entries.map((entry) => t.locale === "en" ? entry.en : entry.th).join(" · ") : t("ไม่พบข้อมูลจังหวัดท้ายน้ำ")}</p>;
}

export function DrainagePillar({ dams, place }: { dams: Load<DamsPayload>; place: Place }) {
  const t = useT();
  const trend = useWaterSource("/api/dams-trend", validTrend);
  const provinceId = useSyncExternalStore(subscribeProvince, provinceSnapshot, serverProvince);
  const province = provinces.find((entry) => entry.id === provinceId) ?? nearestProvince(place.lat, place.lon);
  const [region, setRegion] = useState("");
  const [sort, setSort] = useState<"near" | "release" | "inflow" | "pct" | "change">("near");
  const [ascending, setAscending] = useState(false);
  const payload = dams.data;
  const date = payload?.dataDate;
  const summary = date && payload ? nationalDrainage(payload.dams, date, trend.data) : null;
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const value = (n: number | null) => n === null ? "—" : number.format(n);
  const missing = (n: number) => t("ขาดรายงาน {n} / 35 เขื่อน", { n });
  const near = nearestDams(payload?.dams ?? [], place, 3);
  const top = (payload?.dams ?? []).filter((dam) => dam.date === date && dam.releaseCms !== null).sort((a, b) => b.releaseCms! - a.releaseCms! || a.id.localeCompare(b.id)).slice(0, 5);
  const regions = [...new Set((payload?.dams ?? []).map((dam) => dam.basin.th))];
  const rows = (payload?.dams ?? []).filter((dam) => !region || dam.basin.th === region).sort((a, b) => {
    if (sort === "near") return distanceKm(place, a) - distanceKm(place, b) || a.id.localeCompare(b.id);
    const metric = (dam: typeof a) => sort === "release" ? dam.releaseCms : sort === "inflow" ? dam.inflowCms : sort === "pct" ? dam.storagePct : sevenDayChange(trend.data, dam.id, dam.date);
    const av = metric(a), bv = metric(b);
    if (av === null) return bv === null ? a.id.localeCompare(b.id) : 1;
    if (bv === null) return -1;
    return (ascending ? av - bv : bv - av) || a.id.localeCompare(b.id);
  });
  const provincial = (payload?.dams ?? []).filter((dam) => inProvince(dam, province.id, routes));
  function selectProvince(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("province", id);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("popstate"));
  }
  const name = (dam: { nameTh: string; nameEn: string }) => t.locale === "en" ? dam.nameEn || dam.nameTh : dam.nameTh;
  function heading(key: Exclude<typeof sort, "near">, label: string) {
    return <th scope="col" aria-sort={sort === key ? ascending ? "ascending" : "descending" : "none"}><button type="button" className="min-h-11 px-2 underline" onClick={() => { setSort(key); setAscending(sort === key ? !ascending : false); }}>{t(label)}{sort === key ? ascending ? " ↑" : " ↓" : ""}</button></th>;
  }
  return <div className="space-y-4">
    <section className="placeholder-card space-y-3" aria-label={t("ภาพรวมประเทศ")}>
      <h2 className="text-lg font-semibold">{t("ภาพรวมประเทศ")}</h2>
      {summary ? <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div><h3 className="font-semibold">{t("ระบายรวมวันนี้ vs เมื่อวาน")}</h3><p>{t("{cms} ลบ.ม./วินาที", { cms: value(summary.today.value) })}</p><p className="text-muted">{missing(summary.today.missing)}</p><SourceTime source="กรมชลประทาน" date={date} kind="daily" /><p>{t("เมื่อวาน: {cms} ลบ.ม./วินาที", { cms: value(summary.yesterday.value) })}</p><p className="text-muted">{missing(summary.yesterday.missing)}</p><SourceTime source="กรมชลประทาน" date={summary.yesterdayDate} kind="daily" />{trend.status !== "ready" && <p role="status">{t(trend.status === "loading" ? "กำลังโหลดข้อมูลส่วนนี้…" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน")}</p>}</div>
        <div><h3 className="font-semibold">{t("เขื่อน >80% / >100%")}</h3><p>{summary.over80} / {summary.over100}</p><p className="text-muted">{missing(summary.missingStorage)}</p><SourceTime source="กรมชลประทาน" date={date} kind="daily" /></div>
        <div><h3 className="font-semibold">{t("เขื่อนที่ระบายมากกว่าไหลเข้า")}</h3><p>{summary.releasingMore}</p><p className="text-muted">{missing(summary.missingComparison)}</p><SourceTime source="กรมชลประทาน" date={date} kind="daily" /></div>
      </div> : <p role="status" className="text-muted text-sm">{t(dams.status === "loading" ? "กำลังโหลดข้อมูลเขื่อน…" : "ข้อมูลเขื่อนไม่พร้อมใช้งาน")}</p>}
    </section>
    <TankGrid dams={payload?.dams ?? []} date={date ?? null} trend={trend.data} />
    <section className="placeholder-card space-y-2" aria-label={t("เขื่อนใกล้คุณ")}>
      <h2 className="text-lg font-semibold">{t("เขื่อนใกล้คุณ")}</h2>
      <ul className="text-sm">{near.map(({ dam, km }) => <li key={dam.id}><Link href={`/dam/${dam.id}`} className="inline-flex min-h-11 items-center font-semibold text-given underline">{name(dam)} · {t("{km} กม.", { km: number.format(km) })}</Link><SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" /></li>)}</ul>
      <label className="flex flex-wrap items-center gap-2 text-sm"><span>{t("จังหวัด")}</span><select aria-label={t("จังหวัด")} className="min-h-11 max-w-full rounded-full border border-[var(--border)] bg-[var(--card)] px-3" value={province.id} onChange={(event) => selectProvince(event.target.value)}>{provinces.map((entry) => <option key={entry.id} value={entry.id}>{t.locale === "en" ? entry.en : entry.th}</option>)}</select></label>
      <p className="text-muted text-xs">{t("เขื่อนในจังหวัดหรือมีเส้นทางท้ายน้ำผ่านโดยประมาณ")}</p>
      {payload && (provincial.length ? <div className="flex flex-wrap gap-2">{provincial.map((dam) => <Link key={dam.id} className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] px-3 text-sm" href={`/dam/${dam.id}`}>{name(dam)}</Link>)}</div> : <p className="text-muted text-sm">{t("ไม่พบเขื่อนที่เกี่ยวข้องกับจังหวัดนี้ในข้อมูลเส้นทาง")}</p>)}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("เขื่อนที่ปล่อยน้ำมาก")}>
      <h2 className="text-lg font-semibold">{t("เขื่อนที่ปล่อยน้ำมาก")}</h2>
      <ol className="divide-y divide-[var(--border)]">{top.map((dam) => <li key={dam.id} className="py-2"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-given underline" href={`/dam/${dam.id}`}>{name(dam)} · {t("{cms} ลบ.ม./วินาที", { cms: value(dam.releaseCms) })}</Link><DownstreamProvinces id={dam.id} /><SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" /></li>)}</ol>
      {payload && !top.length && <p className="text-muted text-sm">{t("ไม่พบรายงานการระบายของวันนี้")}</p>}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("เขื่อนทั้งหมด")}>
      <h2 className="text-lg font-semibold">{t("เขื่อนทั้งหมด")}</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm"><label>{t("ภาค")} <select aria-label={t("ภาค")} className="min-h-11 rounded border border-[var(--border)] bg-[var(--card)] px-2" value={region} onChange={(event) => setRegion(event.target.value)}><option value="">{t("ทุกภาค")}</option>{regions.map((entry) => <option key={entry} value={entry}>{t(entry)}</option>)}</select></label><button type="button" className="min-h-11 px-2 underline" onClick={() => setSort("near")}>{t("ใกล้ฉันก่อน")}</button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{t("เขื่อนทั้งหมด")}</caption><thead><tr><th scope="col">{t("เขื่อน")}</th>{heading("release", "ระบาย (ลบ.ม./วินาที)")}{heading("inflow", "ไหลเข้า (ลบ.ม./วินาที)")}{heading("pct", "ปริมาณน้ำในเขื่อน (%)")}{heading("change", "เปลี่ยน 7 วัน (จุดเปอร์เซ็นต์)")}</tr></thead><tbody>{rows.map((dam) => <tr key={dam.id} className="border-t border-[var(--border)]"><th scope="row" className="min-w-36 py-2 font-normal"><Link className="inline-flex min-h-11 items-center font-semibold text-given underline" href={`/dam/${dam.id}`}>{name(dam)}</Link><p><SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" /></p></th><td className="px-2 tabular-nums">{value(dam.releaseCms)}</td><td className="px-2 tabular-nums">{value(dam.inflowCms)}</td><td className="px-2 tabular-nums">{value(dam.storagePct)}</td><td className="px-2 tabular-nums">{value(sevenDayChange(trend.data, dam.id, dam.date))}</td></tr>)}</tbody></table></div>
      <p className="text-muted text-xs">{t("ช่องว่างหมายถึงไม่มีรายงาน ไม่ใช่ศูนย์")}</p>
    </section>
  </div>;
}
