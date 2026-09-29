export type DamBand = 1 | 2 | 3 | 4 | 5;
export type StationSituation = 1 | 2 | 3 | 4 | 5;

export interface Dam {
  id: string;
  nameTh: string;
  nameEn: string;
  lat: number;
  lon: number;
  province: { th: string; en: string };
  basin: { th: string; en: string };
  agency: "RID" | "EGAT" | string;
  date: string;
  storageMcm: number;
  storagePct: number;
  usablePct: number | null;
  capacityMcm: number;
  inflowMcmDay: number | null;
  releaseMcmDay: number | null;
  spilledMcmDay: number | null;
  inflowCms: number | null;
  releaseCms: number | null;
  band: DamBand;
  highRelease: boolean;
}

export interface RiverStation {
  code: string;
  nameTh: string;
  lat: number;
  lon: number;
  time: string;
  pctBank: number | null;
  situation: StationSituation | null;
  dischargeCms: number | null;
  qmaxCms: number | null;
  basinTh: string;
}

export type Barrage = {
  id: "chao-phraya";
  nameTh: "เขื่อนเจ้าพระยา";
  nameEn: "Chao Phraya Dam";
  lat: number;
  lon: number;
  dischargeCms: number | null;
  qmaxCms: number | null;
  situation: StationSituation | null;
  time: string;
} | null;
