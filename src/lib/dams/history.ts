import type { Dam } from "./types";

type HistoryReport = { date: string; dams: Dam[] };
type HistoryEntry = { date: string; pct: Record<string, number> };

export interface DamHistory {
  dataDate: string;
  lastYear: HistoryEntry | null;
  year2554: HistoryEntry | null;
}

export function historyDates(dataDate: string): { lastYear: string; year2554: string } {
  const [year, month, day] = dataDate.split("-").map(Number);
  const sameDay = (targetYear: number) => {
    const targetDay = month === 2 && day === 29 && new Date(Date.UTC(targetYear, 1, 29)).getUTCDate() !== 29 ? 28 : day;
    return `${targetYear}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
  };
  return { lastYear: sameDay(year - 1), year2554: sameDay(2011) };
}

export function buildHistory(reports: HistoryReport[]): DamHistory {
  const dataDate = reports[0].date;
  const dates = historyDates(dataDate);
  const entry = (date: string): HistoryEntry | null => {
    const report = reports.find((item) => item.date === date && item.dams.length > 0);
    return report ? { date, pct: Object.fromEntries(report.dams.map((dam) => [dam.id, dam.storagePct])) } : null;
  };
  return { dataDate, lastYear: entry(dates.lastYear), year2554: entry(dates.year2554) };
}
