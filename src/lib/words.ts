import type { T } from "../i18n/core";
import type { HeatBand } from "./advise";
import type { Pm25Level } from "./air";

export function heatBandWord(band: HeatBand, t: T): string {
  switch (band) {
    case "none": return t("ปกติ");
    case "caution": return t("เฝ้าระวัง");
    case "warning": return t("เตือนภัย");
    case "danger": return t("อันตราย");
    case "extreme": return t("อันตรายมาก");
  }
}

export function pm25LevelWord(level: Pm25Level, t: T): string {
  switch (level) {
    case "good": return t("ดี");
    case "moderate": return t("ปานกลาง");
    case "sensitive": return t("เริ่มมีผลต่อสุขภาพ");
    case "unhealthy": return t("มีผลต่อสุขภาพ");
    case "very-unhealthy": return t("มีผลต่อสุขภาพมาก");
  }
}

export function uvWord(index: number, t: T): string {
  if (index < 3) return t("ต่ำ");
  if (index < 6) return t("ปานกลาง");
  if (index < 8) return t("สูง");
  if (index < 11) return t("สูงมาก");
  return t("อันตราย");
}

export function windWord(kmh: number, t: T): string {
  if (kmh < 6) return t("ลมสงบ");
  if (kmh < 20) return t("ลมอ่อน");
  if (kmh < 39) return t("ลมปานกลาง");
  if (kmh < 62) return t("ลมแรง");
  return t("ลมแรงมาก");
}

export function humidityWord(percent: number, t: T): string {
  if (percent < 40) return t("แห้ง");
  if (percent < 70) return t("สบาย");
  if (percent < 85) return t("ชื้น");
  return t("ชื้นมาก");
}
