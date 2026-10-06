import { expect, it } from "vitest";
import { damClipboard, cloudPercent, waterPoints } from "./home-data";
import type { Dam } from "@/lib/dams/types";

it("copies each dam's own report date and source without turning missing release into zero", () => {
  const text = damClipboard([{ nameTh: "ภูมิพล", storagePct: 84, storageMcm: 1000, inflowCms: 0, releaseCms: null, date: "2026-10-06" },
    { nameTh: "สิริกิติ์", storagePct: 91, storageMcm: 2000, inflowCms: null, releaseCms: 100, date: "2026-10-05" }] as Dam[]);
  expect(text).toContain("ภูมิพล\t84\t1,000\t0\t—\tกรมชลประทาน\t2026-10-06");
  expect(text).toContain("สิริกิติ์\t91\t2,000\t—\t100\tกรมชลประทาน\t2026-10-05");
  expect(text).toContain("https://app.rid.go.th/reservoir/");
});
it("keeps no observations distinct from zero cloud, and counts recurring water", () => {
  const counts = { flood: 2, recurringFlood: 3, water: 1, dry: 2, insufficientData: 2, noData: 0, sampled: 10 };
  expect(waterPoints(counts)).toBe(5);
  expect(cloudPercent(counts)).toBe(20);
  expect(cloudPercent({ ...counts, noData: 3 })).toBe(50);
  expect(cloudPercent({ ...counts, sampled: 0 })).toBeNull();
  expect(cloudPercent(null)).toBeNull();
});
