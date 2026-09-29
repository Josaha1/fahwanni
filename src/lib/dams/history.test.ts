import { expect, it } from "vitest";
import fixture from "./fixture-rid.json";
import { buildHistory, historyDates } from "./history";
import { parseRidDams } from "./rid";

it("selects the same day in both years and clamps leap day to February 28", () => {
  expect(historyDates("2026-09-29")).toEqual({ lastYear: "2025-09-29", year2554: "2011-09-29" });
  expect(historyDates("2024-02-29")).toEqual({ lastYear: "2023-02-28", year2554: "2011-02-28" });
  expect(historyDates("2025-02-28").lastYear).toBe("2024-02-28");
});

it("builds per-dam percentages and leaves missing historical reports null", () => {
  const today = parseRidDams(fixture);
  const previous = parseRidDams({ ...fixture, date: "2025-09-29", data: fixture.data.map((group) => ({
    ...group, dam: group.dam.map((dam) => ({ ...dam, percent_storage: dam.percent_storage - 2 })),
  })) });
  const history = buildHistory([
    { date: fixture.date, dams: today.dams },
    { date: "2025-09-29", dams: previous.dams },
  ]);
  expect(history.dataDate).toBe(fixture.date);
  expect(history.lastYear?.date).toBe("2025-09-29");
  expect(history.lastYear?.pct[today.dams[0].id]).toBeCloseTo(today.dams[0].storagePct - 2);
  expect(history.year2554).toBeNull();
});
