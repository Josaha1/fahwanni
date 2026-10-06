"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";
import { useWaterSource } from "@/hooks/use-water-source";
import { SourceTime } from "@/components/ui/source-time";
import { MapBackLink } from "@/components/sheet/map-back-link";
import { FLOOD_EVENT_WORDS } from "@/components/water/flood-events";
import { validDams, validEvents, validWarnings } from "@/components/provinces/data";
import { alertRows } from "./alert-data";
import "../dams/dam-detail.css";
import "./alerts-detail.css";

export function AlertsDetail() {
  const t = useT();
  const warnings = useWaterSource("/api/tmd-warnings", validWarnings);
  const events = useWaterSource("/api/flood-events", validEvents);
  const dams = useWaterSource("/api/dams", validDams);
  const rows = alertRows(warnings.data, events.data, dams.data);
  const number = (value: number | null) => value === null ? "—" : new Intl.NumberFormat(t.intl, { maximumFractionDigits: 1 }).format(value);
  return <main className="dam-page"><div className="dam-sheet alerts-sheet">
    <header><MapBackLink /><h1>{t("แจ้งเตือน")}</h1></header>
    {warnings.data?.items.length === 0 && <p className="text-muted text-xs">{t("ไม่มีประกาศเตือนภัย")} · <SourceTime source="TMD" time={warnings.loadedAt} kind="daily" /></p>}
    {[{ source: "TMD", load: warnings }, { source: "GLIDE / GDACS", load: events }, { source: "กรมชลประทาน", load: dams }].filter(({ load }) => load.status !== "ready").map(({ source, load }) => <p key={source} className="text-muted text-xs" role="status">{t(source)} · {t(load.status === "loading" ? "กำลังโหลดข้อมูลส่วนนี้…" : "ข้อมูลส่วนนี้ไม่พร้อมใช้งาน")}</p>)}
    <ol className="alerts-rows">{rows.map((row) => {
      const label = row.warning ? row.warning.title : row.event ? `${t(FLOOD_EVENT_WORDS[row.event.type])} · ${row.event.place}`
        : `${t.locale === "en" ? row.dam!.nameEn : row.dam!.nameTh} · ${number(row.dam!.storagePct)}% · ${t("ระบาย")} ${number(row.dam!.releaseCms)} ${t("ลบ.ม./วิ")}`;
      const content = <><i aria-hidden="true" style={{ background: `var(--${row.role})` }} /><span className="alerts-text"><span className="alerts-label">{label}</span>{/^\d{4}-\d{2}-\d{2}$/.test(row.date ?? "") ? <SourceTime source={row.source} date={row.date} kind="daily" /> : <SourceTime source={row.source} time={row.date} kind="daily" />}</span></>;
      return <li key={row.id}>{row.href.startsWith("/") ? <Link href={row.href}>{content}</Link> : <a href={row.href} target="_blank" rel="noopener noreferrer">{content}</a>}</li>;
    })}</ol>
    {!rows.length && warnings.data && events.data && dams.data && <p className="text-muted text-sm">{t("ไม่มีรายการแจ้งเตือนจากข้อมูลที่รายงาน")}</p>}
    <p className="text-muted text-xs">{t("ส้ม = เขื่อน >80% หรือระบาย ≥100 ลบ.ม./วินาที · ฟ้า = เหตุการณ์ · แดง = ประกาศ TMD")}</p>
  </div></main>;
}
