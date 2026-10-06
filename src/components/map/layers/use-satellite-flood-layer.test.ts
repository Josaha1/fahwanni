import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LayerSpecification, Map as LibreMap } from "maplibre-gl";
import type { FeatureCollection, Polygon } from "geojson";
import type { FloodNowPayload } from "@/components/flood/home-data";
import type { PixelCounts } from "@/lib/flood/viirs";
import { useSatelliteFloodLayer } from "./use-satellite-flood-layer";

const state = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], geometry: null as unknown }));
vi.mock("react", () => ({
  useMemo: (create: () => unknown) => create(),
  useState: () => [state.geometry, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect),
}));
vi.mock("../map-provider", () => ({ useMapContext: () => ({ theme: "dark" }) }));

const geometry: FeatureCollection<Polygon, { id: string }> = { type: "FeatureCollection", features:
  ["wet", "less", "dry", "cloud"].map((id) => ({ type: "Feature", properties: { id },
    geometry: { type: "Polygon", coordinates: [[[100, 15], [101, 15], [101, 16], [100, 15]]] } })) };
const counts = (patch: Partial<PixelCounts> = {}): PixelCounts => ({
  flood: 0, recurringFlood: 0, water: 0, dry: 100, sampled: 100, insufficientData: 0, noData: 0, ...patch,
});
const snapshot: FloodNowPayload = { date: "2026-10-05", provinceCounts: { wet: counts({ flood: 100 }), less: counts({ flood: 25 }),
  dry: counts(), cloud: counts({ insufficientData: 25, noData: 25 }) },
  regionCounts: { north: counts(), northeast: counts(), central: counts(), east: counts(), west: counts(), south: counts() } };
const report = { date: snapshot.date, layer: "VIIRS_Combined_Flood_2-Day" as const };
const cleanups: (() => void)[] = [];

function fakeMap() {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<string, unknown>();
  const images = new Map<string, unknown>();
  const handlers = new Map<string, Set<() => void>>();
  return {
    layers, sources, images,
    getStyle: () => ({ layers: [...layers.values()] }),
    getLayer: (id: string) => layers.get(id),
    addLayer: vi.fn((layer: LayerSpecification) => layers.set(layer.id, layer)),
    removeLayer: (id: string) => layers.delete(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: unknown) => sources.set(id, source),
    removeSource: (id: string) => sources.delete(id),
    hasImage: (id: string) => images.has(id),
    addImage: (id: string, image: unknown) => images.set(id, image),
    removeImage: (id: string) => images.delete(id),
    on: (event: string, handler: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    off: (event: string, handler: () => void) => handlers.get(event)?.delete(handler),
    emit: (event: string) => { for (const handler of handlers.get(event) ?? []) handler(); },
  };
}

function SatelliteHarness(map: ReturnType<typeof fakeMap>, enabled = true, selected = report, payload: FloodNowPayload | null = snapshot) {
  useSatelliteFloodLayer(map as unknown as LibreMap, enabled, selected, payload);
  for (const effect of state.effects.splice(0)) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
}

beforeEach(() => {
  state.geometry = geometry;
  vi.stubGlobal("document", { documentElement: {}, createElement: () => ({ getContext: () => ({
    fillStyle: "", fillRect: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(256) }),
  }) }) });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (name: string) => name === "--water" ? "#22d3ee" : "#64748b" }));
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

it("joins province ratios, hatches missing observations and keeps GIBS at zoom 8", () => {
  const map = fakeMap();
  map.layers.set("dam-circle", { id: "dam-circle", type: "symbol", source: "dams" });
  SatelliteHarness(map);
  const source = map.sources.get("province-flood") as { attribution: string; data: { features: { properties: { opacity: number; cloudy: boolean } }[] } };
  expect(source.data.features.map((feature) => [feature.properties.opacity, feature.properties.cloudy]))
    .toEqual([[1, false], [0.5, false], [0, false], [0, true]]);
  expect(source.attribution).toContain("geoBoundaries");
  expect(source.attribution).toContain("ODbL");
  expect(map.layers.get("sat-flood")).toMatchObject({ type: "raster", minzoom: 8 });
  expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "province-flood-fill" }), "sat-flood");
  expect(map.layers.get("province-flood-cloud")).toMatchObject({
    filter: ["==", ["get", "cloudy"], true], paint: { "fill-pattern": "province-cloud-hatch" },
  });
  expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "province-flood-cloud" }), "dam-circle");
  const additions = map.addLayer.mock.calls.length;
  map.emit("idle");
  expect(map.addLayer).toHaveBeenCalledTimes(additions);
});

it("restores layers and hatch after a style reload and cleans up its own resources", () => {
  const map = fakeMap();
  SatelliteHarness(map);
  map.layers.clear(); map.sources.clear(); map.images.clear();
  map.emit("style.load");
  expect(map.layers.size).toBe(4);
  expect(map.images.has("province-cloud-hatch")).toBe(true);
  map.layers.set("dam-circle", { id: "dam-circle", type: "symbol", source: "dams" });
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  expect([...map.layers.keys()]).toEqual(["dam-circle"]);
  expect(map.sources.size).toBe(0);
  expect(map.images.size).toBe(0);
});

it("keeps historical GIBS without borrowing current province counts", () => {
  const map = fakeMap();
  SatelliteHarness(map, true, { ...report, date: "2026-10-04" });
  expect([...map.layers.keys()]).toEqual(["sat-flood"]);
  expect(map.sources.has("province-flood")).toBe(false);
});

it("does not invent a zero-flood choropleth when the API is unavailable", () => {
  const map = fakeMap();
  SatelliteHarness(map, true, report, null);
  expect(map.sources.has("province-flood")).toBe(false);
});

it("adds no satellite layers when disabled", () => {
  const map = fakeMap();
  SatelliteHarness(map, false);
  expect(map.layers.size).toBe(0);
  expect(map.sources.size).toBe(0);
});
