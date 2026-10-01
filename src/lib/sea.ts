/**
 * Sea surface temperature + coral bleaching heat stress, NOAA Coral Reef Watch v3.1 daily 5 km
 * ("available for use without restriction"; cite NOAA CRW). ERDDAP host: pae-paha.pacioos.hawaii.edu (dataset dhw_5km).
 */
export type BleachingLevel = 0 | 1 | 2 | 3 | 4;
export interface SeaReading { date: string; lat: number; lon: number; sstC: number; dhw: number; level: BleachingLevel }

/** CRW Bleaching Alert Area: 0 no stress, 1 watch, 2 warning, 3 alert level 1, 4 alert level 2 (higher v3.1 levels fold into 4). */
export const BLEACHING_WORDS: Record<BleachingLevel, string> = {
  0: "ปะการังปกติ ไม่มีความเครียดจากความร้อน", 1: "เฝ้าระวัง: น้ำเริ่มอุ่นกว่าปกติ", 2: "เตือน: ปะการังเริ่มเครียดจากความร้อน",
  3: "แจ้งเตือนระดับ 1: เสี่ยงปะการังฟอกขาว", 4: "แจ้งเตือนระดับ 2: เสี่ยงปะการังฟอกขาวรุนแรง/ตาย",
};
export const BLEACHING_COLORS: Record<BleachingLevel, string> = { 0: "#2E9E4F", 1: "#E8B500", 2: "#F28C28", 3: "#D32F2F", 4: "#7B1E1E" };

export interface DiveSpot { id: string; nameTh: string; nameEn: string; lat: number; lon: number }
export const DIVE_SPOTS: readonly DiveSpot[] = [
  { id: "koh-tao", nameTh: "เกาะเต่า", nameEn: "Koh Tao", lat: 10.1, lon: 99.84 },
  { id: "similan", nameTh: "หมู่เกาะสิมิลัน", nameEn: "Similan Islands", lat: 8.65, lon: 97.64 },
  { id: "phi-phi", nameTh: "เกาะพีพี", nameEn: "Koh Phi Phi", lat: 7.74, lon: 98.77 },
  { id: "hin-daeng", nameTh: "หินแดง–หินม่วง", nameEn: "Hin Daeng", lat: 7.15, lon: 98.82 },
  { id: "surin", nameTh: "หมู่เกาะสุรินทร์", nameEn: "Surin Islands", lat: 9.43, lon: 97.87 },
  { id: "lipe", nameTh: "เกาะหลีเป๊ะ", nameEn: "Koh Lipe", lat: 6.49, lon: 99.3 },
  { id: "koh-chang", nameTh: "เกาะช้าง", nameEn: "Koh Chang", lat: 12.05, lon: 102.33 },
  { id: "koh-larn", nameTh: "เกาะล้าน", nameEn: "Koh Larn", lat: 12.92, lon: 100.78 },
];

/** Thai seas only (Gulf of Thailand + Andaman); the API refuses anything else. */
export function inThaiSeas(lat: number, lon: number) {
  return lat >= 5.5 && lat <= 14 && lon >= 97.3 && lon <= 103.2;
}

export function bleachingLevel(baa: number): BleachingLevel {
  return baa >= 4 ? 4 : baa >= 3 ? 3 : baa >= 2 ? 2 : baa >= 1 ? 1 : 0;
}

/** ERDDAP query for a small box around the point (5 km grid), latest day. */
export function erddapUrl(lat: number, lon: number, box = 0.15) {
  const range = (a: number, b: number) => `[(${a.toFixed(3)}):(${b.toFixed(3)})]`;
  const lats = range(lat - box, lat + box), lons = range(lon - box, lon + box);
  const vars = ["CRW_SST", "CRW_DHW", "CRW_BAA"].map((name) => `${name}[last]${lats}${lons}`).join(",");
  // ERDDAP wants [ ] percent-encoded; ( ) : and , stay literal.
  return `https://pae-paha.pacioos.hawaii.edu/erddap/griddap/dhw_5km.json?${vars.replace(/\[/g, "%5B").replace(/\]/g, "%5D")}`;
}

type Table = { table?: { columnNames?: string[]; rows?: unknown[][] } };

/** Nearest sea pixel (land/no-data rows are null) to the point; null when the whole box is land. */
export function nearestSeaReading(json: Table, lat: number, lon: number): SeaReading | null {
  const names = json.table?.columnNames ?? [];
  const index = (name: string) => names.indexOf(name);
  const [iTime, iLat, iLon, iSst, iDhw, iBaa] = ["time", "latitude", "longitude", "CRW_SST", "CRW_DHW", "CRW_BAA"].map(index);
  if ([iTime, iLat, iLon, iSst, iDhw, iBaa].some((i) => i < 0)) return null;
  let best: SeaReading | null = null, bestDistance = Infinity;
  for (const row of json.table?.rows ?? []) {
    const sst = row[iSst], dhw = row[iDhw], baa = row[iBaa], rowLat = Number(row[iLat]), rowLon = Number(row[iLon]);
    if (typeof sst !== "number" || typeof dhw !== "number" || typeof baa !== "number" || !Number.isFinite(sst)) continue;
    const distance = (rowLat - lat) ** 2 + (rowLon - lon) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { date: String(row[iTime]).slice(0, 10), lat: rowLat, lon: rowLon, sstC: Math.round(sst * 10) / 10,
        dhw: Math.round(dhw * 10) / 10, level: bleachingLevel(baa) };
    }
  }
  return best;
}
