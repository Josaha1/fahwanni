/** El Niño / La Niña from NOAA CPC's Oceanic Niño Index (public domain): cpc.ncep.noaa.gov/data/indices/oni.ascii.txt */
export type EnsoPhase = "el-nino" | "la-nina" | "neutral";
export type EnsoStrength = "weak" | "moderate" | "strong" | "very-strong" | null;

export interface OniSeason { season: string; year: number; anomaly: number }
export interface EnsoStatus {
  phase: EnsoPhase;
  strength: EnsoStrength;
  latest: OniSeason;
  /** CPC's official episode needs 5 consecutive overlapping seasons past ±0.5 °C. */
  officialEpisode: boolean;
  /** Consecutive latest seasons past the threshold (in the current phase). */
  run: number;
  recent: OniSeason[];
}

export function parseOni(text: string): OniSeason[] {
  return text.split("\n").flatMap((line) => {
    const match = /^\s*([A-Z]{3})\s+(\d{4})\s+(-?[\d.]+)\s+(-?[\d.]+)\s*$/.exec(line);
    return match ? [{ season: match[1], year: Number(match[2]), anomaly: Number(match[4]) }] : [];
  });
}

export function ensoStatus(seasons: OniSeason[]): EnsoStatus | null {
  const latest = seasons.at(-1);
  if (!latest || !Number.isFinite(latest.anomaly)) return null;
  const phase: EnsoPhase = latest.anomaly >= 0.5 ? "el-nino" : latest.anomaly <= -0.5 ? "la-nina" : "neutral";
  const past = (value: number) => phase === "el-nino" ? value >= 0.5 : phase === "la-nina" ? value <= -0.5 : false;
  let run = 0;
  for (let i = seasons.length - 1; i >= 0 && past(seasons[i].anomaly); i--) run++;
  const size = Math.abs(latest.anomaly);
  const strength: EnsoStrength = phase === "neutral" ? null : size >= 2 ? "very-strong" : size >= 1.5 ? "strong" : size >= 1 ? "moderate" : "weak";
  return { phase, strength, latest, officialEpisode: run >= 5, run, recent: seasons.slice(-6) };
}
