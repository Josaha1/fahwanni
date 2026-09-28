import type { Locale } from "@/i18n/core";

const WORDS = {
  th: { degrees: "องศา", percent: "เปอร์เซ็นต์", to: "ถึง", pm25: "ฝุ่นพีเอ็มสองจุดห้า" },
  en: { degrees: "degrees", percent: "percent", to: "to", pm25: "P M 2.5" },
} as const;

/**
 * Turns the share summary into text a speech voice reads naturally: symbols become words
 * ("29°" → "29 องศา", "25–29°" → "25 ถึง 29 องศา", "75%" → "75 เปอร์เซ็นต์"), bullets and the
 * app/place title line go, and each line becomes its own sentence.
 */
export function toSpeech(shareText: string, locale: Locale): string {
  const w = WORDS[locale];
  return shareText
    .split("\n")
    .slice(1) // "ฟ้าวันนี้ · <place>" is visual branding, not worth hearing
    .map((line) => line
      .replace(/^•\s*/, "")
      .replace(/(\d+)\s*[–-]\s*(\d+)°/g, `$1 ${w.to} $2 ${w.degrees}`)
      .replace(/(\d+)°/g, `$1 ${w.degrees}`)
      .replace(/(\d+)%/g, `$1 ${w.percent}`)
      .replace(/PM2\.5/g, w.pm25)
      .replace(/[()]/g, " ")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean)
    .join(locale === "th" ? "  " : ". ");
}
