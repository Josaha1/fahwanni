import { intlOf, type T } from "@/i18n/core";
import { damBandWord } from "@/lib/dams/bands";
import type { provinceBins, rainGauge, satelliteRing, streamRate, tankFill } from "./index";

const number = (value: number, t: T) => new Intl.NumberFormat(intlOf(t), { maximumFractionDigits: 1 }).format(value);

export function visualSummaryRain(gauge: ReturnType<typeof rainGauge>, t: T): string {
  if (gauge.state === "no-data") return t("ไม่มีข้อมูลฝน");
  const parts = [t("ฝน {mm} มม.", { mm: number(gauge.value, t) })];
  if (gauge.category === "heavy") parts.push(t("ฝนหนัก"));
  if (gauge.category === "veryHeavy") parts.push(t("ฝนหนักมาก"));
  return parts.join(" · ");
}

export function visualSummaryTank(fill: ReturnType<typeof tankFill>, t: T): string {
  if (fill.state === "no-data") return t("ไม่มีข้อมูลปริมาณน้ำในเขื่อน");
  return t("กักเก็บ {pct}% ความจุ · {band} · เส้น 100% เต็มความจุ", {
    pct: number(fill.value, t), band: t(damBandWord(fill.band)),
  });
}

export function visualSummarySatellite(ring: ReturnType<typeof satelliteRing>, t: T): string {
  if (ring.state === "no-data") return t("ดาวเทียม: ไม่มีข้อมูลที่ใช้ได้ · จุดตรวจ ไม่ใช่พื้นที่");
  return t("ดาวเทียม: น้ำท่วม {n} จุดตรวจในรัศมี {km} กม. · เมฆบัง/ข้อมูลไม่พอ {missing} จุดตรวจ · จุดตรวจ ไม่ใช่พื้นที่", {
    n: number(ring.flood, t), km: number(ring.radiusKm, t), missing: number(ring.insufficient, t),
  });
}

export function visualSummaryProvince(province: ReturnType<typeof provinceBins>, t: T): string {
  if (province.state === "no-data") return t("จังหวัด: ไม่มีข้อมูลที่ใช้ได้ · จุดตรวจ ไม่ใช่พื้นที่");
  return t("จังหวัด: น้ำท่วม {n} จุดตรวจ · จุดตรวจ ไม่ใช่พื้นที่", { n: number(province.count, t) });
}

export function visualSummaryStream(rate: ReturnType<typeof streamRate>, t: T): string {
  if (rate.state === "no-data") return t("ไม่มีข้อมูลอัตรา");
  return rate.unit === "cms"
    ? t("น้ำไหลผ่าน {cms} ลบ.ม./วินาที", { cms: number(rate.value, t) })
    : t("ฝน {mm} มม.", { mm: number(rate.value, t) });
}
