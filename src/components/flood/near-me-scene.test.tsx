import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AmbientLight, CircleGeometry, Color, Fog, HemisphereLight, Mesh, MeshStandardMaterial, Points, RingGeometry, Sprite } from "three";
import type { SceneHost, ViewOptions } from "@/lib/three/scene-host";
import type { GlTier } from "@/lib/three/gl-tier";
import { NearMe3D, nearMeVisuals, type NearMeProps } from "./near-me-3d";
import * as sceneModule from "./near-me-scene";
import * as terrainModule from "@/lib/terrain/terrarium";

const hooks = vi.hoisted(() => ({
  root: { current: null as unknown }, cursor: 0,
  memos: [] as { deps: readonly unknown[]; value: unknown }[],
  deps: undefined as readonly unknown[] | undefined,
  effect: undefined as (() => void | (() => void)) | undefined,
  clean: undefined as (() => void) | undefined,
  getHost: vi.fn(),
  controls: [] as { maxDistance: number }[],
  background: "#F7FBFF", themeChanged: undefined as (() => void) | undefined, disconnectTheme: vi.fn(),
}));
const changed = (old: readonly unknown[] | undefined, next: readonly unknown[]) => !old || next.some((value, i) => !Object.is(value, old[i]));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useId: () => "near-me-test",
  useRef: () => hooks.root,
  useMemo: (factory: () => unknown, deps: readonly unknown[]) => {
    const index = hooks.cursor++;
    if (changed(hooks.memos[index]?.deps, deps)) hooks.memos[index] = { deps, value: factory() };
    return hooks.memos[index].value;
  },
  useEffect: (effect: () => void | (() => void), deps: readonly unknown[]) => {
    if (changed(hooks.deps, deps)) { hooks.deps = deps; hooks.effect = effect; }
  },
}));
vi.mock("@/hooks/use-lite", () => ({ useLite: () => ({ lite: false, reducedMotion: false }) }));
vi.mock("@/i18n/client", () => ({ useT: () => (key: string) => key }));
vi.mock("@/lib/three/scene-host", () => ({ getSceneHost: hooks.getHost }));
vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({ OrbitControls: class {
  maxDistance = Infinity;
  constructor() { hooks.controls.push(this); }
  update = vi.fn(); addEventListener = vi.fn(); removeEventListener = vi.fn(); dispose = vi.fn();
} }));

const props: NearMeProps = { place: { lat: 13.7, lon: 100.5 }, date: "2026-10-05",
  counts: { flood: 7, recurringFlood: 2, dry: 10, water: 0, insufficientData: 350, noData: 6, sampled: 375 },
  samples: [{ lat: 13.71, lon: 100.52, kind: "flood" }], villages: [], station: null, dam: null,
  summaries: ["Satellite 9 points", "Villages", "Rain", "Dam"] };
let attributes: Map<string, string>;
let fallback: { style: { visibility: string } };
let label: { hidden: boolean };
let element: HTMLElement;
let host: { tier: GlTier; markDirty: ReturnType<typeof vi.fn>; setAnimating: ReturnType<typeof vi.fn>; registerView: ReturnType<typeof vi.fn> };
let options: ViewOptions | undefined;
let unregister: ReturnType<typeof vi.fn>;
let clean: (() => void) | undefined;
const state = () => JSON.parse(attributes.get("data-scene-state")!);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => {
  attributes = new Map(); fallback = { style: { visibility: "" } }; label = { hidden: true };
  element = { style: {}, dataset: {}, querySelector: (selector: string) => selector.includes("enable-tilt") ? null : selector.includes("fallback") ? fallback : label,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name) } as unknown as HTMLElement;
  options = undefined; unregister = vi.fn(); hooks.controls = [];
  hooks.background = "#F7FBFF"; hooks.themeChanged = undefined; hooks.disconnectTheme.mockReset();
  host = { tier: "full", markDirty: vi.fn(), setAnimating: vi.fn(), registerView: vi.fn((_element, view: ViewOptions) => {
    options = view; view.onTierChange?.(host.tier); return unregister;
  }) };
  hooks.root.current = element; hooks.cursor = 0; hooks.memos = []; hooks.deps = undefined;
  hooks.effect = undefined; hooks.clean = undefined; hooks.getHost.mockReset().mockResolvedValue(host);
  const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(),
    drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([128, 10, 0, 255]) }) };
  vi.stubGlobal("document", { documentElement: {}, createElement: () => ({ getContext: () => ctx }) });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => hooks.background }));
  vi.stubGlobal("MutationObserver", class {
    constructor(callback: () => void) { hooks.themeChanged = callback; }
    observe = vi.fn(); disconnect = hooks.disconnectTheme;
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Terrarium offline")));
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1, height: 1, close: vi.fn() }));
});
afterEach(() => { clean?.(); clean = undefined; hooks.clean?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function render(next = props) {
  hooks.cursor = 0;
  NearMe3D(next);
  if (hooks.effect) {
    hooks.clean?.(); hooks.clean = hooks.effect() || undefined; hooks.effect = undefined;
  }
}
function attach() { clean = sceneModule.attachNearMe(host as unknown as SceneHost, element, props, nearMeVisuals(props)); }

it("does not reattach or cancel pending terrain when the caller recreates the same data", async () => {
  let resolve!: (value: { ok: boolean; blob: () => Promise<Blob> }) => void;
  const pending = new Promise<{ ok: boolean; blob: () => Promise<Blob> }>((done) => { resolve = done; });
  vi.mocked(fetch).mockReturnValue(pending as Promise<Response>);
  const attachSpy = vi.spyOn(sceneModule, "attachNearMe");
  render(); await vi.waitFor(() => expect(attachSpy).toHaveBeenCalledOnce());
  const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
  for (let i = 0; i < 5; i++) { render(JSON.parse(JSON.stringify(props))); await flush(); }
  expect(attachSpy).toHaveBeenCalledOnce();
  expect(signal.aborted).toBe(false);
  resolve({ ok: true, blob: async () => new Blob() }); await flush();
  expect(host.registerView).toHaveBeenCalledOnce();
  expect(state()).toMatchObject({ mode: "full", terrain: true, flood: 9, insufficient: 356 });
  render(JSON.parse(JSON.stringify(props))); await flush();
  expect(attachSpy).toHaveBeenCalledOnce();
  render({ ...props, date: "2026-10-06" }); await flush();
  expect(attachSpy).toHaveBeenCalledTimes(2);
  expect(unregister).toHaveBeenCalledOnce();
});

it.each(["full", "reduced"] as const)("uses flat 3D after DEM failure and reports tier changes (initial %s)", async (tier) => {
  host.tier = tier; attach();
  expect(state()).toMatchObject({ mode: "svg", terrain: false });
  await flush();
  expect(host.registerView).toHaveBeenCalledOnce();
  expect(state()).toMatchObject({ mode: tier, terrain: false, flood: 9 });
  expect(fallback.style.visibility).toBe("hidden");
  expect(label.hidden).toBe(true);
  expect(attributes.get("aria-label")).toBe(props.summaries.join(" · "));
  const ground = options!.scene.children.find((child): child is Mesh => child instanceof Mesh)!;
  const positions = ground.geometry.getAttribute("position");
  expect(Array.from({ length: positions.count }, (_, i) => positions.getY(i)).every((y) => y === 0)).toBe(true);
  host.tier = "reduced"; options!.onTierChange!(host.tier);
  expect(state()).toMatchObject({ mode: "reduced", terrain: false });
  host.tier = "svg"; options!.onTierChange!(host.tier);
  expect(state()).toMatchObject({ mode: "svg", terrain: false });
  expect(fallback.style.visibility).toBe("");
  clean!(); clean = undefined;
  expect(unregister).toHaveBeenCalledOnce();
  expect(state()).toMatchObject({ mode: "svg", terrain: false });
});

it("reports measured terrain and hides its label when the tier switches to SVG", async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, blob: async () => new Blob() } as Response);
  attach(); await flush();
  expect(state()).toMatchObject({ mode: "full", terrain: true });
  expect(label.hidden).toBe(false);
  host.tier = "reduced"; options!.onTierChange!(host.tier);
  expect(state()).toMatchObject({ mode: "reduced", terrain: true });
  host.tier = "svg"; options!.onTierChange!(host.tier);
  expect(state()).toMatchObject({ mode: "svg", terrain: true });
  expect(label.hidden).toBe(true);
});

it("does not register an aborted scene after unmount", async () => {
  attach(); clean!(); clean = undefined; await flush();
  expect(host.registerView).not.toHaveBeenCalled();
  expect(state()).toMatchObject({ mode: "svg", terrain: false });
});

it("keeps the camera inside fog near throughout the allowed zoom range", async () => {
  attach(); await flush();
  const fog = options!.scene.fog;
  expect(fog).toBeInstanceOf(Fog);
  expect(options!.camera.position.length()).toBeLessThan((fog as Fog).near);
  expect(hooks.controls[0].maxDistance).toBeLessThan((fog as Fog).near);
  expect((fog as Fog).far).toBeGreaterThan((fog as Fog).near);
  expect(options!.scene.children.find((child) => child instanceof AmbientLight)).toMatchObject({ intensity: 0.4 });
  expect(options!.scene.children.find((child) => child instanceof HemisphereLight)).toMatchObject({ intensity: 0.8 });
});

it.each([0, 1800])("colours local relief independently of absolute elevation %s and fades only terrain at the rim", async (offset) => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, blob: async () => new Blob() } as Response);
  vi.spyOn(terrainModule, "terrainElevation").mockImplementation((_tiles, point) => offset + (point.lon - props.place.lon) * 3000);
  const next: NearMeProps = { ...props, villages: [{ id: "village", lat: 13.71, lon: 100.51, level: 2, village: "", tambon: "", amphoe: "", province: "" }],
    station: { ...props.place, rainMm: 50 }, dam: { ...props.place, releaseCms: 500 } };
  clean = sceneModule.attachNearMe(host as unknown as SceneHost, element, next, nearMeVisuals(next)); await flush();
  expect(state().terrain).toBe(true);
  const ground = options!.scene.children.find((child): child is Mesh => child instanceof Mesh)!;
  const positions = ground.geometry.getAttribute("position"), colours = ground.geometry.getAttribute("color");
  expect(ground.material).toBeInstanceOf(MeshStandardMaterial);
  expect(ground.material).toMatchObject({ vertexColors: true, transparent: true, depthWrite: false });
  expect(ground.renderOrder).toBeLessThan(0);
  expect(colours.itemSize).toBe(4);
  const green = new Color("#7fa36b"), dark = new Color("#294d3d"), high = new Color("#746b60");
  const heights = Array.from({ length: positions.count }, (_, i) => i)
    .filter((i) => Math.hypot(positions.getX(i), positions.getZ(i)) <= 30).map((i) => positions.getY(i));
  const min = Math.min(...heights), max = Math.max(...heights);
  let sawGreen = false, sawHigh = false, sawFade = false;
  for (const i of new Set(ground.geometry.index!.array)) {
    const radius = Math.hypot(positions.getX(i), positions.getZ(i));
    const relative = (positions.getY(i) - min) / (max - min);
    if (radius <= 25) expect(colours.getW(i)).toBe(1);
    if (radius >= 29) expect(colours.getW(i)).toBe(0);
    if (radius > 25 && radius < 29) { expect(colours.getW(i)).toBeGreaterThan(0); expect(colours.getW(i)).toBeLessThan(1); sawFade = true; }
    const expected = relative <= 0.65 ? green.clone().lerp(dark, relative / 0.65)
      : dark.clone().lerp(high, (relative - 0.65) / 0.35);
    expect(colours.getX(i)).toBeCloseTo(expected.r); expect(colours.getY(i)).toBeCloseTo(expected.g); expect(colours.getZ(i)).toBeCloseTo(expected.b);
    if (relative === 0) {
      expect(0.2126 * colours.getX(i) + 0.7152 * colours.getY(i) + 0.0722 * colours.getZ(i)).toBeLessThan(0.6);
      sawGreen = true;
    }
    if (relative === 1) sawHigh = true;
  }
  expect(sawGreen && sawHigh && sawFade).toBe(true);
  for (const child of options!.scene.children) {
    if ("material" in child && child !== ground) expect(child.material).toMatchObject({ fog: false });
    if (child instanceof Sprite) expect(child.scale.toArray()).toEqual([4, 4, 1]);
    if (child instanceof Points) expect(child.material).toMatchObject({ size: 0.35 });
    if (child instanceof Mesh && child.geometry instanceof CircleGeometry) expect(child.geometry.parameters.radius).toBe(0.9);
  }
  const edge = options!.scene.children.find((child): child is Mesh => child instanceof Mesh && child.geometry.type === "RingGeometry")!;
  expect(edge.geometry).toBeInstanceOf(RingGeometry);
  expect((edge.geometry as RingGeometry).parameters).toMatchObject({ innerRadius: 29.6, outerRadius: 30 });
  expect(edge.material).toMatchObject({ opacity: 0.15, toneMapped: false });
});

it.each([0, 10, 19.9])("keeps relief of %s metres uniformly green without amplifying off-disc heights", async (range) => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, blob: async () => new Blob() } as Response);
  vi.spyOn(terrainModule, "terrainElevation").mockImplementation((_tiles, point) => {
    const { x, z } = terrainModule.terrainPosition(props.place, point);
    return Math.hypot(x, z) > 30.01 ? 2000 : 5 + x / 60 * range;
  });
  attach(); await flush();
  expect(state().terrain).toBe(true);
  const ground = options!.scene.children.find((child): child is Mesh => child instanceof Mesh)!;
  const colours = ground.geometry.getAttribute("color"), green = new Color("#7fa36b");
  for (const i of new Set(ground.geometry.index!.array)) {
    expect(colours.getX(i)).toBeCloseTo(green.r, 5);
    expect(colours.getY(i)).toBeCloseTo(green.g, 5);
    expect(colours.getZ(i)).toBeCloseTo(green.b, 5);
  }
});

it.each(["#F7FBFF", "#1F2740"])("uses theme background %s at the rim and outlined cloud dots in reduced mode", async (background) => {
  hooks.background = background; host.tier = "reduced";
  const next = { ...props, samples: [{ ...props.place, kind: "insufficient-data" as const }] };
  clean = sceneModule.attachNearMe(host as unknown as SceneHost, element, next, nearMeVisuals(next)); await flush();
  const scene = options!.scene;
  const edge = scene.children.find((child): child is Mesh => child instanceof Mesh && child.geometry instanceof RingGeometry)!;
  expect((scene.fog as Fog).color).toEqual(new Color(background));
  expect(edge.material).toMatchObject({ color: new Color(background), toneMapped: false });
  const dots = scene.children.filter((child): child is Mesh => child instanceof Mesh && child.geometry instanceof CircleGeometry);
  expect(dots).toHaveLength(2);
  expect(dots[0].material).toMatchObject({ color: new Color("#334155"), opacity: 0.85, toneMapped: false });
  expect(dots[1].material).toMatchObject({ color: new Color("#e2e8f0"), opacity: 0.85, toneMapped: false });
  expect(dots[0].scale.x).toBeGreaterThan(dots[1].scale.x);
  expect(dots[0].position.y).toBeLessThan(dots[1].position.y);
  hooks.background = "#1B1F33"; host.markDirty.mockClear(); hooks.themeChanged!();
  expect((scene.fog as Fog).color).toEqual(new Color(hooks.background));
  expect(edge.material).toMatchObject({ color: new Color(hooks.background) });
  expect(host.markDirty).toHaveBeenCalledWith(element);
  clean!(); clean = undefined;
  expect(hooks.disconnectTheme).toHaveBeenCalledOnce();
});
