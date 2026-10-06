import type { T } from "@/i18n/core";
import { intlOf } from "@/i18n/core";
import type { Dam } from "@/lib/dams/types";
import type { DamTrend } from "@/lib/dams/trend";
import { previousDate } from "@/lib/dams/pillar";
import type { PixelCounts } from "@/lib/flood/viirs";
import { cloudPercent, waterPoints } from "@/components/sheet/home-data";
import downstream from "../../../public/data/dam-downstream.json";

export type SummaryCard = {
  title: string;
  path: string;
  metrics: { label: string; value: string; source: string; date: string }[];
  notes: string[];
};

// Report dates read the same as elsewhere in the app ("6 ต.ค.") rather than ISO.
const stamp = (date: string | null | undefined, t: T) => date && Number.isFinite(Date.parse(date))
  ? new Intl.DateTimeFormat(intlOf(t), { day: "numeric", month: "short", timeZone: "Asia/Bangkok" }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00+07:00` : date))
  : t("ไม่ทราบวันที่ข้อมูล");
const number = (value: number | null | undefined, date: string | null | undefined, t: T) =>
  value == null || !Number.isFinite(value) || !date || !Number.isFinite(Date.parse(date)) ? "—"
    : new Intl.NumberFormat(intlOf(t), { maximumFractionDigits: 1 }).format(value);

export function damSummaryCard(registered: { id: string; nameTh: string; nameEn: string }, dam: Dam | null | undefined, trend: DamTrend | null | undefined, t: T): SummaryCard {
  const date = dam?.date;
  const priorDate = date && Number.isFinite(Date.parse(date)) ? previousDate(date) : undefined;
  const index = priorDate ? trend?.dates.indexOf(priorDate) ?? -1 : -1;
  const prior = index < 0 ? null : trend?.release[registered.id]?.[index];
  const delta = dam?.releaseCms == null || prior == null ? null : dam.releaseCms - prior;
  const source = t("กรมชลประทาน");
  return {
    title: t.locale === "en" ? registered.nameEn : registered.nameTh,
    path: `/dam/${registered.id}`,
    metrics: [
      { label: t("ปริมาณน้ำในเขื่อน (%)"), value: number(dam?.storagePct, date, t), source, date: stamp(date, t) },
      { label: t("ระบาย (ลบ.ม./วินาที)"), value: number(dam?.releaseCms, date, t), source, date: stamp(date, t) },
      { label: t("เทียบเมื่อวาน"), value: delta == null ? "—" : `${delta > 0 ? "▲" : delta < 0 ? "▼" : "＝"} ${number(Math.abs(delta), date, t)} ${t("ลบ.ม./วินาที")}`, source,
        date: delta == null ? stamp(undefined, t) : `${stamp(date, t)} / ${stamp(priorDate, t)}` },
    ],
    notes: [],
  };
}

export function provinceSummaryCard(province: { id: string; th: string; en: string }, counts: PixelCounts | null | undefined, date: string | null | undefined, dams: Dam[] | null | undefined, t: T): SummaryCard {
  const observed = counts && counts.sampled > counts.insufficientData + counts.noData;
  const ids = Object.entries(downstream.dams).filter(([, entry]) => entry.provinces.some((stop) => stop.id === province.id)).map(([id]) => id);
  const highest = dams?.filter((dam) => ids.includes(dam.id) && dam.releaseCms != null).sort((a, b) => b.releaseCms! - a.releaseCms!)[0];
  const cloud = cloudPercent(counts);
  return {
    title: t.locale === "en" ? province.en : province.th,
    path: `/province/${province.id}`,
    metrics: [
      { label: t("ดาวเทียมพบน้ำ"), value: `${number(observed ? waterPoints(counts!) : null, date, t)} ${t("จุด")}`, source: "NASA VIIRS", date: stamp(date, t) },
      { label: t("เมฆ"), value: `${number(cloud, date, t)}%`, source: "NASA VIIRS", date: stamp(date, t) },
      { label: t("เขื่อนต้นน้ำที่ระบายมากสุด"), value: highest ? `${t.locale === "en" ? highest.nameEn : highest.nameTh} · ${number(highest.releaseCms, highest.date, t)} ${t("ลบ.ม./วินาที")}` : "—",
        // With no upstream release reported, the row still carries the RID report date.
        source: t("กรมชลประทาน"), date: stamp(highest?.date ?? dams?.find((dam) => ids.includes(dam.id))?.date, t) },
    ],
    notes: [t("จุดตรวจ ไม่ใช่ขนาดพื้นที่"), ...(cloud !== null && cloud >= 50 ? [t("เมฆบังมาก อาจมีน้ำที่มองไม่เห็น")] : [])],
  };
}

export function summaryCardText(card: SummaryCard, pageUrl: string, t: T) {
  return [card.title, ...card.metrics.map(({ label, value, source, date }) => `${label}: ${value} · ${source} · ${date}`), ...card.notes, pageUrl, t("ฟ้าวันนี้")].join("\n");
}

export const lineShareUrl = (pageUrl: string) => `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(pageUrl)}`;

export function embedCode(pageUrl: string, title: string) {
  const url = new URL(pageUrl);
  url.pathname = `/embed${url.pathname}`;
  url.search = "";
  url.hash = "";
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<iframe src="${escape(url.href)}" title="${escape(title)}" width="100%" height="420" loading="lazy" style="border:0"></iframe>`;
}
