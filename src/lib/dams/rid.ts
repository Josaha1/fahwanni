import { z } from "zod";
import { provinces } from "../provinces";
import { damBand, mcmDayToCms } from "./bands";
import { damRegistryById } from "./registry";
import type { Dam } from "./types";

/** RID large-dam report: https://app.rid.go.th/reservoir/api/dam/public (docs: …/api/document/dam). */
const number = z.number().finite();
const nullableNumber = z.number().finite().nullable().optional().transform((value) => value ?? null);
const ridDam = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string().optional(),
  storage: number,
  dead_storage: number,
  active_storage: number.optional(),
  volume: number,
  percent_storage: number,
  inflow: nullableNumber,
  outflow: nullableNumber,
});
const ridReport = z.object({
  date: z.string(),
  data: z.array(z.object({ region: z.string(), dam: z.array(z.unknown()) })),
});

const REGION_EN: Record<string, string> = {
  "ภาคเหนือ": "North", "ภาคตะวันออกเฉียงเหนือ": "Northeast", "ภาคกลาง": "Central",
  "ภาคตะวันตก": "West", "ภาคตะวันออก": "East", "ภาคใต้": "South",
};

const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Parses the RID report and joins each dam with the static registry (coordinates, English name,
 * province). Unknown ids and malformed rows are skipped; never throws.
 */
export function parseRidDams(raw: unknown): { dams: Dam[]; dataDate: string | null; registeredCount: number } {
  const report = ridReport.safeParse(raw);
  if (!report.success) return { dams: [], dataDate: null, registeredCount: 0 };
  const registeredIds = new Set<string>();
  const dams = report.data.data.flatMap(({ region, dam }) => dam.flatMap((item): Dam[] => {
    if (item !== null && typeof item === "object" && "id" in item &&
      typeof item.id === "string" && damRegistryById.has(item.id)) registeredIds.add(item.id);
    const parsed = ridDam.safeParse(item);
    if (!parsed.success) return [];
    const value = parsed.data;
    const registered = damRegistryById.get(value.id);
    if (!registered) return [];
    const province = provinces.find((p) => p.id === registered.provinceId);
    const usableCapacity = value.active_storage ?? value.storage - value.dead_storage;
    const storagePct = round(value.percent_storage, 2);
    const inflow = value.inflow, release = value.outflow;
    return [{
      id: value.id,
      nameTh: registered.nameTh,
      nameEn: registered.nameEn,
      lat: registered.lat,
      lon: registered.lon,
      province: { th: province?.th ?? "", en: province?.en ?? "" },
      // RID reports the region, not the river basin.
      basin: { th: region, en: REGION_EN[region] ?? region },
      agency: value.owner === "การไฟฟ้า" ? "EGAT" : "RID",
      date: report.data.date,
      storageMcm: round(value.volume, 2),
      storagePct,
      usablePct: usableCapacity > 0 ? round(Math.max(0, value.volume - value.dead_storage) / usableCapacity * 100) : null,
      capacityMcm: value.storage,
      inflowMcmDay: inflow,
      releaseMcmDay: release,
      spilledMcmDay: null,
      inflowCms: mcmDayToCms(inflow),
      releaseCms: mcmDayToCms(release),
      band: damBand(storagePct),
      highRelease: storagePct > 100 || (storagePct > 80 && release !== null && inflow !== null && release >= inflow),
    }];
  }));
  return { dams, dataDate: report.data.date, registeredCount: registeredIds.size };
}
