/**
 * DWR open data (api.dwr.go.th/twsapi, data.go.th "Creative Commons Attributions"): medium and small reservoirs,
 * some owned by RID. Info = location/capacity; observations = storage time series.
 */
export type DwrSize = "medium" | "small";
export type DwrKind = "reservoir" | "weir" | "pond";

export interface DwrReservoir {
  code: string;
  name: string;
  lat: number;
  lon: number;
  size: DwrSize;
  kind: DwrKind;
  owner: "RID" | "DWR" | "other";
  capacityMcm: number | null;
  storageMcm: number | null;
  /** Only when capacity is known; null when it comes out above 150 % (a data error, not a flood). */
  pct: number | null;
  measuredAt: string | null;
}

type Info = { waterResources?: { waterResourcesMetadata?: Record<string, unknown> }[] };
type Measurement = { measureTime?: string | null; updateTime?: string | null; variable?: string; value?: number | null; uom?: string | null };
type Observations = { timeSeriesObservation?: { waterResources?: { waterResourcesCode?: string }; measurementResults?: Measurement[] | null }[] };

const inThailand = (lat: number, lon: number) => lat > 5.5 && lat < 20.6 && lon > 97.3 && lon < 105.7;
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;

export function dwrKind(name: string): DwrKind {
  if (/^ฝาย/.test(name)) return "weir";
  if (/^(หนอง|บึง|กุด|สระ)/.test(name)) return "pond";
  return "reservoir";
}

function toMcm(value: number, uom: string | null | undefined): number | null {
  if (uom === "MCM") return value;
  if (uom === "CM") return value / 1e6;
  return null;
}

/**
 * Latest storage. RID-owned small reservoirs often carry two "Storage" values for the same day (~13 % apart, no
 * separate ActiveStorage); total storage is the larger one, so the larger value is kept.
 */
export function latestStorage(results: Measurement[] | null | undefined): { mcm: number; at: string } | null {
  const storage = (results ?? []).flatMap((item) => {
    if (item.variable !== "Storage" || !item.measureTime || item.value == null || !Number.isFinite(item.value)) return [];
    const mcm = toMcm(item.value, item.uom);
    return mcm === null || mcm < 0 ? [] : [{ mcm, at: item.measureTime }];
  });
  if (!storage.length) return null;
  const at = storage.reduce((latest, item) => item.at > latest ? item.at : latest, storage[0].at);
  return { mcm: Math.max(...storage.filter((item) => item.at === at).map((item) => item.mcm)), at: at.slice(0, 10) };
}

export function normalizeDwr(info: Info, observations: Observations, size: DwrSize): DwrReservoir[] {
  const byCode = new Map((observations.timeSeriesObservation ?? []).flatMap((entry) =>
    entry.waterResources?.waterResourcesCode ? [[entry.waterResources.waterResourcesCode, entry.measurementResults] as const] : []));
  return (info.waterResources ?? []).flatMap((entry) => {
    const meta = entry.waterResourcesMetadata ?? {};
    const code = typeof meta.waterResourcesCode === "string" ? meta.waterResourcesCode : "";
    const name = typeof meta.waterResourcesName === "string" ? meta.waterResourcesName.trim() : "";
    const lat = Number(meta.latitude), lon = Number(meta.longitude);
    if (!code || !name || !Number.isFinite(lat) || !Number.isFinite(lon) || !inThailand(lat, lon)) return [];
    const capacity = Number(meta.capacity);
    const capacityMcm = Number.isFinite(capacity) && capacity > 0 ? capacity : null;
    const storage = latestStorage(byCode.get(code));
    const rawPct = capacityMcm && storage ? storage.mcm / capacityMcm * 100 : null;
    const ownerName = String(meta.dataOwnerName ?? "");
    return [{
      code, name, lat: round(lat, 5), lon: round(lon, 5), size, kind: dwrKind(name),
      owner: ownerName === "Royal Irrigation Department" ? "RID" : ownerName === "Department of Water Resources" ? "DWR" : "other",
      capacityMcm, storageMcm: storage ? round(storage.mcm, 3) : null,
      pct: rawPct !== null && rawPct <= 150 ? round(rawPct, 1) : null,
      measuredAt: storage?.at ?? null,
    } satisfies DwrReservoir];
  });
}

/** A reading older than this is shown as "ข้อมูลเก่า", never as today's level. */
export const DWR_STALE_DAYS = 30;

export function isStale(measuredAt: string | null, nowMs: number): boolean {
  if (!measuredAt) return true;
  const at = Date.parse(`${measuredAt}T00:00:00+07:00`);
  return !Number.isFinite(at) || nowMs - at > DWR_STALE_DAYS * 86_400_000;
}
