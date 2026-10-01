import { Body, Equator, Horizon, Illumination, Observer, SearchAltitude, SearchLocalSolarEclipse, SearchLunarEclipse, SearchRiseSet,
  type EclipseKind } from "astronomy-engine";

/** Night-sky facts computed on the device (astronomy-engine, MIT) — no API. Times are ISO strings. */

const DAY = 86_400_000;
const PLANETS = [Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn] as const;
export type Planet = (typeof PLANETS)[number];

export interface GoldenHours {
  morningBlue: [string, string] | null; morningGolden: [string, string] | null;
  eveningGolden: [string, string] | null; eveningBlue: [string, string] | null;
}

const iso = (time: { date: Date } | null) => time ? time.date.toISOString() : null;
const pair = (a: string | null, b: string | null): [string, string] | null => a && b && a < b ? [a, b] : null;

/** Golden hour = sun between −4° and +6°; blue hour = −6° to −4° (common photography definition). `dayStartMs` = local midnight. */
export function goldenHours(lat: number, lon: number, dayStartMs: number): GoldenHours {
  const observer = new Observer(lat, lon, 0);
  const start = new Date(dayStartMs);
  const rising = (altitude: number) => iso(SearchAltitude(Body.Sun, observer, +1, start, 1, altitude));
  const setting = (altitude: number) => iso(SearchAltitude(Body.Sun, observer, -1, start, 1, altitude));
  return {
    morningBlue: pair(rising(-6), rising(-4)), morningGolden: pair(rising(-4), rising(6)),
    eveningGolden: pair(setting(6), setting(-4)), eveningBlue: pair(setting(-4), setting(-6)),
  };
}

export interface VisiblePlanet { body: Planet; altitude: number; magnitude: number }

/** Planets at least 10° up at `atMs` (e.g. an hour after sunset), brightest first. */
export function planetsAt(lat: number, lon: number, atMs: number): VisiblePlanet[] {
  const observer = new Observer(lat, lon, 0);
  const time = new Date(atMs);
  return PLANETS.flatMap((body) => {
    const equator = Equator(body, time, observer, true, true);
    const altitude = Horizon(time, observer, equator.ra, equator.dec, "normal").altitude;
    return altitude >= 10 ? [{ body, altitude: Math.round(altitude), magnitude: Math.round(Illumination(body, time).mag * 10) / 10 }] : [];
  }).sort((a, b) => a.magnitude - b.magnitude);
}

export function sunsetAfter(lat: number, lon: number, fromMs: number): string | null {
  return iso(SearchRiseSet(Body.Sun, new Observer(lat, lon, 0), -1, new Date(fromMs), 1));
}

export function moonLitFraction(atMs: number): number {
  return Math.round(Illumination(Body.Moon, new Date(atMs)).phase_fraction * 100) / 100;
}

export interface VisibleEclipse { type: "solar" | "lunar"; kind: EclipseKind; peak: string }

/** The next solar and lunar eclipse within `years` that can be seen from here (sun/moon above the horizon at peak). */
export function nextEclipses(lat: number, lon: number, fromMs: number, years = 2): VisibleEclipse[] {
  const observer = new Observer(lat, lon, 0);
  const until = fromMs + years * 365.25 * DAY;
  const found: VisibleEclipse[] = [];
  let solar = SearchLocalSolarEclipse(new Date(fromMs), observer);
  while (solar.peak.time.date.getTime() < until) {
    if (solar.peak.altitude > 0) { found.push({ type: "solar", kind: solar.kind, peak: solar.peak.time.date.toISOString() }); break; }
    solar = SearchLocalSolarEclipse(new Date(solar.peak.time.date.getTime() + 10 * DAY), observer);
  }
  let lunar = SearchLunarEclipse(new Date(fromMs));
  while (lunar.peak.date.getTime() < until) {
    const moon = Equator(Body.Moon, lunar.peak, observer, true, true);
    if (lunar.kind !== "penumbral" && Horizon(lunar.peak, observer, moon.ra, moon.dec, "normal").altitude > 0) {
      found.push({ type: "lunar", kind: lunar.kind, peak: lunar.peak.date.toISOString() });
      break;
    }
    lunar = SearchLunarEclipse(new Date(lunar.peak.date.getTime() + 10 * DAY));
  }
  return found.sort((a, b) => a.peak.localeCompare(b.peak));
}

export type StargazingVerdict = "good" | "fair" | "poor";
const CLEARISH = new Set(["CLEAR", "MOSTLY_CLEAR", "PARTLY_CLOUDY"]);

/**
 * "Can I see the stars tonight": share of forecast hours from sunset to 02:00 that are clear-ish with rain chance < 30 %,
 * downgraded by a bright moon. Uses the hourly forecast the home page already has (no extra API).
 */
export function stargazing(hours: { startTime?: string; conditionType?: string; rainChance?: number }[], sunsetIso: string, moonLit: number):
  { verdict: StargazingVerdict; clearShare: number } | null {
  const from = Date.parse(sunsetIso);
  if (!Number.isFinite(from)) return null;
  const local = new Date(from + 7 * 3_600_000);
  const until = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 2) - 7 * 3_600_000;
  const night = hours.filter((hour) => { const at = Date.parse(hour.startTime ?? ""); return at >= from - 3_600_000 && at < until; });
  if (night.length < 3) return null;
  const ok = night.filter((hour) => CLEARISH.has(hour.conditionType ?? "") && (hour.rainChance ?? 0) < 30).length;
  const clearShare = Math.round(ok / night.length * 100) / 100;
  const verdict: StargazingVerdict = clearShare >= 0.7 ? (moonLit < 0.5 ? "good" : "fair") : clearShare >= 0.4 ? "fair" : "poor";
  return { verdict, clearShare };
}
