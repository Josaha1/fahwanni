export type FloodLayer = "VIIRS_Combined_Flood_2-Day" | "MODIS_Combined_Flood_2-Day";

export const THERMAL_LAYER = "VIIRS_NOAA20_Thermal_Anomalies_375m_All";

export function floodDate(nowMs: number): string {
  return new Date(nowMs - 86_400_000).toISOString().slice(0, 10);
}

export function thermalAnomaliesDefault(primary: string, nowMs: number): boolean {
  const month = new Date(nowMs + 7 * 60 * 60_000).getUTCMonth();
  return primary === "pm25" && month >= 0 && month <= 3;
}

export function thermalTileUrl(time: string): string {
  return `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${THERMAL_LAYER}&SRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true&TIME=${time}`;
}

export function gibsTileUrl(layer: string, time: string,
  tms: { z: number | string; y: number | string; x: number | string }, tileMatrixSet = "GoogleMapsCompatible_Level9"): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${time}/${tileMatrixSet}/${tms.z}/${tms.y}/${tms.x}.png`;
}
