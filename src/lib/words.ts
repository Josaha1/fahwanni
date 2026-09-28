import type { T } from "../i18n/core";
import type { Locale } from "../i18n/core";
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

const windDirections: Record<string, [string, string]> = {
  NORTH: ["เหนือ", "north"],
  NORTH_NORTHEAST: ["ตะวันออกเฉียงเหนือ", "northeast"],
  NORTHEAST: ["ตะวันออกเฉียงเหนือ", "northeast"],
  EAST_NORTHEAST: ["ตะวันออกเฉียงเหนือ", "northeast"],
  EAST: ["ตะวันออก", "east"],
  EAST_SOUTHEAST: ["ตะวันออกเฉียงใต้", "southeast"],
  SOUTHEAST: ["ตะวันออกเฉียงใต้", "southeast"],
  SOUTH_SOUTHEAST: ["ตะวันออกเฉียงใต้", "southeast"],
  SOUTH: ["ใต้", "south"],
  SOUTH_SOUTHWEST: ["ตะวันตกเฉียงใต้", "southwest"],
  SOUTHWEST: ["ตะวันตกเฉียงใต้", "southwest"],
  WEST_SOUTHWEST: ["ตะวันตกเฉียงใต้", "southwest"],
  WEST: ["ตะวันตก", "west"],
  WEST_NORTHWEST: ["ตะวันตกเฉียงเหนือ", "northwest"],
  NORTHWEST: ["ตะวันตกเฉียงเหนือ", "northwest"],
  NORTH_NORTHWEST: ["ตะวันตกเฉียงเหนือ", "northwest"],
};

export function windDirectionLabel(cardinal: string | undefined, locale: Locale): string | undefined {
  const direction = cardinal && windDirections[cardinal];
  if (!direction) return undefined;
  return locale === "th" ? `ลมจากทิศ${direction[0]}` : `from the ${direction[1]}`;
}

export function humidityWord(percent: number, t: T): string {
  if (percent < 40) return t("แห้ง");
  if (percent < 70) return t("สบาย");
  if (percent < 85) return t("ชื้น");
  return t("ชื้นมาก");
}
