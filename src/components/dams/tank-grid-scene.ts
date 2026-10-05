import {
  BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, PerspectiveCamera,
  Scene, Vector3,
} from "three";
import type { SceneHost } from "@/lib/three/scene-host";
import { writeSceneState } from "@/lib/three/scene-state";
import type { TankEntry } from "./tank-grid-data";

/** Every scissor view shares geometry, materials and the camera; only instance transforms differ. */
export function attachTankGrid(host: SceneHost, root: HTMLElement, entries: readonly TankEntry[]): () => void {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0xffffff });
  const camera = new PerspectiveCamera(35, 1, 0.1, 20);
  const target = new Vector3(0, 0.62, 0);
  let yaw = 0.18, tilt = 0.18;
  const views: { element: HTMLElement; entry: TankEntry; unregister: () => void; meshes: InstancedMesh[] }[] = [];
  function moveCamera() {
    camera.position.set(Math.sin(yaw) * 3.8, 0.62 + Math.sin(tilt) * 3.8, Math.cos(yaw) * Math.cos(tilt) * 3.8);
    camera.lookAt(target);
  }
  moveCamera();
  const matrix = new Matrix4();
  const position = new Vector3(), scale = new Vector3();
  function instance(mesh: InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
    matrix.makeScale(w, h, d).setPosition(position.set(x, y, z));
    mesh.setMatrixAt(index, matrix);
    mesh.setColorAt(index, new Color(color));
  }
  for (const entry of entries) {
    const element = root.querySelector<HTMLElement>(`[data-tank-view="${entry.id}"]`)!;
    const svg = element.querySelector("svg")!;
    const scene = new Scene();
    const shell = new InstancedMesh(geometry, material, 4);
    const fill = new InstancedMesh(geometry, material, entry.fill.state === "data" ? 1 : 12);
    const streams = new InstancedMesh(geometry, material, 64);
    const arrows = new InstancedMesh(geometry, material, 6);
    // The vessel stays 1.21 units tall; the crest is always exactly 1 unit above the base.
    instance(shell, 0, -0.4, 0.605, 0, 0.025, 1.21, 0.35, "#9ca3af");
    instance(shell, 1, 0.4, 0.605, 0, 0.025, 1.21, 0.35, "#9ca3af");
    instance(shell, 2, 0, 0, 0, 0.825, 0.025, 0.35, "#9ca3af");
    instance(shell, 3, 0, 1, 0.19, 0.96, 0.012, 0.015, "#9ca3af");
    const color = entry.fill.state === "data" ? entry.fill.color : "#9ca3af";
    if (entry.fill.state === "data") {
      instance(fill, 0, 0, entry.fill.height / 2, 0, 0.77, entry.fill.height, 0.3, color);
    } else {
      for (let i = 0; i < 12; i++) {
        matrix.makeRotationZ(-Math.PI / 4);
        matrix.scale(scale.set(0.025, 0.48, 0.025)).setPosition(position.set((i % 3 - 1) * 0.25, 0.2 + Math.floor(i / 3) * 0.27, 0.16));
        fill.setMatrixAt(i, matrix);
        fill.setColorAt(i, new Color(color));
      }
    }
    const counts = [entry.inflow, entry.release].map((rate) => rate.state === "data" ? Math.ceil(rate.ratio * 32) : 0);
    const total = counts[0] + counts[1];
    let arrowCount = 0;
    for (const [side, rate] of [entry.inflow, entry.release].entries()) {
      if (rate.state !== "data" || rate.ratio <= 0) continue;
      const x = side === 0 ? -0.6 : 0.6;
      const y = side === 0 ? 0.75 : 0.12;
      const thickness = rate.ratio * 0.06;
      instance(arrows, arrowCount++, x, y, 0.19, 0.32, thickness, thickness, color);
      for (const angle of [-Math.PI / 4, Math.PI / 4]) {
        matrix.makeRotationZ(-angle);
        matrix.scale(scale.set(0.12, thickness, thickness)).setPosition(position.set(x + 0.12, y + Math.sign(angle) * 0.04, 0.19));
        arrows.setMatrixAt(arrowCount, matrix);
        arrows.setColorAt(arrowCount++, new Color(color));
      }
    }
    arrows.count = 0;
    streams.count = 0;
    scene.add(shell, fill, streams, arrows);
    const unregister = host.registerView(element, {
      scene, camera, state: entry.state, animating: total > 0,
      onTierChange: (tier) => {
        svg.style.visibility = tier === "svg" ? "" : "hidden";
        streams.count = tier === "full" ? total : 0;
        arrows.count = tier === "reduced" ? arrowCount : 0;
        host.setAnimating(element, tier === "full" && total > 0);
      },
      onFrame: ({ time, tier }) => {
        if (tier !== "full" || !total) return;
        let index = 0;
        for (let side = 0; side < 2; side++) {
          for (let i = 0; i < counts[side]; i++) {
            const phase = (time / 1400 + i / counts[side]) % 1;
            const x = side === 0 ? -0.8 + phase * 0.4 : 0.4 + phase * 0.4;
            const y = side === 0 ? 0.75 : 0.12 - phase * 0.08;
            instance(streams, index++, x, y, (i % 3 - 1) * 0.035, 0.018, 0.018, 0.018, color);
          }
        }
        streams.instanceMatrix.needsUpdate = true;
        if (streams.instanceColor) streams.instanceColor.needsUpdate = true;
      },
    });
    views.push({ element, entry, unregister, meshes: [shell, fill, streams, arrows] });
  }
  let pointer: { id: number; x: number; y: number; yaw: number; tilt: number } | null = null;
  let dragged = false;
  function down(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || host.tier === "svg") return;
    dragged = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw, tilt };
  }
  function move(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (!dragged && Math.abs(dx) < 6) return;
    dragged = true;
    root.setPointerCapture(event.pointerId);
    yaw = Math.max(-0.6, Math.min(0.6, pointer.yaw + dx / 240));
    tilt = Math.max(0.05, Math.min(0.55, pointer.tilt - dy / 300));
    moveCamera();
    views.forEach(({ element }) => host.markDirty(element));
  }
  function end(event: PointerEvent) {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
  }
  function click(event: MouseEvent) {
    if (dragged && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); }
    dragged = false;
  }
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("lostpointercapture", end);
  root.addEventListener("click", click, true);
  return () => {
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerup", end);
    root.removeEventListener("pointercancel", end);
    root.removeEventListener("lostpointercapture", end);
    root.removeEventListener("click", click, true);
    for (const { element, entry, unregister, meshes } of views) {
      unregister();
      meshes.forEach((mesh) => mesh.dispose());
      element.querySelector("svg")!.style.visibility = "";
      writeSceneState(element, { mode: "svg", ...entry.state });
    }
    geometry.dispose();
    material.dispose();
  };
}
