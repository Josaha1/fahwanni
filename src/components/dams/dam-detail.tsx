"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/i18n/client";
import { FollowButton } from "@/components/follow-button";
import { useFollowed } from "@/hooks/use-followed";
import { EmergencyStrip } from "@/components/emergency-strip";
import { SourceTime } from "@/components/ui/source-time";
import { ShareButton } from "@/components/share-button";
import { MapBackLink } from "@/components/sheet/map-back-link";
import { useWaterSource } from "@/hooks/use-water-source";
import { useLite } from "@/hooks/use-lite";
import type { DamsPayload } from "@/lib/dams/client";
import type { DamHistory } from "@/lib/dams/history";
import type { RegisteredDam } from "@/lib/dams/registry";
import { sourceTimeMs } from "@/lib/freshness";
import { provinces } from "@/lib/provinces";
import { riverSystemForDam } from "@/lib/rivers/systems";
import downstream from "../../../public/data/dam-downstream.json";
import { validTrend } from "./drainage-pillar";
import { DamHero } from "./dam-hero";
import { DamChartDetails, DamReleaseBars, DamTrendChart } from "./dam-trend-chart";
import type { DamReservoirGeo } from "@/components/map/layers/use-dam-reservoir-layer";
import "./dam-detail.css";

const MapView = dynamic(() => import("@/components/map/map-view").then((module) => module.MapView), { ssr: false });
const validDams = (value: DamsPayload) => Array.isArray(value?.dams);
const validHistory = (value: DamHistory) => typeof value?.dataDate === "string";
const validGeo = (value: DamReservoirGeo) => Array.isArray(value?.reservoir);

export function DamDetail({ registered }: { registered: RegisteredDam }) {
  const t = useT();
  const { lite, reducedMotion } = useLite();
  const dams = useWaterSource("/api/dams", validDams);
  const trend = useWaterSource("/api/dams-trend", validTrend);
  const history = useWaterSource("/api/dams-history", validHistory);
  const geo = useWaterSource(`/data/dam-geo/${registered.id}.json`, validGeo);
  useFollowed({ dams: dams.data, flood: null, warnings: null });
  const dam = dams.data?.dams.find((entry) => entry.id === registered.id);
  const riverSystem = riverSystemForDam(registered.id);
  const date = dam?.date ?? dams.data?.dataDate ?? undefined;
  const name = t.locale === "en" ? registered.nameEn : registered.nameTh;
  const province = provinces.find((entry) => entry.id === registered.provinceId);
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 });
  const value = (n: number | null | undefined) => n == null ? t("ไม่รายงาน") : number.format(n);
  const stops = (downstream.dams as Record<string, { provinces: { id: string; km: number }[] }>)[registered.id]?.provinces ?? [];
  const comparisons = [
    { label: "ปีที่แล้ว", entry: history.data?.lastYear },
    { label: "2554", entry: history.data?.year2554 },
  ];
  const stamp = (at?: string) => at ?? t("ไม่ทราบวันที่ข้อมูล");
  const shareText = [name,
    `${t("ปริมาณน้ำในเขื่อน (%)")}: ${value(dam?.storagePct)} · ${t("กรมชลประทาน")} · ${stamp(date)}`,
    `${t("ระบาย (ลบ.ม./วินาที)")}: ${value(dam?.releaseCms)} · ${t("กรมชลประทาน")} · ${stamp(date)}`,
    `${t("ไหลเข้า (ลบ.ม./วินาที)")}: ${value(dam?.inflowCms)} · ${t("กรมชลประทาน")} · ${stamp(date)}`,
    `${t("เก็บกัก / ความจุ (ล้าน ม³)")}: ${value(dam?.storageMcm)} / ${value(dam?.capacityMcm)} · ${t("กรมชลประทาน")} · ${stamp(date)}`,
    ...comparisons.map(({ label, entry }) => `${t(label)}: ${history.data?.dataDate === date ? value(entry?.pct[registered.id]) : t("ไม่พบข้อมูลในวันที่เปรียบเทียบ")} · ${t("กรมชลประทาน")} · ${stamp(history.data?.dataDate === date ? entry?.date : undefined)}`),
    `${t("ที่มา")}: https://app.rid.go.th/reservoir/`,
  ].join("\n");
  const status = (loading: boolean) => <p className="text-muted text-sm" role="status">{t(loading ? "กำลังโหลดข้อมูลส่วนนี้…" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน")}</p>;
  const polygon = geo.data?.reservoir.some((ring) => ring.role === "outer" && ring.coordinates.length >= 4) ? geo.data : null;
  return <main className="dam-page">
    {!lite && !reducedMotion && <div className="dam-map"><MapView key={registered.id} homeLens="dams" damDetail={{ registered, geo: polygon, pct: dam?.storagePct ?? null }} /></div>}
    <div className="dam-sheet">
      <header><MapBackLink /><h1>{name}{province && <small> · {t.locale === "en" ? province.en : province.th}</small>}</h1></header>
      <div className="dam-actions"><FollowButton item={{ kind: "dam", id: registered.id, value: dam?.storagePct ?? 0, unit: "pct", date: dam?.date ?? "" }} /></div>
      {dam ? <DamHero dam={dam} trend={trend.data} /> : status(dams.status === "loading")}
      <section aria-label={t("ระบาย 7 วัน (ลบ.ม./วินาที)")}><h2>{t("ระบาย 7 วัน (ลบ.ม./วินาที)")}</h2>
        {trend.data && date ? <><DamReleaseBars trend={trend.data} id={registered.id} date={date} showDetails={false} /><DamChartDetails trend={trend.data} id={registered.id} date={date} /></> : status(trend.status === "loading")}
      </section>
      <section aria-label={t("ปริมาณน้ำในเขื่อน: วันเดียวกันในอดีต")}>
        <h2>{t("ปริมาณน้ำในเขื่อน: วันเดียวกันในอดีต")}</h2>
        {history.data && date && history.data.dataDate === date ? <ul className="dam-history">{comparisons.map(({ label, entry }) => {
          const at = sourceTimeMs(entry?.date);
          return <li key={label}>{t(label)} {entry?.pct[registered.id] == null ? t("ไม่พบข้อมูลในวันที่เปรียบเทียบ") : `${value(entry.pct[registered.id])}%`}
            {" · "}{at === null ? t("ไม่ทราบวันที่ข้อมูล") : new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(at))}
          </li>;
        })}</ul> : status(history.status === "loading")}
        <p className="text-muted text-xs">{t("ที่มา")}: {t("กรมชลประทาน")}</p>
      </section>
      <section><h2>{t("น้ำที่ระบายไหลผ่าน (ตามแม่น้ำ โดยประมาณ)")}</h2>
        <div className="dam-downstream min-w-0 max-w-full overflow-x-auto">{[...stops].sort((a, b) => a.km - b.km).map((stop) => {
          const province = provinces.find((entry) => entry.id === stop.id);
          return <Link key={stop.id} href={`/province/${stop.id}`}><i aria-hidden="true" />{province ? t.locale === "en" ? province.en : province.th : stop.id}<small>{t("{km} กม.", { km: number.format(stop.km) })}</small></Link>;
        })}</div>
        {!stops.length && <p className="text-muted text-xs">{t("ไม่พบข้อมูลจังหวัดท้ายน้ำ")}</p>}
        <SourceTime source="HydroRIVERS (CC BY 4.0)" date={downstream.generatedAt} kind="daily" nowMs={sourceTimeMs(downstream.generatedAt) ?? undefined} />
      </section>
      <div className="dam-actions">{riverSystem && <Link className="dam-river-link" href={`/river/${riverSystem.id}`}>{t("ดูทั้งลุ่มน้ำ")} ▸</Link>}<button type="button" disabled={!dam} onClick={async () => {
        try { await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`); toast.success(t("คัดลอกแล้ว")); }
        catch { toast.error(t("คัดลอกไม่สำเร็จ")); }
      }}>{t("คัดลอกพร้อมที่มา")}</button><ShareButton text={shareText} /></div>
      {polygon && !lite && !reducedMotion && <p className="text-muted text-xs">{t("รูปอ่างจาก OpenStreetMap ระบายสีตาม % ความจุ ไม่ใช่ระดับน้ำจริง")} · © OpenStreetMap contributors (ODbL)</p>}
      <section><h2>{t("เก็บกัก 7 วัน (% ความจุ)")}</h2>
        {trend.data && date ? <DamTrendChart trend={trend.data} id={registered.id} date={date} storageOnly showDetails={false} /> : status(trend.status === "loading")}
      </section>
      <EmergencyStrip />
    </div>
  </main>;
}
