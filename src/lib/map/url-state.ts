import type { MapState } from "./map-state";

export type UrlView = {
  lat?: number;
  lon?: number;
  z?: number;
  layer?: MapState["primary"];
  t?: string;
  ov?: MapState["overlays"];
};

function boundedNumber(value: string | null, min: number, max: number): number | undefined {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

export function parseUrlView(search: string): UrlView {
  const params = new URLSearchParams(search);
  const view: UrlView = {};
  const lat = boundedNumber(params.get("lat"), -5, 30);
  const lon = boundedNumber(params.get("lon"), 80, 130);
  const z = boundedNumber(params.get("z"), 3, 12);
  const layer = params.get("layer");
  const time = params.get("t");
  if (lat !== undefined) view.lat = lat;
  if (lon !== undefined) view.lon = lon;
  if (z !== undefined) view.z = z;
  if (layer === "rain" || layer === "temp" || layer === "pm25") view.layer = layer;
  if (time && Number.isFinite(Date.parse(time))) view.t = time;
  if (params.has("ov")) {
    const names = new Set(params.get("ov")?.split(","));
    view.ov = { wind: names.has("wind"), storms: names.has("storms"), quakes: names.has("quakes"), terrain: names.has("3d") };
  }
  return view;
}

export function formatUrlView(view: Required<Pick<UrlView, "lat" | "lon" | "z" | "layer">> & Pick<UrlView, "t"> & { ov: MapState["overlays"] }): string {
  const params = new URLSearchParams();
  params.set("lat", view.lat.toFixed(2));
  params.set("lon", view.lon.toFixed(2));
  params.set("z", view.z.toFixed(1));
  params.set("layer", view.layer);
  if (view.t) params.set("t", view.t);
  const overlays = [view.ov.wind && "wind", view.ov.storms && "storms", view.ov.quakes && "quakes", view.ov.terrain && "3d"].filter(Boolean).join(",");
  params.set("ov", overlays);
  return `?${params.toString().replace(/%2C/g, ",")}`;
}
