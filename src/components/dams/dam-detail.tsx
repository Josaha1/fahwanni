"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";
import { SourceTime } from "@/components/ui/source-time";
import { useWaterSource } from "@/hooks/use-water-source";
import type { DamsPayload } from "@/lib/dams/client";
import type { DwrPayload } from "@/lib/dams/dwr-client";
import type { DamHistory } from "@/lib/dams/history";
import type { RegisteredDam } from "@/lib/dams/registry";
import { sourceTimeMs } from "@/lib/freshness";
import { distanceKm } from "@/lib/storms/normalize";
import { sumRelease } from "@/lib/rivers/observed";
import observed from "../../../public/data/observed-points.json";
import { DownstreamProvinces, validTrend } from "./drainage-pillar";
import { DamTrendChart } from "./dam-trend-chart";

const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
const validHistory = (value: DamHistory) => typeof value?.dataDate === "string";
const validDwr = (value: DwrPayload) => Array.isArray(value?.reservoirs);

export function DamDetail({ registered }: { registered: RegisteredDam }) {
  const t = useT();
  const dams = useWaterSource("/api/dams", validDams);
  const trend = useWaterSource("/api/dams-trend", validTrend);
  const history = useWaterSource("/api/dams-history", validHistory);
  const dwr = useWaterSource("/api/dams-all", validDwr);
  const dam = dams.data?.dams.find((entry) => entry.id === registered.id);
  const date = dams.data?.dataDate;
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const value = (n: number | null | undefined) => n == null ? "—" : number.format(n);
  const historyDate = (date: string | undefined) => {
    const at = sourceTimeMs(date);
    return at === null ? t("ไม่ทราบวันที่ข้อมูล") : new Intl.DateTimeFormat(t.intl, {
      day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
    }).format(new Date(at));
  };
  const points = observed.points.filter((point) => point.dams.includes(registered.id));
  const nearby = (dwr.data?.reservoirs ?? []).filter((reservoir) => reservoir.kind === "reservoir").map((reservoir) => ({ reservoir, km: distanceKm(registered, reservoir) })).sort((a, b) => a.km - b.km || a.reservoir.code.localeCompare(b.reservoir.code)).slice(0, 5);
  const comparisons = [
    { label: "ปีที่แล้ว (วันเดียวกัน)", entry: history.data?.lastYear },
    { label: "ปี 2554 (วันเดียวกัน)", entry: history.data?.year2554 },
  ];
  const status = (loading: boolean) => <p className="text-muted text-sm" role="status">{t(loading ? "กำลังโหลดข้อมูลส่วนนี้…" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน")}</p>;
  return <main className="app-shell space-y-4" style={{ paddingBottom: "calc(var(--nav-h, 88px) + 2rem)" }}>
    <header><Link className="inline-flex min-h-11 items-center text-given underline" href="/water">{t("การระบายน้ำจากเขื่อน")}</Link><h1 className="text-2xl font-semibold">{t.locale === "en" ? registered.nameEn : registered.nameTh}</h1></header>
    <section className="placeholder-card space-y-2">
      {dam ? <><p>{t("ระบาย (ลบ.ม./วินาที)")}: {value(dam.releaseCms)}</p><p>{t("ไหลเข้า (ลบ.ม./วินาที)")}: {value(dam.inflowCms)}</p><p>{t("ปริมาณน้ำในเขื่อน (%)")}: {value(dam.storagePct)}</p><SourceTime source="กรมชลประทาน" date={dam.date} kind="daily" /></> : status(dams.status === "loading")}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")}>
      <h2 className="text-lg font-semibold">{t("การระบาย ไหลเข้า และปริมาณน้ำในเขื่อน 7 วัน")}</h2>
      {trend.data && date ? <DamTrendChart trend={trend.data} id={registered.id} date={date} /> : status(trend.status === "loading" || dams.status === "loading")}
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("ปริมาณน้ำในเขื่อน: วันเดียวกันในอดีต")}>
      <h2 className="text-lg font-semibold">{t("ปริมาณน้ำในเขื่อน: วันเดียวกันในอดีต")}</h2>
      {history.data && date && history.data.dataDate === date ? <ul className="space-y-2 text-sm">{comparisons.map(({ label, entry }) => <li key={label}>{t(label)}: {entry?.pct[registered.id] == null ? t("ไม่พบข้อมูลในวันที่เปรียบเทียบ") : `${value(entry.pct[registered.id])}%`}<p><span className="text-muted text-xs">{t("กรมชลประทาน")} · {historyDate(entry?.date)}</span></p></li>)}</ul> : status(history.status === "loading")}
      <p className="text-muted text-xs">{t("ตัวเลขปี 2554 อย่างเดียวไม่ได้บอกว่าจะท่วม ปี 2554 ท่วมเพราะฝน เขื่อนเต็ม และจังหวะเวลาประกอบกัน")}</p>
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("จังหวัดท้ายน้ำโดยประมาณ")}>
      <h2 className="text-lg font-semibold">{t("จังหวัดท้ายน้ำโดยประมาณ")}</h2><DownstreamProvinces id={registered.id} />
      <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-given underline" href={`/map?mode=water&dam=${registered.id}&routes=1&lat=${registered.lat}&lon=${registered.lon}&z=7`}>{t("ดูเส้นทางระบายน้ำบนแผนที่")}</Link>
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("จุดแม่น้ำที่รับน้ำจากเขื่อนนี้")}>
      <h2 className="text-lg font-semibold">{t("จุดแม่น้ำที่รับน้ำจากเขื่อนนี้")}</h2>
      {points.length ? <ul className="space-y-3 text-sm">{points.map((point) => {
        // A shared river point includes all its upstream dams; stale reports cannot stand in for today's release.
        const release = sumRelease(point.dams, (dams.data?.dams ?? []).filter((dam) => dam.date === date), trend.data);
        return <li key={point.id}><Link className="inline-flex min-h-11 items-center font-semibold text-given underline" href={`/map?mode=water&river=${point.id}&lat=${point.lat}&lon=${point.lon}&z=8`}>{t.locale === "en" ? point.nameEn : point.nameTh}</Link><p>{t("ระบายรวมจากเขื่อนต้นน้ำ: {cms} ลบ.ม./วินาที", { cms: value(release?.today?.totalCms) })}</p><p className="text-muted">{t("ขาดรายงานเขื่อนต้นน้ำ {n} แห่ง", { n: release?.today?.missing.length ?? point.dams.length })}</p><SourceTime source="กรมชลประทาน" date={date} kind="daily" /></li>;
      })}</ul> : <p className="text-muted text-sm">{t("ไม่พบจุดแม่น้ำที่เชื่อมกับเขื่อนนี้ในข้อมูล")}</p>}
      <p className="text-muted text-xs">{t("การระบายรวมจากเขื่อนต้นน้ำ ไม่ใช่ค่าที่วัด ณ จุดแม่น้ำ")}</p>
    </section>
    <section className="placeholder-card space-y-2" aria-label={t("อ่าง DWR ใกล้เขื่อน")}>
      <h2 className="text-lg font-semibold">{t("อ่าง DWR ใกล้เขื่อน")}</h2>
      {dwr.data ? <ul className="space-y-2 text-sm">{nearby.map(({ reservoir, km }) => <li key={reservoir.code}><Link className="inline-flex min-h-11 items-center font-semibold text-given underline" href={`/map?mode=water&lat=${reservoir.lat}&lon=${reservoir.lon}&z=12`}>{reservoir.name} · {t("{km} กม.", { km: number.format(km) })}</Link><p>{reservoir.pct === null ? t("ไม่พบข้อมูลปริมาณน้ำในอ่าง") : t("ปริมาณน้ำในอ่าง: {pct}%", { pct: value(reservoir.pct) })}</p><SourceTime source="กรมทรัพยากรน้ำ (DWR)" date={reservoir.measuredAt} kind="daily" /></li>)}</ul> : status(dwr.status === "loading")}
    </section>
  </main>;
}
