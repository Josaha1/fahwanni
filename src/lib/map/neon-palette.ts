export const NEON = {
  bg: "#070b1a",
  water: "#0a1030",
  land: "#0d1330",
  landAlt: "#111a3d",
  roadDim: "#1c2452",
  road: "#2a3470",
  border: "#38e8ff",
  borderGlow: "rgba(56, 232, 255, 0.22)",
  coast: "#38e8ff",
  river: "#1fb6ff",
  label: "#dfe8ff",
  labelMuted: "#8fa2d6",
  halo: "#05070f",
  accent: "#ff3df2",
  quake: "#ffb020",
  pin: "#38e8ff",
  sky: { sky: "#2a0a4a", horizon: "#05060f", fog: "#0a0f2a" },
} as const;

/** Level 0 is dry; levels 1–4 progress from light cyan to intense magenta-red. */
export const RAIN_RAMP = [
  "rgba(0, 0, 0, 0)",
  "#38e8ff",
  "#3478ff",
  "#ffc928",
  "#ff3d83",
] as const;

export function rainLegendGradient(): string {
  return `linear-gradient(to right, ${RAIN_RAMP.slice(1).join(", ")})`;
}

/** Wind speed in m/s; opacity keeps the weaker particles behind map labels. */
export function windColor(speedMs: number): string {
  if (speedMs < 3) return "rgba(56, 232, 255, 0.45)";
  if (speedMs < 8) return "rgba(56, 232, 255, 0.8)";
  if (speedMs < 14) return "rgba(255, 201, 40, 0.9)";
  return "rgba(255, 61, 242, 0.95)";
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
