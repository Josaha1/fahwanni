import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Points, LineSegments, Vector3, type Scene } from "three";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { Dam3D } from "./dam-3d";

const harness = vi.hoisted(() => ({
  effects: [] as (() => void | (() => void))[], refs: [] as { current: unknown }[], cursor: 0,
  rendererString: "hardware", model: null as unknown, scene: null as unknown, controls: null as unknown,
  environments: [] as { texture: unknown; dispose: ReturnType<typeof vi.fn> }[],
  render: vi.fn(), dispose: vi.fn(), dpr: vi.fn(), controlsDispose: vi.fn(),
}));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => harness.effects.push(effect),
  useRef: (initial: unknown) => harness.refs[harness.cursor++] ??= { current: initial },
}));
vi.mock("@/i18n/client", () => ({ useT: () => (key: string) => key }));
vi.mock("three", async (original) => ({ ...await original<typeof import("three")>(),
  PMREMGenerator: class {
    fromScene() {
      const target = { texture: {}, dispose: vi.fn() };
      harness.environments.push(target);
      return target;
    }
    dispose = vi.fn();
  },
  WebGLRenderer: class {
    setPixelRatio = harness.dpr;
    setSize = vi.fn();
    dispose = harness.dispose;
    render = (scene: Scene) => { harness.scene = scene; harness.render(); };
    getContext = () => ({
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0 }), getParameter: () => harness.rendererString,
    });
  },
}));
vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({ GLTFLoader: class {
  loadAsync = async () => ({ scene: harness.model });
} }));
vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({ OrbitControls: class {
  target = new Vector3();
  enablePan = true;
  minPolarAngle = 0;
  maxPolarAngle = Math.PI;
  update = vi.fn();
  addEventListener = vi.fn();
  dispose = harness.controlsDispose;
  constructor() { harness.controls = this; }
} }));

const dam = { ...parseRidDams(fixture).dams[0], date: "2026-10-05", storagePct: 25, releaseCms: 500, inflowCms: 250 };
const history = { dataDate: dam.date, lastYear: { date: "2025-10-05", pct: { [dam.id]: 50 } }, year2554: { date: "2011-10-05", pct: { [dam.id]: 100 } } };
let canvas: EventTarget & { style: Record<string, string>; getBoundingClientRect: () => { width: number; height: number } };
let frames: Map<number, FrameRequestCallback>;
let clock: number;
let clean: (() => void) | undefined;
let props: React.ComponentProps<typeof Dam3D>;

beforeEach(() => {
  vi.clearAllMocks();
  harness.environments = [];
  harness.effects = []; harness.refs = []; harness.cursor = 0;
  harness.rendererString = "hardware"; harness.scene = null; harness.controls = null;
  frames = new Map(); clock = 0;
  canvas = Object.assign(new EventTarget(), { style: {}, getBoundingClientRect: () => ({ width: 480, height: 320 }) });
  const doc = Object.assign(new EventTarget(), { hidden: false, documentElement: { dataset: { theme: "light" } } });
  class Observer { observe() {} disconnect() {} }
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", { devicePixelRatio: 3, location: { search: "" } });
  vi.stubGlobal("navigator", { deviceMemory: 8 });
  vi.stubGlobal("MutationObserver", Observer);
  vi.stubGlobal("ResizeObserver", Observer);
  vi.stubGlobal("IntersectionObserver", Observer);
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("terrain offline")));
  const model = new Group();
  for (const name of ["Basin", "Wall", "Spillway", "WaterUp", "WaterDown", "RimLastYear", "Rim2554"]) {
    const geometry = name === "WaterUp" ? new PlaneGeometry(1, 4).rotateX(-Math.PI / 2) : new BoxGeometry(4, 2, 5);
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    mesh.name = name;
    if (name === "WaterUp") mesh.userData = { levelHeight: 2, widthAt0: 0, widthAt1: 4 };
    model.add(mesh);
  }
  harness.model = model;
  props = { dam, history, theme: "light", reducedMotion: false, detail: true, summary: "tank",
    onFallback: vi.fn(), onTierChange: vi.fn(), onTerrainLoaded: vi.fn() };
});
afterEach(() => { clean?.(); clean = undefined; vi.unstubAllGlobals(); });

async function mount() {
  Dam3D(props);
  harness.refs[0].current = canvas;
  harness.effects[0]();
  clean = harness.effects[1]() || undefined;
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
}
function advance(count = 1, interval = 16) {
  for (let i = 0; i < count && frames.size; i++) {
    const callbacks = [...frames.values()]; frames.clear(); clock += interval;
    callbacks.forEach((callback) => callback(clock));
  }
}
function update(next: Partial<typeof props>) {
  props = { ...props, ...next };
  harness.cursor = 0; harness.effects = [];
  Dam3D(props); harness.effects[0]();
}
const model = () => harness.model as Group;
const streams = () => model().children.filter((object): object is Points => object instanceof Points);

it("extends the model with ghost planes, orbit pitch limits, and proportional particles; terrain failure stays optional", async () => {
  await mount(); advance();
  expect(props.onFallback).not.toHaveBeenCalled();
  expect(props.onTierChange).toHaveBeenLastCalledWith("full");
  expect(harness.dpr).toHaveBeenLastCalledWith(1.5);
  expect(harness.controls).toMatchObject({ enablePan: false, minPolarAngle: 15 * Math.PI / 180, maxPolarAngle: 70 * Math.PI / 180 });
  expect(canvas.style.touchAction).toBe("pan-y");
  const crest = model().children.find((object) => object instanceof LineSegments)!;
  expect(crest.position.y).toBe(2);
  expect(crest.scale.x).toBe(4);
  expect(streams().map((stream) => stream.geometry.drawRange.count)).toEqual([48, 24]);
  const ghosts = model().children.filter((object) => object instanceof Mesh && !object.name) as Mesh[];
  expect(ghosts.map((ghost) => ghost.position.y)).toEqual([Math.sqrt(0.5) * 2, 2]);
  expect(ghosts.map((ghost) => (ghost.material as MeshStandardMaterial).opacity)).toEqual([0.2, 0.2]);
  expect(props.onTerrainLoaded).not.toHaveBeenCalled();
});

it("tweens the selected day's water and hides ghosts whose report day does not match", async () => {
  await mount(); advance();
  const water = model().getObjectByName("WaterUp")!;
  expect(water.position.y).toBe(1);
  update({ dam: { ...dam, date: "2026-10-04", storagePct: 100, releaseCms: 0, inflowCms: 0 } });
  expect(water.position.y).toBe(1);
  advance();
  expect(water.position.y).toBeGreaterThan(1);
  expect(water.position.y).toBeLessThan(2);
  advance(100);
  expect(water.position.y).toBe(2);
  expect(frames.size).toBe(0);
  expect(streams().every((stream) => !stream.visible)).toBe(true);
  expect(model().children.filter((object) => object instanceof Mesh && !object.name).every((ghost) => !ghost.visible)).toBe(true);
});

it("uses reduced DPR and no particle loop on a small-memory device", async () => {
  vi.stubGlobal("navigator", { deviceMemory: 4 });
  await mount(); advance();
  expect(props.onTierChange).toHaveBeenLastCalledWith("reduced");
  expect(harness.dpr).toHaveBeenLastCalledWith(1);
  expect(streams().map((stream) => stream.geometry.drawRange.count)).toEqual([0, 0]);
  expect(frames.size).toBe(0);
  update({ dam: { ...dam, storagePct: 100 } }); advance();
  expect(model().getObjectByName("WaterUp")!.position.y).toBe(2);
  expect(frames.size).toBe(0);
});

it("steps down after sustained slow frames and resumes after the first context loss", async () => {
  await mount(); advance(35, 40);
  expect(props.onTierChange).toHaveBeenLastCalledWith("reduced");
  expect(streams().every((stream) => !stream.visible)).toBe(true);
  expect(frames.size).toBe(0);
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(props.onFallback).not.toHaveBeenCalled();
  expect(canvas.style.visibility).toBe("hidden");
  canvas.dispatchEvent(new Event("webglcontextrestored")); advance();
  expect(canvas.style.visibility).toBe("");
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(props.onFallback).toHaveBeenCalledOnce();
});

it("falls back for software GL unless gl=force, which still respects reduced motion", async () => {
  harness.rendererString = "SwiftShader";
  await mount();
  expect(props.onFallback).toHaveBeenCalledOnce();
  expect(harness.dispose).toHaveBeenCalledOnce();
});
it("allows gl=force to exercise software GL", async () => {
  harness.rendererString = "SwiftShader";
  vi.stubGlobal("window", { devicePixelRatio: 1, location: { search: "?gl=force" } });
  await mount(); advance();
  expect(props.onFallback).not.toHaveBeenCalled();
  expect(props.onTierChange).toHaveBeenLastCalledWith("full");
});
it("retains reduced-motion fallback with gl=force", async () => {
  props.reducedMotion = true;
  vi.stubGlobal("window", { devicePixelRatio: 1, location: { search: "?gl=force" } });
  await mount();
  expect(props.onFallback).toHaveBeenCalledOnce();
});

it("adds decoded terrain when available and disposes terrain, streams and controls on unmount", async () => {
  const pixels = new Uint8ClampedArray([128, 0, 0, 255, 128, 100, 0, 255, 128, 0, 0, 255, 128, 100, 0, 255]);
  const close = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() }));
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 2, height: 2, close }));
  Object.assign(document, { createElement: () => ({ width: 0, height: 0,
    getContext: () => ({ drawImage: vi.fn(), getImageData: () => ({ data: pixels }) }) }) });
  await mount(); await Promise.resolve(); await Promise.resolve(); advance();
  expect(props.onTerrainLoaded).toHaveBeenCalledOnce();
  expect(props.onFallback).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  const scene = harness.scene as Scene;
  const terrain = scene.children.find((object): object is Mesh => object instanceof Mesh)!;
  expect(terrain.geometry.getAttribute("position").count).toBe(33 * 33);
  expect(terrain.geometry.index!.count).toBeGreaterThan(0);
  const terrainDispose = vi.spyOn(terrain.geometry, "dispose");
  const streamDispose = streams().map((stream) => vi.spyOn(stream.geometry, "dispose"));
  clean?.(); clean = undefined;
  expect(terrainDispose).toHaveBeenCalledOnce();
  streamDispose.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  expect(harness.controlsDispose).toHaveBeenCalledOnce();
  expect(harness.dispose).toHaveBeenCalledOnce();
  expect(frames.size).toBe(0);
});

it("sets the environment once, regenerates after restore and releases it on unmount", async () => {
  await mount(); advance();
  expect(harness.environments).toHaveLength(1);
  const scene = harness.scene as Scene;
  const first = harness.environments[0];
  expect(scene.environment).toBe(first.texture);
  update({ theme: "dark" }); advance();
  expect(harness.environments).toHaveLength(1);
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(first.dispose).toHaveBeenCalledOnce();
  expect(scene.environment).toBeNull();
  canvas.dispatchEvent(new Event("webglcontextrestored")); advance();
  expect(harness.environments).toHaveLength(2);
  const second = harness.environments[1];
  expect(scene.environment).toBe(second.texture);
  clean?.(); clean = undefined;
  expect(second.dispose).toHaveBeenCalledOnce();
  expect(scene.environment).toBeNull();
});
