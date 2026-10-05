import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LayerSpecification, StyleSpecification } from "maplibre-gl";
import ofmDark from "@/lib/map/fixture-ofm-dark.json";
import ofmLight from "@/lib/map/fixture-ofm-positron.json";
import { STYLE_URLS } from "@/lib/map/base-style";
import { HILLSHADE_LAYER, HILLSHADE_SOURCE, TERRAIN_SOURCE } from "@/lib/map/terrain";
import { loadBaseStyle } from "@/components/map/use-base-style";
import { RainMap, type RainMapProps } from "./rain-map";

const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[],
  map: null as unknown,
  provider: vi.fn(), marker: vi.fn(), markerRemove: vi.fn(),
}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect),
}));
vi.mock("@/components/map/map-provider", () => ({
  MapProvider: (props: { children: React.ReactNode }) => { harness.provider(props); return props.children; },
  useMapContext: () => ({ map: harness.map, status: "ready" }),
}));
vi.mock("maplibre-gl", () => ({ Marker: class {
  setLngLat(position: number[]) { harness.marker(position); return this; }
  addTo() { return this; }
  remove = harness.markerRemove;
} }));
vi.mock("@/i18n/client", () => ({ useT: () => (key: string) => key }));

let style: StyleSpecification;
let terrain: { source: string; exaggeration: number } | null;
let map: ReturnType<typeof mockMap>;
let cleanups: (() => void)[];
const props: RainMapProps = {
  place: { lat: 51.5, lon: -0.1 }, tier: "full", activeIndex: 0,
  radar: { frames: [{ time: "2026-10-05T00:00:00Z", tileUrl: "https://example.com/{z}/{x}/{y}.png" }], maxZoom: 7 } as RainMapProps["radar"],
  stations: [{ id: "station", lat: 13.7, lon: 100.5, rainMm: 40, nameTh: "สถานี", nameEn: "Station" }] as RainMapProps["stations"],
  onReady: vi.fn(), onTier: vi.fn(),
};
function mockMap() {
  return {
    getStyle: () => style,
    getSource: (id: string) => style.sources[id],
    addSource: vi.fn((id: string, source: StyleSpecification["sources"][string]) => { style.sources[id] = source; }),
    removeSource: vi.fn((id: string) => { delete style.sources[id]; }),
    getLayer: (id: string) => style.layers.find((layer) => layer.id === id),
    addLayer: vi.fn((layer: LayerSpecification, before?: string) => {
      const index = style.layers.findIndex((item) => item.id === before);
      style.layers.splice(index < 0 ? style.layers.length : index, 0, layer);
    }),
    removeLayer: vi.fn((id: string) => { style.layers = style.layers.filter((layer) => layer.id !== id); }),
    getTerrain: () => terrain,
    setTerrain: vi.fn((next: typeof terrain) => { terrain = next; }),
    getPaintProperty: (id: string, key: string) => (map.getLayer(id)?.paint as Record<string, unknown> | undefined)?.[key],
    setPaintProperty: vi.fn((id: string, key: string, value: unknown) => {
      (map.getLayer(id)!.paint as Record<string, unknown>)[key] = value;
    }),
    getBearing: () => 0, easeTo: vi.fn(), jumpTo: vi.fn(), setPixelRatio: vi.fn(),
    getCanvas: () => new EventTarget(), on: vi.fn(), off: vi.fn(), isMoving: () => false,
  };
}
beforeEach(() => {
  vi.clearAllMocks(); harness.effects = []; cleanups = []; terrain = null;
  style = structuredClone(ofmDark) as StyleSpecification;
  map = mockMap(); harness.map = map;
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal("document", { createElement: () => ({
    className: "", style: { setProperty: vi.fn() }, classList: { add: vi.fn() },
    appendChild: vi.fn(), setAttribute: vi.fn(), getAttribute: () => "station",
  }) });
});
afterEach(() => { cleanups.reverse().forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); });

it("keeps the viewport absolute despite MapLibre CSS and starts over Thailand even for an overseas place", () => {
  const html = renderToStaticMarkup(<RainMap {...props} />);
  expect(html).toContain('class="absolute inset-0" style="position:absolute"');
  expect(harness.provider.mock.calls[0][0]).toMatchObject({ initialCenter: [101.5, 13], initialZoom: 4 });
  for (const effect of harness.effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  expect(map.jumpTo).toHaveBeenCalledWith({ center: [100.9, 12.6], zoom: 4.6, pitch: 55, bearing: 0 });
  expect(map.setPixelRatio).toHaveBeenCalledWith(1.5);
  expect(terrain).toEqual({ source: TERRAIN_SOURCE, exaggeration: 1.3 });
  expect(map.getLayer(HILLSHADE_LAYER)).toMatchObject({ source: HILLSHADE_SOURCE });
  expect(HILLSHADE_SOURCE).not.toBe(TERRAIN_SOURCE);
  expect(map.getSource(HILLSHADE_SOURCE)).toEqual(map.getSource(TERRAIN_SOURCE));
  expect(map.getLayer("rain-radar-0")).toMatchObject({ type: "raster", paint: { "raster-opacity": 0.7 } });
  expect(style.layers.findIndex((layer) => layer.id === "rain-radar-0")).toBeLessThan(style.layers.findIndex((layer) => layer.type === "symbol"));
  expect(harness.marker).toHaveBeenCalledWith([100.5, 13.7]);
  cleanups.reverse().forEach((cleanup) => cleanup()); cleanups = [];
  expect(terrain).toBeNull();
  expect(map.getSource(TERRAIN_SOURCE)).toBeUndefined();
  expect(map.getSource(HILLSHADE_SOURCE)).toBeUndefined();
  expect(harness.markerRemove).toHaveBeenCalledOnce();
});

it.each(["dark", "light"] as const)("loads the shared /map %s style with vector basemap layers", async (theme) => {
  vi.stubGlobal("window", { setTimeout, clearTimeout });
  const fetchStyle = vi.fn().mockResolvedValue({ ok: true, json: async () => theme === "dark" ? ofmDark : ofmLight });
  vi.stubGlobal("fetch", fetchStyle);
  const loaded = await loadBaseStyle(theme);
  expect(fetchStyle).toHaveBeenCalledWith(STYLE_URLS[theme], expect.any(Object));
  expect(Object.values(loaded.sources).some((source) => source.type === "vector")).toBe(true);
  expect(loaded.layers).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "water", type: "fill" }),
    expect.objectContaining({ type: "line", source: "openmaptiles" }),
    expect.objectContaining({ type: "symbol", source: "openmaptiles" }),
  ]));
});
