import { TZDate } from "@date-fns/tz";

export type Season = "hot" | "rainy" | "cool";
export type SeasonTip = "heatstroke" | "umbrella" | "storms" | "pm25" | "south-monsoon";

export interface SeasonInfo {
  season: Season;
  tip: SeasonTip;
}

/** Day of year for (month, day) in a non-leap calendar, enough for season boundaries. */
const doy = (month: number, day: number) => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][month - 1] + day;

/**
 * Thai Meteorological Department seasons: hot mid-Feb–mid-May, rainy mid-May–mid-Oct,
 * cool mid-Oct–mid-Feb. The south (below ~11°N) has no real cool season: rain continues on
 * the Gulf side until January, then it is hot until the monsoon returns in May.
 */
export function thaiSeason(nowIso: string, lat: number): SeasonInfo {
  const now = new TZDate(nowIso, "Asia/Bangkok");
  const d = doy(now.getMonth() + 1, now.getDate());
  if (lat < 11) {
    if (d >= doy(2, 1) && d < doy(5, 15)) return { season: "hot", tip: "heatstroke" };
    return { season: "rainy", tip: d >= doy(10, 15) || d < doy(2, 1) ? "south-monsoon" : "umbrella" };
  }
  if (d >= doy(2, 15) && d < doy(5, 15)) return { season: "hot", tip: "heatstroke" };
  if (d >= doy(5, 15) && d < doy(10, 15)) {
    // Late rainy season is when tropical storms most often reach Thailand.
    return { season: "rainy", tip: d >= doy(8, 15) ? "storms" : "umbrella" };
  }
  return { season: "cool", tip: "pm25" };
}
