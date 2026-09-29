import { z } from "zod";
import type { Barrage, Dam, DamBand, RiverStation, StationSituation } from "./types";

const number = z.union([z.number(), z.string()]).transform((value, context) => {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if ((typeof value === "string" && !value.trim()) || !Number.isFinite(parsed)) {
    context.addIssue({ code: "custom", message: "Invalid number" });
    return z.NEVER;
  }
  return parsed;
});
const optionalNumber = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? null : value,
  number.nullable().catch(null),
);

const names = z.object({ th: z.string(), en: z.string().optional().default("") });
const damItem = z.object({
  dam_date: z.iso.date(),
  dam_storage: number,
  dam_storage_percent: number,
  dam_uses_water_percent: optionalNumber,
  dam_inflow: optionalNumber,
  dam_released: optionalNumber,
  dam_spilled: optionalNumber,
  dam: z.object({
    id: z.union([z.number(), z.string()]),
    dam_name: names,
    dam_lat: number,
    dam_long: number,
    max_storage: number,
  }),
  agency: z.object({ agency_shortname: z.object({ en: z.string().optional().default("") }) }).optional(),
  basin: z.object({ basin_name: names }).optional(),
  geocode: z.object({ province_name: names }).optional(),
});

const stationItem = z.object({
  waterlevel_datetime: z.string().regex(/^\d{4}-\d\d-\d\d \d\d:\d\d$/),
  storage_percent: optionalNumber,
  situation_level: optionalNumber,
  discharge: optionalNumber,
  station: z.object({
    tele_station_oldcode: z.string(),
    tele_station_name: z.object({ th: z.string() }),
    tele_station_lat: number,
    tele_station_long: number,
    qmax: optionalNumber,
  }),
  basin: z.object({ basin_name: z.object({ th: z.string() }) }).optional(),
});
const section = z.object({ data: z.object({ data: z.array(z.unknown()) }) });
const payload = z.object({ dam: z.unknown().optional(), waterlevel: z.unknown().optional() });

// Thresholds and colors follow ThaiWater dam.setting.scale and waterlevel.setting.rule_web/scale.
export function damBand(storagePct: number): DamBand {
  if (storagePct > 100) return 5;
  if (storagePct > 80) return 4;
  if (storagePct > 50) return 3;
  if (storagePct > 30) return 2;
  return 1;
}

export function stationSituation(pctBank: number | null): StationSituation | null {
  if (pctBank === null) return null;
  if (pctBank > 100) return 5;
  if (pctBank > 70) return 4;
  if (pctBank > 30) return 3;
  if (pctBank > 10) return 2;
  return 1;
}

const damColors = ["", "#FFC000", "#00B050", "#003CFA", "#FF0000", "#C70000"] as const;
const damWords = ["", "น้ำน้อยวิกฤต", "น้ำน้อย", "ปานกลาง", "น้ำมาก", "เกินความจุ"] as const;
const situationColors = ["", "#990000", "#FFC000", "#00B050", "#003CFA", "#FF0000"] as const;
const situationWords = ["", "น้ำน้อยวิกฤติ", "น้ำน้อย", "น้ำปกติ", "น้ำมาก", "น้ำล้นตลิ่ง"] as const;

export const damBandColor = (band: DamBand): string => damColors[band];
export const damBandWord = (band: DamBand): string => damWords[band];
export const stationSituationColor = (situation: StationSituation | null): string | null =>
  situation === null ? null : situationColors[situation];
export const situationWord = (situation: StationSituation | null): string | null =>
  situation === null ? null : situationWords[situation];

const toCms = (mcmDay: number | null): number | null =>
  mcmDay === null ? null : Math.round(mcmDay * 11.574 * 10) / 10;

export function parseThaiWater(raw: unknown): {
  dams: Dam[]; stations: RiverStation[]; barrage: Barrage; dataDate: string | null;
} {
  const source = payload.safeParse(raw);
  const empty = { dams: [], stations: [], barrage: null, dataDate: null };
  if (!source.success) return empty;

  const damData = section.safeParse(source.data.dam);
  const stationData = section.safeParse(source.data.waterlevel);
  const dams: Dam[] = damData.success ? damData.data.data.data.flatMap((item) => {
    const parsed = damItem.safeParse(item);
    if (!parsed.success) return [];
    const value = parsed.data;
    const storagePct = value.dam_storage_percent;
    const inflow = value.dam_inflow;
    const release = value.dam_released;
    const spilled = value.dam_spilled;
    return [{
      id: String(value.dam.id), nameTh: value.dam.dam_name.th, nameEn: value.dam.dam_name.en,
      lat: value.dam.dam_lat, lon: value.dam.dam_long,
      province: value.geocode?.province_name ?? { th: "", en: "" },
      basin: value.basin?.basin_name ?? { th: "", en: "" },
      agency: value.agency?.agency_shortname.en ?? "", date: value.dam_date,
      storageMcm: value.dam_storage, storagePct, usablePct: value.dam_uses_water_percent,
      capacityMcm: value.dam.max_storage,
      inflowMcmDay: inflow, releaseMcmDay: release, spilledMcmDay: spilled,
      inflowCms: toCms(inflow), releaseCms: toCms(release), band: damBand(storagePct),
      highRelease: (spilled !== null && spilled > 0) || storagePct > 100 ||
        (storagePct > 80 && release !== null && inflow !== null && release >= inflow),
    }];
  }) : [];

  const stations: RiverStation[] = stationData.success ? stationData.data.data.data.flatMap((item) => {
    const parsed = stationItem.safeParse(item);
    if (!parsed.success) return [];
    const value = parsed.data;
    const situation = value.situation_level;
    const time = value.waterlevel_datetime.replace(" ", "T") + ":00+07:00";
    return [{
      code: value.station.tele_station_oldcode, nameTh: value.station.tele_station_name.th,
      lat: value.station.tele_station_lat, lon: value.station.tele_station_long, time,
      pctBank: value.storage_percent,
      situation: situation !== null && Number.isInteger(situation) && situation >= 1 && situation <= 5
        ? situation as StationSituation : stationSituation(value.storage_percent),
      dischargeCms: value.discharge, qmaxCms: value.station.qmax,
      basinTh: value.basin?.basin_name.th ?? "",
    }];
  }) : [];

  const chaoPhraya = stations.find((station) => station.code === "C.13");
  const barrage: Barrage = chaoPhraya ? {
    id: "chao-phraya", nameTh: "เขื่อนเจ้าพระยา", nameEn: "Chao Phraya Dam",
    lat: chaoPhraya.lat, lon: chaoPhraya.lon, dischargeCms: chaoPhraya.dischargeCms,
    qmaxCms: chaoPhraya.qmaxCms, situation: chaoPhraya.situation, time: chaoPhraya.time,
  } : null;
  const dataDate = dams.reduce<string | null>((latest, dam) =>
    latest === null || dam.date > latest ? dam.date : latest, null);
  return { dams, stations, barrage, dataDate };
}
