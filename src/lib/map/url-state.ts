import { FOCUS } from "../features";
import { THAILAND_BOUNDS } from "../geo";
import type { MapState } from "./map-state";

export type UrlView = {
  lat?: number;
  lon?: number;
  z?: number;
  layer?: MapState["primary"];
  hiddenLayer?: boolean;
  /** Selected time in epoch ms. In the URL it is epoch minutes (`t=29318400`); older links used ISO. */
  t?: number;
  ov?: MapState["overlays"];
  dam?: string;
  river?: string;
  mode?: MapState["mode"];
  wd?: number;
  /** Water mode: show every dam's downstream route (`routes=1`). */
  routes?: boolean;
};

function boundedNumber(value: string | null, min: number, max: number): number | undefined {
  if (value === null || !/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

export function parseUrlView(search: string, focus: "flood" | "all" = FOCUS): UrlView {
  const params = new URLSearchParams(search);
  const view: UrlView = {};
  const lat = boundedNumber(params.get("lat"), THAILAND_BOUNDS[0][1], THAILAND_BOUNDS[1][1]);
  const lon = boundedNumber(params.get("lon"), THAILAND_BOUNDS[0][0], THAILAND_BOUNDS[1][0]);
  const z = boundedNumber(params.get("z"), 3, 17);
  const layer = params.get("layer");
  // `focus` was a temporary name for the same thing while the time bar was being built.
  const time = params.get("t") ?? params.get("focus");
  const dam = params.get("dam");
  const river = params.get("river");
  if (lat !== undefined) view.lat = lat;
  if (lon !== undefined) view.lon = lon;
  if (z !== undefined) view.z = z;
  if (layer === "rain" || layer === "temp" || layer === "pm25" || layer === "heat" || layer === "cloud" || layer === "satellite") view.layer = layer;
  if (time && /^\d{7,9}$/.test(time)) view.t = Number(time) * 60_000;
  else if (time && /^\d{4}-\d\d-\d\d/.test(time) && Number.isFinite(Date.parse(time))) view.t = Math.round(Date.parse(time) / 60_000) * 60_000;
  if (dam && /^[a-z0-9-]+$/.test(dam)) view.dam = dam;
  if (river && /^[a-z0-9-]+$/.test(river)) view.river = river;
  if (params.has("ov")) {
    const names = new Set(params.get("ov")?.split(","));
    view.ov = { wind: names.has("wind"), storms: names.has("storms"), quakes: names.has("quakes"), dams: names.has("dams"), terrain: names.has("3d") };
  }
  // Older links turned dams on through `ov=dams` or `dam=`; both now mean water mode.
  if (params.get("mode") === "water" || view.dam || view.river || view.ov?.dams) view.mode = "water";
  else if (params.get("mode") === "weather" || view.layer) view.mode = "weather";
  if (focus === "flood" && view.layer && view.layer !== "rain") {
    view.layer = "rain";
    view.hiddenLayer = true;
  }
  const wd = boundedNumber(params.get("wd"), 1, 7);
  if (view.mode === "water" && wd !== undefined && Number.isInteger(wd)) view.wd = wd;
  if (view.mode === "water" && params.get("routes") === "1") view.routes = true;
  return view;
}

export function formatUrlView(view: Required<Pick<UrlView, "lat" | "lon" | "z" | "layer">> & Pick<UrlView, "t" | "dam" | "river" | "mode" | "wd" | "routes"> & { ov: MapState["overlays"] }): string {
  const water = view.mode === "water";
  const params = new URLSearchParams();
  params.set("lat", view.lat.toFixed(2));
  params.set("lon", view.lon.toFixed(2));
  params.set("z", view.z.toFixed(1));
  params.set("layer", view.layer);
  if (view.t !== undefined) params.set("t", String(Math.round(view.t / 60_000)));
  if (view.mode) params.set("mode", view.mode);
  if (water && view.wd !== undefined && Number.isInteger(view.wd) && view.wd >= 1 && view.wd <= 7) params.set("wd", String(view.wd));
  if (water && view.routes) params.set("routes", "1");
  if (water && view.dam && /^[a-z0-9-]+$/.test(view.dam)) params.set("dam", view.dam);
  if (water && view.river && /^[a-z0-9-]+$/.test(view.river)) params.set("river", view.river);
  const overlays = [view.ov.wind && "wind", view.ov.storms && "storms", view.ov.quakes && "quakes", view.ov.terrain && "3d"].filter(Boolean).join(",");
  params.set("ov", overlays);
  return `?${params.toString().replace(/%2C/g, ",")}`;
}
