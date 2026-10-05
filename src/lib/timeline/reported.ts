import { sourceTimeMs } from "@/lib/freshness";

/** Keep gaps in the reports: a scrub index never invents the missing day between two entries. */
export function reportedTimes(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => sourceTimeMs(value) !== null))]
    .sort((a, b) => sourceTimeMs(a)! - sourceTimeMs(b)!);
}

export function reportedIndex(values: readonly string[], selected: string | null): number {
  const found = selected === null ? -1 : values.indexOf(selected);
  return found < 0 ? values.length - 1 : found;
}
