import { expect, it, vi } from "vitest";
import { InstancedMesh, Mesh, PerspectiveCamera, Vector3, LineSegments } from "three";
import type { SceneHost, ViewOptions } from "@/lib/three/scene-host";
import { attachThMap, provinceGeometry } from "./th-map-scene";
import type { ThMapData } from "./th-map-data";

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({ OrbitControls: class {
  target = new Vector3();
  constructor(private camera: PerspectiveCamera) {}
  update() { this.camera.lookAt(this.target); }
  addEventListener = vi.fn(); removeEventListener = vi.fn(); dispose = vi.fn();
} }));
function fixture() {
  const listeners = new Map<string, (event: PointerEvent) => void>();
  const fallback = { style: { opacity: "", pointerEvents: "" } };
  const attrs = new Map<string, string>();
  const element = { style: {}, querySelector: () => fallback,
    addEventListener: (name: string, handler: (event: PointerEvent) => void) => listeners.set(name, handler),
    removeEventListener: (name: string) => listeners.delete(name),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 330, bottom: 360, width: 330, height: 360 }),
    setAttribute: (key: string, value: string) => attrs.set(key, value),
  } as unknown as HTMLElement;
  let options!: ViewOptions;
  const unregister = vi.fn();
  const host = { tier: "full", markDirty: vi.fn(), setAnimating: vi.fn(),
    registerView: vi.fn((_el: HTMLElement, view: ViewOptions) => { options = view; view.onTierChange!("full"); return unregister; }),
  };
  const onSelect = vi.fn();
  const data: ThMapData = { counts: null, samples: [{ lat: 13.7, lon: 100.5, kind: "flood" }], affected: ["bangkok"], warnedRegions: ["central"] };
  const cleanup = attachThMap(host as unknown as SceneHost, element, data, onSelect);
  const send = (name: string, x: number, y: number, id = 1) => listeners.get(name)!({ type: name, pointerId: id, clientX: x, clientY: y } as PointerEvent);
  return { host, options, fallback, listeners, cleanup, send, onSelect, unregister, attrs };
}
it("reports counts, displays instanced points and only pulses warnings in full tier", () => {
  const f = fixture();
  expect(f.options.state).toEqual({ provinces: 77, points: 1, warnedRegions: ["central"] });
  const dots = f.options.scene.children.find((child) => child instanceof InstancedMesh) as InstancedMesh;
  expect(dots.count).toBe(1);
  expect(f.fallback.style.opacity).toBe("0");
  expect(f.host.setAnimating).toHaveBeenLastCalledWith(expect.anything(), true);
  f.options.onTierChange!("reduced");
  expect(f.host.setAnimating).toHaveBeenLastCalledWith(expect.anything(), false);
  const lines = f.options.scene.children.filter((child) => child instanceof LineSegments) as LineSegments[];
  const warning = lines.at(-1)!;
  const material = warning.material as { opacity: number };
  const opacity = material.opacity;
  f.options.onFrame!({ time: 999, deltaMs: 16, width: 330, height: 360, tier: "reduced" });
  expect(material.opacity).toBe(opacity);
  f.options.onTierChange!("svg");
  expect(f.fallback.style.opacity).toBe("");
  f.cleanup();
  expect(f.unregister).toHaveBeenCalledOnce(); expect(f.listeners.size).toBe(0);
  expect(JSON.parse(f.attrs.get("data-scene-state")!)).toMatchObject({ mode: "svg", provinces: 77 });
});
it("raycasts a tap to its province, suppresses drag and pinch selections", () => {
  const f = fixture();
  const bangkok = f.options.scene.children.find((child) => child instanceof Mesh && child.userData.province === "bangkok") as Mesh;
  const position = bangkok.geometry.getAttribute("position"), normal = bangkok.geometry.getAttribute("normal");
  let point = new Vector3();
  for (let i = 0; i < position.count; i += 3) {
    if (normal.getZ(i) < 0.9) continue;
    point = new Vector3().fromBufferAttribute(position, i).add(new Vector3().fromBufferAttribute(position, i + 1)).add(new Vector3().fromBufferAttribute(position, i + 2)).divideScalar(3);
    break;
  }
  const camera = f.options.camera as PerspectiveCamera; camera.aspect = 330 / 360; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const ndc = point.project(camera), x = (ndc.x + 1) / 2 * 330, y = (1 - ndc.y) / 2 * 360;
  f.send("pointerdown", x, y); f.send("pointerup", x, y);
  expect(f.onSelect).toHaveBeenCalledWith("bangkok"); f.onSelect.mockClear();
  f.send("pointerdown", x, y); f.send("pointermove", x + 10, y); f.send("pointerup", x, y);
  expect(f.onSelect).not.toHaveBeenCalled();
  f.send("pointerdown", x, y); f.send("pointerdown", x, y, 2); f.send("pointerup", x, y, 2); f.send("pointerup", x, y);
  expect(f.onSelect).not.toHaveBeenCalled(); f.cleanup();
});
it("preserves holes rather than filling them with slab triangles", () => {
  const geometry = provinceGeometry("M0,0L10,0L10,10L0,10ZM3,3L7,3L7,7L3,7Z");
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  let area = 0;
  for (let i = 0; i < position.count; i += 3) {
    if (normal.getZ(i) < 0.9) continue;
    const a = new Vector3().fromBufferAttribute(position, i), b = new Vector3().fromBufferAttribute(position, i + 1), c = new Vector3().fromBufferAttribute(position, i + 2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  expect(area).toBeCloseTo(84); geometry.dispose();
});
