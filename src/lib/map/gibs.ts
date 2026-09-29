export type FloodLayer = "VIIRS_Combined_Flood_2-Day" | "MODIS_Combined_Flood_2-Day";

export function floodDate(nowMs: number): string {
  return new Date(nowMs - 86_400_000).toISOString().slice(0, 10);
}

export function gibsTileUrl(layer: string, time: string,
  tms: { z: number | string; y: number | string; x: number | string }, tileMatrixSet = "GoogleMapsCompatible_Level9"): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/${tileMatrixSet}/${tms.z}/${tms.y}/${tms.x}.png`;
}
