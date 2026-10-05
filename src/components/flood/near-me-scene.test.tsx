import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Mesh } from "three";
import type { SceneHost, ViewOptions } from "@/lib/three/scene-host";
import type { GlTier } from "@/lib/three/gl-tier";
import { NearMe3D, nearMeVisuals, type NearMeProps } from "./near-me-3d";
import * as sceneModule from "./near-me-scene";

const hooks = vi.hoisted(() => ({
  root: { current: null as unknown }, cursor: 0,
  memos: [] as { deps: readonly unknown[]; value: unknown }[],
  deps: undefined as readonly unknown[] | undefined,
  effect: undefined as (() => void | (() => void)) | undefined,
  clean: undefined as (() => void) | undefined,
  getHost: vi.fn(),
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
  element = { style: {}, querySelector: (selector: string) => selector.includes("fallback") ? fallback : label,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name) } as unknown as HTMLElement;
  options = undefined; unregister = vi.fn();
  host = { tier: "full", markDirty: vi.fn(), setAnimating: vi.fn(), registerView: vi.fn((_element, view: ViewOptions) => {
    options = view; view.onTierChange?.(host.tier); return unregister;
  }) };
  hooks.root.current = element; hooks.cursor = 0; hooks.memos = []; hooks.deps = undefined;
  hooks.effect = undefined; hooks.clean = undefined; hooks.getHost.mockReset().mockResolvedValue(host);
  const ctx = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(), fillRect: vi.fn(),
    drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([128, 10, 0, 255]) }) };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx }) });
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
