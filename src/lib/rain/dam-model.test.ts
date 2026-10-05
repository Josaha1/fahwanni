import { expect, it } from "vitest";
import { DAM_REGISTRY } from "@/lib/dams/registry";
import { distanceKm } from "@/lib/storms/normalize";
import { damGrid, parseDamRain } from "./dam-model";

const dams = [...DAM_REGISTRY.slice(0, 3)];
const fixture = () => dams.flatMap((dam) => damGrid(dam).map((point, index) => ({ latitude: point.lat, longitude: point.lon, daily: { time: Array.from({ length: 7 }, (_, day) => `2026-10-${String(day + 5).padStart(2, "0")}`), precipitation_sum: Array(7).fill(index + 1) } })));

it("samples nine points within 30 km and averages cells rather than summing their areas", () => {
  for (const dam of dams) expect(damGrid(dam).every((point) => distanceKm(dam, point) <= 30)).toBe(true);
  expect(parseDamRain(fixture(), dams)?.[0]).toEqual({ id: dams[0].id, date: "2026-10-05", samples: 9, totals: [5, 15, 35] });
});
it("excludes out-of-radius snapped cells and deduplicates model grid cells", () => {
  const data = fixture();
  data[0].latitude = 50;
  data[1] = structuredClone(data[2]);
  expect(parseDamRain(data, dams)?.[0].samples).toBe(7);
});
it("keeps missing, misdated, or truncated periods unavailable", () => {
  const data = fixture();
  data[0].daily.precipitation_sum = [1];
  expect(parseDamRain(data, dams)?.[0].totals).toEqual([5, null, null]);
  data[1].daily.time[0] = "2026-10-06";
  expect(parseDamRain(data, dams)?.[0].totals).toEqual([null, null, null]);
  expect(parseDamRain([], dams)).toBeNull();
});
