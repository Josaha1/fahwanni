/** Airport observations (METAR) from aviationweather.gov (NOAA/NWS, public domain). */
export interface Airport { icao: string; name: string; nameTh: string; lat: number; lon: number }

export interface AirportObservation {
  icao: string;
  observedAt: string;
  tempC: number | null;
  dewpointC: number | null;
  humidity: number | null;
  windKmh: number | null;
  gustKmh: number | null;
  /** Degrees the wind blows from; null when calm or variable. */
  windFrom: number | null;
  /** Kilometres; 10 = "10 km or more" (9999 / CAVOK). */
  visibilityKm: number | null;
  /** Thunderstorm (TS) reported or CB/TCU clouds in the report. */
  storm: boolean;
  /** Present weather in Thai-ready codes: rain, showers, drizzle, haze, mist, fog, smoke. */
  weather: ("rain" | "showers" | "drizzle" | "haze" | "mist" | "fog" | "smoke" | "thunder")[];
  raw: string;
}

const KT_TO_KMH = 1.852;
const round = (value: number) => Math.round(value);

/** Relative humidity from temperature and dewpoint (Magnus formula). */
export function humidityFrom(tempC: number, dewC: number): number {
  const a = 17.625, b = 243.04;
  return round(100 * Math.exp(a * dewC / (b + dewC)) / Math.exp(a * tempC / (b + tempC)));
}

export function visibilityKm(raw: string): number | null {
  if (/\bCAVOK\b/.test(raw)) return 10;
  const match = /\s(\d{4})(?:NDV)?\s/.exec(` ${raw} `.replace(/\s\d{5}(G\d{2})?KT\s/, " "));
  if (!match) return null;
  const metres = Number(match[1]);
  return metres >= 9999 ? 10 : Math.round(metres / 100) / 10;
}

export function weatherCodes(raw: string): AirportObservation["weather"] {
  const body = raw.split(/\s(?:NOSIG|BECMG|TEMPO|RMK)\b/)[0];
  const tokens = body.split(/\s+/).filter((token) => /^[+-]?(VC)?(TS|SH|DZ|RA|HZ|BR|FG|FU)+[A-Z]*$/.test(token));
  const out = new Set<AirportObservation["weather"][number]>();
  for (const token of tokens) {
    if (/TS/.test(token)) out.add("thunder");
    if (/SH/.test(token)) out.add("showers"); else if (/RA/.test(token)) out.add("rain");
    if (/DZ/.test(token)) out.add("drizzle");
    if (/HZ/.test(token)) out.add("haze");
    if (/BR/.test(token)) out.add("mist");
    if (/FG/.test(token)) out.add("fog");
    if (/FU/.test(token)) out.add("smoke");
  }
  return [...out];
}

type Raw = { icaoId?: string; obsTime?: number; reportTime?: string; temp?: number | null; dewp?: number | null; wdir?: number | string | null;
  wspd?: number | null; wgst?: number | null; rawOb?: string };

export function parseMetar(item: Raw): AirportObservation | null {
  if (!item.icaoId || !item.rawOb) return null;
  const at = typeof item.obsTime === "number" ? new Date(item.obsTime * 1000).toISOString() : item.reportTime ?? null;
  if (!at) return null;
  const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  const temp = num(item.temp), dew = num(item.dewp), speed = num(item.wspd), gust = num(item.wgst);
  const weather = weatherCodes(item.rawOb);
  return {
    icao: item.icaoId, observedAt: at, tempC: temp, dewpointC: dew,
    humidity: temp !== null && dew !== null ? humidityFrom(temp, dew) : null,
    windKmh: speed === null ? null : round(speed * KT_TO_KMH), gustKmh: gust === null ? null : round(gust * KT_TO_KMH),
    windFrom: typeof item.wdir === "number" && speed ? item.wdir : null,
    visibilityKm: visibilityKm(item.rawOb),
    storm: weather.includes("thunder") || /\b(FEW|SCT|BKN|OVC)\d{3}(CB|TCU)\b/.test(item.rawOb),
    weather, raw: item.rawOb,
  };
}

const R = 6371;
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Airports within `maxKm`, nearest first. */
export function nearestAirports(place: { lat: number; lon: number }, airports: Airport[], maxKm = 80, limit = 2) {
  return airports.map((airport) => ({ airport, km: distanceKm(place, airport) })).filter((item) => item.km <= maxKm)
    .sort((a, b) => a.km - b.km).slice(0, limit);
}
