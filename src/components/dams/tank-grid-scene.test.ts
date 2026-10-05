import { expect, it, vi } from "vitest";
import { InstancedMesh, Matrix4, Vector3 } from "three";
import type { SceneHost, ViewOptions } from "@/lib/three/scene-host";
import type { GlTier } from "@/lib/three/gl-tier";
import fixture from "@/lib/dams/fixture-rid.json";
import { parseRidDams } from "@/lib/dams/rid";
import { tankGridData } from "./tank-grid-data";
import { attachTankGrid } from "./tank-grid-scene";

it.each(["full", "reduced"] as const)("registers 35 instanced views and releases only view resources (initial %s)", (initialTier) => {
  const parsed = parseRidDams(fixture);
  const dam = { ...parsed.dams[0], storagePct: 110, releaseCms: 1000, inflowCms: 500 };
  const entries = tankGridData([dam, { ...parsed.dams[1], storagePct: 0, releaseCms: 0, inflowCms: null }], parsed.dataDate, null);
  const elements = new Map(entries.map((entry) => {
    const svg = { style: { visibility: "" } };
    return [entry.id, { querySelector: () => svg, setAttribute: vi.fn(), svg }];
  }));
  const listeners = new Map<string, (event: unknown) => void>();
  const root = { querySelector: (selector: string) => elements.get(selector.match(/"(\d+)"/)![1]),
    addEventListener: vi.fn((name, callback) => listeners.set(name, callback)), removeEventListener: vi.fn(),
    setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn() };
  const registrations: { element: HTMLElement; options: ViewOptions; unregister: ReturnType<typeof vi.fn> }[] = [];
  const host = { tier: initialTier as GlTier, markDirty: vi.fn(), setAnimating: vi.fn(),
    registerView: (element: HTMLElement, options: ViewOptions) => {
      const unregister = vi.fn();
      registrations.push({ element, options, unregister });
      options.onTierChange?.(host.tier);
      return unregister;
    } };
  const dispose = attachTankGrid(host as unknown as SceneHost, root as unknown as HTMLElement, entries);
  expect(registrations).toHaveLength(35);
  expect(new Set(registrations.map(({ options }) => options.camera)).size).toBe(1);
  const meshes = registrations.flatMap(({ options }) => options.scene.children as InstancedMesh[]);
  expect(meshes.every((mesh) => mesh instanceof InstancedMesh)).toBe(true);
  expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);
  const first = registrations.find(({ options }) => options.state?.id === dam.id)!.options;
  const fill = first.scene.children[1] as InstancedMesh;
  expect(fill.instanceMatrix.array[5]).toBeCloseTo(1.1);
  expect(fill.instanceMatrix.array[13]).toBeCloseTo(0.55);
  const streams = first.scene.children[2] as InstancedMesh;
  const arrows = first.scene.children[3] as InstancedMesh;
  expect(streams.count).toBe(initialTier === "full" ? 48 : 0);
  expect(arrows.count).toBe(initialTier === "reduced" ? 6 : 0);
  first.onTierChange?.("full");
  expect(streams.count).toBe(48);
  expect(arrows.count).toBe(0);
  first.onFrame!({ time: 500, deltaMs: 16, width: 100, height: 144, tier: "full" });
  expect(streams.instanceMatrix.array.some((value) => value !== 0)).toBe(true);
  expect(elements.get(dam.id)!.svg.style.visibility).toBe("hidden");
  host.tier = "reduced";
  registrations.forEach(({ options }) => options.onTierChange?.("reduced"));
  expect(registrations.every(({ options }) => (options.scene.children[2] as InstancedMesh).count === 0)).toBe(true);
  expect(arrows.count).toBe(6);
  expect(registrations.filter(({ options }) => options.state?.id !== dam.id).every(({ options }) => (options.scene.children[3] as InstancedMesh).count === 0)).toBe(true);
  const matrix = new Matrix4();
  const widths = [0, 3].map((index) => {
    arrows.getMatrixAt(index, matrix);
    return new Vector3().setFromMatrixScale(matrix).y;
  });
  expect(widths[0]).toBeCloseTo(0.03);
  expect(widths[1]).toBeCloseTo(0.06);
  arrows.getMatrixAt(0, matrix);
  expect(matrix.elements[12]).toBeCloseTo(-0.6);
  arrows.getMatrixAt(3, matrix);
  expect(matrix.elements[12]).toBeCloseTo(0.6);
  for (const index of [2, 5]) {
    arrows.getMatrixAt(index, matrix);
    expect(matrix.elements[1]).toBeLessThan(0);
    expect(matrix.elements[13]).toBeGreaterThan(index === 2 ? 0.75 : 0.12);
  }
  const staticMatrices = [...arrows.instanceMatrix.array];
  first.onFrame!({ time: 2000, deltaMs: 0, width: 60, height: 56, tier: "reduced" });
  expect([...arrows.instanceMatrix.array]).toEqual(staticMatrices);
  expect(streams.count).toBe(0);
  expect(host.setAnimating).toHaveBeenLastCalledWith(registrations.at(-1)!.element, false);
  listeners.get("pointerdown")!({ isPrimary: true, button: 0, pointerId: 1, clientX: 0, clientY: 0 });
  listeners.get("pointermove")!({ pointerId: 1, clientX: 30, clientY: 10 });
  expect(host.markDirty).toHaveBeenCalledTimes(35);
  const click = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  listeners.get("click")!(click);
  expect(click.preventDefault).toHaveBeenCalledOnce();
  registrations.forEach(({ options }) => options.onTierChange?.("svg"));
  expect(elements.get(dam.id)!.svg.style.visibility).toBe("");
  const geometryDispose = vi.spyOn(meshes[0].geometry, "dispose");
  dispose();
  expect(registrations.every(({ unregister }) => unregister.mock.calls.length === 1)).toBe(true);
  expect(geometryDispose).toHaveBeenCalledOnce();
  expect(root.removeEventListener).toHaveBeenCalledTimes(6);
  expect(elements.get(dam.id)!.setAttribute).toHaveBeenCalledWith("data-scene-state", JSON.stringify({ mode: "svg", id: dam.id, pct: 110, release: 1000, inflow: 500 }));
});
