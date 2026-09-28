import { pm25Level, type Pm25Level } from "../air";

/** RainViewer scheme 2 "Universal Blue": 15/25/35/45 dBZ ≈ 0.3/1/4/10 mm/h. Index is level 0–4. */
export const RAIN_RAMP = ["rgba(0, 0, 0, 0)", "#88ddee", "#0077aa", "#ffee00", "#ff4400"] as const;

export const TEMP_STOPS = [
  [15, "#4a7bd0"],
  [20, "#4fb3c9"],
  [25, "#7cc86f"],
  [30, "#f2d24b"],
  [35, "#f0913a"],
  [40, "#d6453d"],
] as const;

export function tempColor(c: number): string {
  if (c <= TEMP_STOPS[0][0]) return TEMP_STOPS[0][1];
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [upperTemp, upperColor] = TEMP_STOPS[i];
    if (c > upperTemp) continue;
    const [lowerTemp, lowerColor] = TEMP_STOPS[i - 1];
    const fraction = (c - lowerTemp) / (upperTemp - lowerTemp);
    return `#${[1, 3, 5].map((offset) => {
      const lower = Number.parseInt(lowerColor.slice(offset, offset + 2), 16);
      const upper = Number.parseInt(upperColor.slice(offset, offset + 2), 16);
      return Math.round(lower + (upper - lower) * fraction).toString(16).padStart(2, "0");
    }).join("")}`;
  }
  return TEMP_STOPS.at(-1)![1];
}

export const PM25_COLORS: Record<Pm25Level, string> = {
  "very-good": "#3bccff",
  good: "#92d050",
  moderate: "#ffff00",
  "starting-to-affect": "#ffa200",
  "affects-health": "#f04646",
};

export function pm25Color(value: number): string {
  return PM25_COLORS[pm25Level(value)];
}

export const DATA = {
  storm: "#e5484d",
  stormHalo: "#ffffff",
  quake: "#f59e0b",
  quakeHalo: "#ffffff",
  pin: "#2563eb",
} as const;

/** Wind speed in m/s; opacity keeps the weaker particles behind map labels. */
export function windColor(speedMs: number): string {
  if (speedMs < 3) return "rgba(90, 110, 140, 0.55)";
  if (speedMs < 8) return "rgba(60, 90, 130, 0.8)";
  if (speedMs < 14) return "rgba(217, 119, 6, 0.9)";
  return "rgba(220, 38, 38, 0.95)";
}

/** WCAG contrast ratio for opaque six-digit hex colours. */
export function contrastRatio(hexA: string, hexB: string): number {
  function luminance(hex: string): number {
    if (!/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Invalid hex colour: ${hex}`);
    const channels = [1, 3, 5].map((start) => {
      const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }

  const a = luminance(hexA);
  const b = luminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
