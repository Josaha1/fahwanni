import { distanceKm, type Position } from "../storms/normalize";
import { provinceIndexAt, type ProvinceMask } from "./mask";
import type { PalettePng } from "./png";

export type FloodClass = "dry" | "water" | "recurring-flood" | "flood" | "insufficient-data" | "no-data";
export type FloodTile = { x: number; y: number; z: number; image: PalettePng };
export type FloodSample = Position & { provinceId: string; kind: FloodClass };
export type PixelCounts = { flood: number; recurringFlood: number; dry: number; water: number; insufficientData: number; noData: number; sampled: number };
export const SAMPLING_ZOOM = 7;
export const FLOOD_ATTRIBUTION = ["NASA LANCE/GIBS VIIRS flood", "geoBoundaries / © OpenStreetMap contributors (ODbL)"];

// GIBS MODIS_Flood colormap is shared by the combined MODIS/VIIRS flood layers.
// Grey means insufficient observations (often cloud), not confirmed cloud cover.
// https://gibs.earthdata.nasa.gov/colormaps/v1.3/output/MODIS_Flood.html
export function classifyPixel([r, g, b]: readonly number[]): FloodClass {
  if (r === 0 && g === 0 && b === 1) return "dry";
  if (r === 50 && g === 210 && b === 245) return "water";
  if (r === 255 && g === 255 && b === 0) return "recurring-flood";
  if (r === 250 && g === 30 && b === 36) return "flood";
  if (r === 175 && g === 175 && b === 175) return "insufficient-data";
  return "no-data";
}

function tileY(lat: number, z: number): number {
  const rad = lat * Math.PI / 180;
  return (1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2 * 2 ** z;
}

export function thailandTiles(z = SAMPLING_ZOOM): Array<{ x: number; y: number; z: number }> {
  const tiles = [];
  for (let y = Math.floor(tileY(20.5, z)); y <= Math.floor(tileY(5.5, z)); y++) {
    for (let x = Math.floor((97.3 + 180) / 360 * 2 ** z); x <= Math.floor((105.7 + 180) / 360 * 2 ** z); x++) tiles.push({ x, y, z });
  }
  return tiles;
}

export function pixelPosition(tile: FloodTile, x: number, y: number): Position {
  const scale = 2 ** tile.z;
  return {
    lon: (tile.x + (x + 0.5) / tile.image.width) / scale * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile.y + (y + 0.5) / tile.image.height) / scale))) * 180 / Math.PI,
  };
}

// Geometry is independent of observation date and palette. Mask identity keeps
// fixture/different polygon sets from reusing the national grid's province IDs.
const provinceIndices = new WeakMap<ProvinceMask[], Map<string, Uint8Array>>();

function tileProvinceIndices(tile: FloodTile, masks: ProvinceMask[]): Uint8Array {
  let grid = provinceIndices.get(masks);
  if (!grid) { grid = new Map(); provinceIndices.set(masks, grid); }
  const { width, height } = tile.image;
  const key = `${tile.z}/${tile.x}/${tile.y}/${width}/${height}`;
  const cached = grid.get(key);
  if (cached) return cached;
  const indices = new Uint8Array(width * height);
  let previous = -1;
  for (let y = 0; y < height; y++) {
    const { lat } = pixelPosition(tile, 0, y);
    for (let x = 0; x < width; x++) {
      const lon = (tile.x + (x + 0.5) / width) / 2 ** tile.z * 360 - 180;
      const index = provinceIndexAt(lon, lat, masks, previous);
      indices[y * width + x] = index + 1;
      if (index >= 0) previous = index;
    }
  }
  grid.set(key, indices);
  return indices;
}

export function sampleTiles(tiles: FloodTile[], masks: ProvinceMask[]): FloodSample[] {
  const samples: FloodSample[] = [];
  for (const tile of tiles) {
    const indices = tileProvinceIndices(tile, masks);
    for (let y = 0; y < tile.image.height; y++) for (let x = 0; x < tile.image.width; x++) {
      const at = y * tile.image.width + x;
      if (!indices[at]) continue;
      const position = pixelPosition(tile, x, y);
      const provinceId = masks[indices[at] - 1].id;
      samples.push({ ...position, provinceId, kind: classifyPixel(tile.image.palette[tile.image.pixels[at]]) });
    }
  }
  return samples;
}

const emptyCounts = (): PixelCounts => ({ flood: 0, recurringFlood: 0, dry: 0, water: 0, insufficientData: 0, noData: 0, sampled: 0 });
const countKey = { flood: "flood", "recurring-flood": "recurringFlood", dry: "dry", water: "water", "insufficient-data": "insufficientData", "no-data": "noData" } as const;

function add(counts: PixelCounts, sample: FloodSample): void {
  counts[countKey[sample.kind]]++;
  counts.sampled++;
}

/** Counts grid pixel centres, not hectares, native-resolution pixels, or water depth. */
export function provinceCounts(tiles: FloodTile[], masks: ProvinceMask[]): Record<string, PixelCounts> {
  return countsByProvince(sampleTiles(tiles, masks), masks);
}

export function countsByProvince(samples: FloodSample[], masks: ProvinceMask[]): Record<string, PixelCounts> {
  const counts = Object.fromEntries(masks.map((mask) => [mask.id, emptyCounts()]));
  for (const sample of samples) if (counts[sample.provinceId]) add(counts[sample.provinceId], sample);
  return counts;
}

export function nearMe(samples: FloodSample[], place: Position, radiusKm = 30) {
  const counts = emptyCounts();
  for (const sample of samples) if (distanceKm(place, sample) <= radiusKm) add(counts, sample);
  const verdict = counts.flood + counts.recurringFlood >= 5 ? "flood"
    : counts.sampled === 0 || counts.noData + counts.insufficientData >= counts.sampled * 0.5 ? "cloud-or-no-data" : "not-seen";
  return { ...place, radiusKm, verdict, counts };
}

const regionProvinces = {
  north: "chiang-mai chiang-rai lampang lamphun mae-hong-son nan phayao phrae uttaradit",
  northeast: "amnat-charoen bueng-kan buri-ram chaiyaphum kalasin khon-kaen loei maha-sarakham mukdahan nakhon-phanom nakhon-ratchasima nong-bua-lam-phu nong-khai roi-et sakon-nakhon si-sa-ket surin ubon-ratchathani udon-thani yasothon",
  east: "chachoengsao chanthaburi chon-buri prachin-buri rayong sa-kaeo trat",
  west: "kanchanaburi phetchaburi prachuap-khiri-khan ratchaburi tak",
  south: "chumphon krabi nakhon-si-thammarat narathiwat pattani phang-nga phatthalung phuket ranong satun songkhla surat-thani trang yala",
};
export type FloodRegion = keyof typeof regionProvinces | "central";
const regionByProvince = new Map<string, FloodRegion>(Object.entries(regionProvinces)
  .flatMap(([region, ids]) => ids.split(" ").map((id) => [id, region as FloodRegion] as const)));

export function regionCounts(counts: Record<string, PixelCounts>): Record<FloodRegion, PixelCounts> {
  const result = Object.fromEntries(["north", "northeast", "central", "east", "west", "south"].map((region) => [region, emptyCounts()])) as Record<FloodRegion, PixelCounts>;
  for (const [id, count] of Object.entries(counts)) {
    const region = result[regionByProvince.get(id) ?? "central"];
    for (const key of Object.keys(count) as Array<keyof PixelCounts>) region[key] += count[key];
  }
  return result;
}
