import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as LibreMap, LayerSpecification, FilterSpecification } from "maplibre-gl";
import type { DamsPayload } from "@/lib/dams/client";
import { useDamsLayer } from "./use-dams-layer";

const state = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[], reducedMotion: false, lite: false,
}));
vi.mock("react", () => ({
  useMemo: (create: () => unknown) => create(),
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect),
}));
vi.mock("@/i18n/client", () => ({ useT: () => ({ locale: "th" }) }));
vi.mock("../map-provider", () => ({ useMapContext: () => ({ theme: "dark" }) }));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => state }));

function fakeMap(styleLoaded = true) {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<string, unknown>();
  const images = new Set<string>();
  const handlers = new Map<string, Set<(event: { id: string }) => void>>();
  const map = {
    layers, sources, images,
    getStyle: () => ({}), isStyleLoaded: () => styleLoaded,
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: LayerSpecification) => layers.set(layer.id, layer),
    removeLayer: (id: string) => layers.delete(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: unknown) => sources.set(id, source),
    removeSource: (id: string) => sources.delete(id),
    hasImage: (id: string) => images.has(id),
    loadImage: vi.fn(async () => ({ data: {} })),
    addImage: vi.fn((id: string) => images.add(id)),
    setFilter: vi.fn((id: string, filter: FilterSpecification) => {
      const layer = layers.get(id);
      if (layer && "source" in layer) layer.filter = filter;
    }),
    setPaintProperty: vi.fn(), fire: vi.fn(),
    on: (event: string, handler: (event: { id: string }) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    off: (event: string, handler: (event: { id: string }) => void) => handlers.get(event)?.delete(handler),
    emit: (event: string, detail = { id: "" }) => { for (const handler of handlers.get(event) ?? []) handler(detail); },
  };
  return map;
}

const payload = {
  dams: [
    { id: "a", band: 4, storagePct: 80.1, releaseCms: 100, capacityMcm: 100, nameTh: "เขื่อน ก", lat: 15, lon: 100 },
    { id: "b", band: 5, storagePct: 100.1, releaseCms: 99.9, capacityMcm: 1000, nameTh: "เขื่อน ข", lat: 16, lon: 101 },
    { id: "c", band: 1, storagePct: null, releaseCms: null, capacityMcm: 10, nameTh: "เขื่อน ค", lat: 17, lon: 102 },
  ],
} as unknown as DamsPayload;
const cleanups: (() => void)[] = [];
function DamLayerHarness(map: ReturnType<typeof fakeMap>, day = 0, ids: Set<string> | null = null) {
  useDamsLayer(map as unknown as LibreMap, payload, true, day, ids);
  for (const effect of state.effects.splice(0)) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
}

beforeEach(() => {
  state.reducedMotion = false;
  state.lite = false;
  vi.stubGlobal("document", { visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
});

describe("dam ring layer", () => {
  it("keeps the clickable layer id, sizes symbols by capacity, and uses actual release thresholds", () => {
    const map = fakeMap();
    DamLayerHarness(map);
    const source = map.sources.get("dams") as { data: { features: { properties: { sprite: string; high: number } }[] } };
    expect(source.data.features.map(({ properties }) => [properties.sprite, properties.high])).toEqual([
      ["ring-release-80", 1], ["ring-warn-100", 0], ["ring-nodata", 0],
    ]);
    const symbol = map.layers.get("dam-circle");
    expect(symbol?.type).toBe("symbol");
    if (symbol?.type !== "symbol") throw new Error("Expected ring symbols");
    expect(symbol.layout?.["icon-size"]).toContain(40);
    expect(symbol.layout?.["icon-allow-overlap"]).toBe(true);
    expect(map.layers.get("dam-high")?.type).toBe("circle");
  });

  it("loads PNGs at pixelRatio 2 and restores images and layers after a style reload", async () => {
    const map = fakeMap();
    DamLayerHarness(map);
    await vi.waitFor(() => expect(map.images.size).toBe(3));
    expect(map.loadImage).toHaveBeenCalledWith("/map/rings/ring-nodata.png");
    expect(map.addImage).toHaveBeenCalledWith("ring-release-80", {}, { pixelRatio: 2 });
    map.layers.clear(); map.sources.clear(); map.images.clear();
    map.emit("style.load");
    expect(map.images.size).toBe(3);
    expect(map.layers.get("dam-circle")?.type).toBe("symbol");
    expect(map.loadImage).toHaveBeenCalledTimes(3);
  });

  it("preloads and resolves missing sprites while tiles keep the style busy without idle", async () => {
    const map = fakeMap(false);
    DamLayerHarness(map);
    expect(map.loadImage).toHaveBeenCalledTimes(3);
    map.emit("styleimagemissing", { id: "ring-release-80" });
    map.emit("styleimagemissing", { id: "unrelated-icon" });
    await vi.waitFor(() => expect(map.images.size).toBe(3));
    expect(map.isStyleLoaded()).toBe(false);
    expect(map.loadImage).toHaveBeenCalledTimes(3);
    // A missing event alone must restore the cached image, without style.load or idle.
    map.images.delete("ring-release-80");
    map.emit("styleimagemissing", { id: "ring-release-80" });
    expect(map.images.has("ring-release-80")).toBe(true);
    expect(map.addImage).toHaveBeenLastCalledWith("ring-release-80", {}, { pixelRatio: 2 });
    expect(map.loadImage).toHaveBeenCalledTimes(3);
  });

  it("shows band-coloured fallback circles only until each sprite arrives", async () => {
    const map = fakeMap(false);
    let resolve!: (value: { data: object }) => void;
    map.loadImage.mockImplementation(() => new Promise((done) => { resolve = done; }));
    DamLayerHarness(map, 1, new Set(["a"]));
    const fallback = map.layers.get("dam-fallback");
    if (fallback?.type !== "circle") throw new Error("Expected fallback circles");
    expect(fallback?.filter).toEqual(["in", ["get", "sprite"], ["literal", ["ring-release-80"]]]);
    expect(fallback?.type === "circle" && fallback.paint).toMatchObject({
      "circle-radius": 4, "circle-color": ["get", "color"], "circle-opacity": 0.45,
    });
    const source = map.sources.get("dams") as { data: { features: { properties: { color: string } }[] } };
    expect(source.data.features[0].properties.color).toBe("#FF0000");
    resolve({ data: {} });
    await vi.waitFor(() => expect(fallback?.filter).toEqual(["in", ["get", "sprite"], ["literal", []]]));
  });

  it("keeps the fallback after a PNG fails", async () => {
    const map = fakeMap();
    map.loadImage.mockRejectedValue(new Error("PNG unavailable"));
    DamLayerHarness(map, 0, new Set(["a"]));
    await vi.waitFor(() => expect(map.fire).toHaveBeenCalledWith("error", { error: new Error("PNG unavailable") }));
    const fallback = map.layers.get("dam-fallback");
    expect(fallback?.type === "circle" && fallback.filter).toEqual(["in", ["get", "sprite"], ["literal", ["ring-release-80"]]]);
    expect(map.addImage).not.toHaveBeenCalled();
  });

  it("ignores pending images and removes the missing-image handler after cleanup", async () => {
    const map = fakeMap();
    let resolve!: (value: { data: object }) => void;
    map.loadImage.mockImplementation(() => new Promise((done) => { resolve = done; }));
    DamLayerHarness(map, 0, new Set(["a"]));
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    resolve({ data: {} });
    await Promise.resolve();
    map.emit("styleimagemissing", { id: "ring-release-80" });
    expect(map.addImage).not.toHaveBeenCalled();
    expect(map.loadImage).toHaveBeenCalledTimes(1);
    expect(map.layers.size).toBe(0);
  });

  it.each(["reducedMotion", "lite"] as const)("removes the pulse for %s", (mode) => {
    state[mode] = true;
    const map = fakeMap();
    DamLayerHarness(map);
    expect(map.layers.has("dam-high")).toBe(false);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(map.layers.has("dam-circle")).toBe(true);
  });

  it("keeps the day opacity and dam filter without pulsing past reports", () => {
    const map = fakeMap();
    DamLayerHarness(map, 1, new Set(["a"]));
    expect(map.layers.has("dam-high")).toBe(false);
    const symbol = map.layers.get("dam-circle");
    expect(symbol?.type === "symbol" && symbol.paint?.["icon-opacity"]).toBe(0.45);
    expect(map.loadImage).toHaveBeenCalledTimes(1);
  });

  it("animates high releases and yields motion to a focused route", () => {
    const map = fakeMap();
    DamLayerHarness(map);
    const tick = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    tick(900);
    expect(map.setPaintProperty).toHaveBeenCalledWith("dam-high", "circle-stroke-opacity", 0.3);
    map.layers.set("dam-path-flow", { id: "dam-path-flow", type: "line", source: "dam-path" });
    tick(1000);
    expect(map.setPaintProperty).toHaveBeenCalledWith("dam-high", "circle-stroke-opacity", 0);
  });
});
