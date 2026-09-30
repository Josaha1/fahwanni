export type Pm25Level = "very-good" | "good" | "moderate" | "starting-to-affect" | "affects-health";

export function pm25Level(value: number): Pm25Level {
  if (value <= 15) return "very-good";
  if (value <= 25) return "good";
  if (value <= 37.5) return "moderate";
  if (value <= 75) return "starting-to-affect";
  return "affects-health";
}
