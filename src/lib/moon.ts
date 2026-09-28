/** Google Weather moonPhase values → everyday Thai/English (ข้างขึ้น = waxing, ข้างแรม = waning). */
const PHASES: Record<string, { th: string; en: string }> = {
  NEW_MOON: { th: "เดือนมืด", en: "New moon" },
  WAXING_CRESCENT: { th: "ข้างขึ้น (เสี้ยว)", en: "Waxing crescent" },
  FIRST_QUARTER: { th: "ข้างขึ้น (ครึ่งดวง)", en: "First quarter" },
  WAXING_GIBBOUS: { th: "ข้างขึ้น (เกือบเต็มดวง)", en: "Waxing gibbous" },
  FULL_MOON: { th: "จันทร์เต็มดวง", en: "Full moon" },
  WANING_GIBBOUS: { th: "ข้างแรม (เกือบเต็มดวง)", en: "Waning gibbous" },
  LAST_QUARTER: { th: "ข้างแรม (ครึ่งดวง)", en: "Last quarter" },
  WANING_CRESCENT: { th: "ข้างแรม (เสี้ยว)", en: "Waning crescent" },
};

export function moonPhaseLabel(phase: string | undefined, locale: "th" | "en"): string | undefined {
  return phase && phase in PHASES ? PHASES[phase][locale] : undefined;
}

/** Next full moon date among the forecast days, handy for festivals like Loy Krathong. */
export function nextFullMoon(days: { date?: string; moonPhase?: string }[]): string | undefined {
  return days.find((day) => day.moonPhase === "FULL_MOON")?.date;
}
