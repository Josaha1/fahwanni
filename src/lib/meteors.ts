/** Major annual meteor showers (IMO calendar; peak dates shift by about a day between years). ZHR = ideal hourly rate. */
export interface MeteorShower { id: string; nameTh: string; nameEn: string; month: number; day: number; zhr: number }

export const METEOR_SHOWERS: readonly MeteorShower[] = [
  { id: "quadrantids", nameTh: "ฝนดาวตกควอดรานติดส์", nameEn: "Quadrantids", month: 1, day: 3, zhr: 110 },
  { id: "lyrids", nameTh: "ฝนดาวตกไลริดส์", nameEn: "Lyrids", month: 4, day: 22, zhr: 18 },
  { id: "eta-aquariids", nameTh: "ฝนดาวตกอีตาอควอริดส์", nameEn: "Eta Aquariids", month: 5, day: 6, zhr: 50 },
  { id: "perseids", nameTh: "ฝนดาวตกเพอร์เซอิดส์", nameEn: "Perseids", month: 8, day: 12, zhr: 100 },
  { id: "orionids", nameTh: "ฝนดาวตกโอไรออนิดส์", nameEn: "Orionids", month: 10, day: 21, zhr: 20 },
  { id: "leonids", nameTh: "ฝนดาวตกลีโอนิดส์", nameEn: "Leonids", month: 11, day: 17, zhr: 15 },
  { id: "geminids", nameTh: "ฝนดาวตกเจมินิดส์", nameEn: "Geminids", month: 12, day: 14, zhr: 150 },
  { id: "ursids", nameTh: "ฝนดาวตกเออร์ซิดส์", nameEn: "Ursids", month: 12, day: 22, zhr: 10 },
];

/** The next shower peak within `days` of `date` (a Bangkok calendar day "YYYY-MM-DD"), with days until the peak. */
export function nextMeteorShower(date: string, days = 30): { shower: MeteorShower; peak: string; daysAway: number } | null {
  const today = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(today)) return null;
  const year = Number(date.slice(0, 4));
  const candidates = [year, year + 1].flatMap((y) => METEOR_SHOWERS.map((shower) => {
    const peak = `${y}-${String(shower.month).padStart(2, "0")}-${String(shower.day).padStart(2, "0")}`;
    return { shower, peak, daysAway: Math.round((Date.parse(`${peak}T00:00:00Z`) - today) / 86_400_000) };
  })).filter((item) => item.daysAway >= -1 && item.daysAway <= days).sort((a, b) => a.daysAway - b.daysAway);
  return candidates[0] ?? null;
}
