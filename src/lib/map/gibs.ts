export type FloodLayer = "VIIRS_Combined_Flood_2-Day" | "MODIS_Combined_Flood_2-Day";

export function floodDate(nowMs: number): string {
  return new Date(nowMs - 86_400_000).toISOString().slice(0, 10);
}

export function gibsTileUrl(layer: FloodLayer, date: string, tms: { z: number | string; y: number | string; x: number | string }): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/${tms.z}/${tms.y}/${tms.x}.png`;
}
