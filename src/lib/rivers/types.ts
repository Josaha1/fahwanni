export interface RiverBand {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface RiverPoint {
  id: string;
  nameTh: string;
  nameEn: string;
  river: string;
  provinceId: string;
  lat: number;
  lon: number;
  snappedLat: number;
  snappedLon: number;
  meanDischarge: number;
  downstreamOfDam: string | null;
  /** Dams whose downstream route passes this point, nearest (by river km from the dam) first. */
  upstreamDams: { damId: string; km: number }[];
  doy: Record<number, RiverBand>;
  annualMax: { p50: number; p80: number };
  value2554: Record<number, number | null>;
}

export interface RiverForecastDay {
  date: string;
  value: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
}

export interface RiverForecast {
  id: string;
  days: RiverForecastDay[];
}

export type RiverStatus = "low" | "normal" | "high" | "veryHigh";
export type RiverTrend = "rising" | "falling" | "steady";
export type RareLevel = "about5y" | "yearly";
