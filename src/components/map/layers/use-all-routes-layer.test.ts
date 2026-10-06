import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Map as LibreMap, LayerSpecification } from "maplibre-gl";
import type { DamsPayload } from "@/lib/dams/client";
import type { DamPath } from "@/lib/dams/paths";
import { FLOW_DASH_STEPS } from "@/lib/dams/flow";
import { useAllRoutesLayer } from "./use-all-routes-layer";
import { useDamPathLayer } from "./use-dam-path-layer";

const state = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[],
  paths: null as DamPath[] | null, reducedMotion: false, lite: false }));
vi.mock("react", () => ({
  useMemo: (create: () => unknown) => create(),
  useState: () => [state.paths, (paths: DamPath[]) => { state.paths = paths; }],
  useEffect: (effect: () => void | (() => void)) => state.effects.push(effect),
}));
vi.mock("../map-provider", () => ({ useMapContext: () => ({ theme: "dark" }) }));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => state }));
vi.mock("@/lib/dams/paths", () => ({ loadDamPaths: vi.fn() }));

function fakeMap() {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<string, unknown>();
  const handlers = new Map<string, Set<() => void>>();
  return {
    layers, sources, getStyle: () => ({}),
    getLayer: (id: string) => layers.get(id),
    addLayer: vi.fn((layer: LayerSpecification) => layers.set(layer.id, layer)),
    removeLayer: (id: string) => layers.delete(id),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, source: unknown) => sources.set(id, source),
    removeSource: (id: string) => sources.delete(id),
    setPaintProperty: vi.fn(), fitBounds: vi.fn(),
    getContainer: () => ({ clientHeight: 600 }),
    on: (event: string, handler: () => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    },
    off: (event: string, handler: () => void) => handlers.get(event)?.delete(handler),
    emit: (event: string) => { for (const handler of handlers.get(event) ?? []) handler(); },
  };
}

const paths: DamPath[] = ["zero", "slow", "mid", "fast", "null", "missing"].map((damId) => ({
  type: "Feature", properties: { damId, km: 10 },
  geometry: { type: "LineString", coordinates: [[100, 15], [101, 14]] },
}));
const payload = { dams: [0, 49, 100, 2000, null].map((releaseCms, index) => ({
  id: paths[index].properties.damId, releaseCms, lat: 15, lon: 100,
})) } as DamsPayload;
const cleanups: (() => void)[] = [];
function runEffects() {
  for (const effect of state.effects.splice(0)) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
}
function OverviewHarness(map: ReturnType<typeof fakeMap>, enabled = true, day = 0) {
  useAllRoutesLayer(map as unknown as LibreMap, payload, enabled, day);
  runEffects();
}

beforeEach(() => {
  state.paths = paths;
  state.reducedMotion = false;
  state.lite = false;
  vi.stubGlobal("document", { documentElement: {}, visibilityState: "visible", addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: (name: string) => name === "--release" ? "#fbbf24" : "#64748b" }));
  vi.stubGlobal("performance", { now: () => 0 });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("all dam flow routes", () => {
  it("joins every path to reported releases, preserving zero, null and missing dams", () => {
    const map = fakeMap();
    OverviewHarness(map);
    const source = map.sources.get("all-routes") as { data: { features: { properties: Record<string, unknown> }[] } };
    expect(source.data.features.map(({ properties: p }) => [p.damId, p.releaseCms, p.role, p.bucket])).toEqual([
      ["zero", 0, "water", "none"], ["slow", 49, "water", "slow"], ["mid", 100, "release", "mid"],
      ["fast", 2000, "release", "fast"], ["null", null, "nodata", "none"], ["missing", null, "nodata", "none"],
    ]);
    expect(source.data.features[0].properties.width).toBe(1);
    expect(source.data.features[3].properties.width).toBe(8);
    expect(map.layers.get("all-routes-nodata")).toMatchObject({ filter: ["==", ["get", "role"], "nodata"],
      paint: { "line-color": "#64748b", "line-dasharray": [0.5, 2] } });
    expect(map.layers.get("all-routes")).toMatchObject({ paint: {
      "line-color": ["case", ["==", ["get", "role"], "release"], "#fbbf24", ["==", ["get", "role"], "nodata"], "#64748b", "#bfdbfe"],
    } });
  });

  it("moves three buckets at different speeds in one frame loop and yields to focus", () => {
    const map = fakeMap();
    OverviewHarness(map);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    const tick = vi.mocked(requestAnimationFrame).mock.calls[0][0];
    tick(240);
    for (const [bucket, step] of [["slow", 1], ["mid", 2], ["fast", 4]] as const) {
      expect(map.setPaintProperty).toHaveBeenCalledWith(`all-routes-${bucket}`, "line-dasharray", FLOW_DASH_STEPS[step]);
    }
    map.layers.set("dam-path-flow", { id: "dam-path-flow", type: "line", source: "dam-path" });
    map.setPaintProperty.mockClear();
    tick(480);
    expect(map.setPaintProperty).not.toHaveBeenCalled();
  });

  it.each(["reducedMotion", "lite"] as const)("keeps reported routes and dotted no-data static for %s", (mode) => {
    state[mode] = true;
    const map = fakeMap();
    OverviewHarness(map);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(map.layers.has("all-routes")).toBe(true);
    expect(map.layers.has("all-routes-nodata")).toBe(true);
    expect(map.layers.get("all-routes-fast")).toMatchObject({ paint: { "line-opacity": 0 } });
  });

  it("matches the dams layer's waterDay opacity without inventing future releases", () => {
    const map = fakeMap();
    OverviewHarness(map, true, 3);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(map.layers.get("all-routes")).toMatchObject({ paint: { "line-opacity": ["case", ["==", ["get", "role"], "nodata"], 0, 0.45] } });
  });

  it("restores all layers on style reload and removes only overview layers on cleanup", () => {
    const map = fakeMap();
    map.layers.set("dam-path-casing", { id: "dam-path-casing", type: "line", source: "dam-path" });
    OverviewHarness(map);
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "all-routes" }), "dam-path-casing");
    map.layers.clear(); map.sources.clear();
    map.emit("style.load");
    expect(map.layers.size).toBe(5);
    map.layers.set("dam-path", { id: "dam-path", type: "line", source: "dam-path" });
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
    expect([...map.layers.keys()]).toEqual(["dam-path"]);
    expect(map.sources.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("adds no overview outside water mode", () => {
    const map = fakeMap();
    OverviewHarness(map, false);
    expect(map.layers.size).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it.each(["reducedMotion", "lite"] as const)("keeps the focused route and fitBounds static for %s", (mode) => {
    state[mode] = true;
    const map = fakeMap();
    useDamPathLayer(map as unknown as LibreMap, paths[0], 100, false, state.reducedMotion, state.lite);
    runEffects();
    expect(map.layers.has("dam-path-flow")).toBe(true);
    expect(map.layers.has("dam-path-arrows")).toBe(true);
    expect(map.fitBounds).toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("uses the same missing-report semantics on the focused route without losing its framing", () => {
    const map = fakeMap();
    useDamPathLayer(map as unknown as LibreMap, paths[0], null, false, false, false);
    runEffects();
    expect(map.layers.get("dam-path")).toMatchObject({ paint: {
      "line-color": "#64748b", "line-width": 1, "line-dasharray": [0.5, 2],
    } });
    expect(map.layers.has("dam-path-casing")).toBe(true);
    expect(map.fitBounds).toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });
});
