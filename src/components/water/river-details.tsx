"use client";

import { useT } from "@/i18n/client";
import type { Dam } from "@/lib/dams/types";
import { formatFullDate } from "@/lib/format";
import { riverColors } from "@/lib/rivers/colors";
import { rareLevelWord, statusWord } from "@/lib/rivers/status";
import type { RareLevel, RiverStatus, RiverTrend } from "@/lib/rivers/types";
import { RiverChart, type RiverChartDay } from "./river-chart";

export type RiverRow = {
  id: string; nameTh: string; nameEn: string; lat: number; lon: number; downstreamOfDam: string | null;
  summary: null | { today: { date: string; value: number; status: RiverStatus }; trend: RiverTrend | null;
    peak: { date: string; value: number } | null; rare: RareLevel | null;
    value2554Today: number | null; days: RiverChartDay[] };
};
export type RiversPayload = { today: string; points: RiverRow[] };

export function riverDateLabel(date: string, locale: "th" | "en") {
  return formatFullDate(`${date}T12:00:00+07:00`, "Asia/Bangkok", locale);
}

export function RiverDetails({ point, upstream, mapCard = false }: { point: RiverRow; upstream?: Dam; mapCard?: boolean }) {
  const t = useT();
  const detail = point.summary;
  const number = new Intl.NumberFormat(t.intl, { maximumFractionDigits: 0 });
  if (!detail) return <p className={mapCard ? "map-muted text-sm" : "text-muted text-sm"}>{t("ข้อมูลจุดนี้ไม่พร้อมใช้งาน")}</p>;
  const muted = mapCard ? "map-muted" : "text-muted";
  return <div className="mt-1 space-y-1 text-sm">
    <p><span className="font-semibold" style={{ color: riverColors[detail.today.status] }}>{t(statusWord(detail.today.status))}</span> · {t("{value} ลบ.ม./วินาที (แบบจำลอง)", { value: number.format(detail.today.value) })} <span aria-label={t(detail.trend === "rising" ? "กำลังเพิ่ม" : detail.trend === "falling" ? "กำลังลด" : "คงที่")}>{detail.trend === "rising" ? "↗" : detail.trend === "falling" ? "↘" : "→"}</span></p>
    <p className={`${muted} text-xs`}>{t("ข้อมูลวันที่ {date}", { date: riverDateLabel(detail.today.date, t.locale) })}</p>
    <RiverChart days={detail.days} color={riverColors[detail.today.status]} />
    <p className={`${muted} text-xs`}>{t("เส้น: ปริมาณน้ำไหลผ่านแบบจำลอง · แถบ: ช่วงปกติ p25–p75")}</p>
    {detail.peak && <p>{t("สูงสุดใน 7 วัน {value} วันที่ {date}", { value: number.format(detail.peak.value), date: riverDateLabel(detail.peak.date, t.locale) })}</p>}
    {detail.rare && <p>{t(rareLevelWord(detail.rare))}</p>}
    {upstream && <p>{t("ปริมาณจริงขึ้นกับการระบายของเขื่อน{name} (ระบาย {release} ลบ.ม./วินาที)", { name: t.locale === "en" ? upstream.nameEn || upstream.nameTh : upstream.nameTh, release: upstream.releaseCms === null ? "—" : number.format(upstream.releaseCms) })}</p>}
    {detail.value2554Today !== null && <p>{t("วันนี้ปี 2554: {value} ลบ.ม./วินาที", { value: number.format(detail.value2554Today) })}</p>}
    {detail.value2554Today !== null && <p className={`${muted} text-xs`}>{t("ตัวเลขนี้อย่างเดียวไม่ได้บอกว่าจะท่วม ปี 2554 ท่วมเพราะฝน เขื่อนเต็ม และจังหวะเวลาประกอบกัน")}</p>}
    {mapCard && <p className={`${muted} pt-2 text-xs`}>{t("ประมาณการจากแบบจำลอง GloFAS ความละเอียด 5 กม. · ไม่ใช่ค่าที่วัดจริงจากสถานี · ไม่ใช่แผนที่น้ำท่วม")}</p>}
  </div>;
}
