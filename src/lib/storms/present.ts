import type { T } from "@/i18n/core";
import { bearingDeg, distanceKm, type Position, type Storm } from "./normalize";

const directions = ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"];

export function bearingWord(degrees: number, t: T): string {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return t(directions[index]);
}

export function stormCategoryLabel(storm: Storm, t: T): string {
  switch (storm.category?.toUpperCase()) {
    case "TY": return t("พายุไต้ฝุ่น");
    case "STS": return t("พายุโซนร้อนกำลังแรง");
    case "TS": return t("พายุโซนร้อน");
    case "TD": return t("พายุดีเปรสชัน");
    default: return t("พายุหมุนเขตร้อน");
  }
}

export function gdacsLevelLabel(level: Storm["alertLevel"], t: T): string | undefined {
  switch (level) {
    case "Red": return t("ระดับเตือน สูง");
    case "Orange": return t("ระดับเตือน กลาง");
    case "Green": return t("ระดับเตือน ต่ำ");
  }
}

export function stormMessage(storm: Storm, place: Position & { name: string }, t: T): string {
  const km = Math.round(distanceKm(place, storm.position));
  const direction = bearingWord(bearingDeg(place, storm.position), t);
  const category = stormCategoryLabel(storm, t);
  return t("{category} {name} อยู่ห่าง ~{km} กม. ทางทิศ{direction} ของ{place}", {
    category, name: storm.name, km, direction, place: place.name,
  });
}
