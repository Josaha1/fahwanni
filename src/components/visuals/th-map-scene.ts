import {
  AdditiveBlending, AmbientLight, BufferGeometry, CircleGeometry, DirectionalLight, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, InstancedMesh, LineDashedMaterial, LineSegments, Matrix4, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Raycaster, Scene, ShapePath, Vector2,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SceneHost } from "@/lib/three/scene-host";
import { writeSceneState } from "@/lib/three/scene-state";
import { thProvinces, thViewBox } from "@/lib/visuals/th-provinces";
import { floodPoints, pathRings, projectThailand, provinceColor, thRegionOutlines, type ThMapData } from "./th-map-data";

export function provinceGeometry(d: string) {
  const path = new ShapePath();
  path.userData.style = { fillRule: "evenodd" };
  for (const ring of pathRings(d)) {
    path.moveTo(ring[0][0], -ring[0][1]);
    for (const [x, y] of ring.slice(1)) path.lineTo(x, -y);
    path.currentPath!.closePath();
  }
  return new ExtrudeGeometry(path.toShapes(), { depth: 2, steps: 1, bevelEnabled: false });
}

export function attachThMap(host: SceneHost, element: HTMLElement, data: ThMapData, onSelect: (id: string) => void): () => void {
  const fallback = element.querySelector<SVGElement>("[data-th-map-fallback]")!;
  const scene = new Scene();
  const [, , width, height] = thViewBox.split(" ").map(Number);
  const camera = new PerspectiveCamera(40, 1, 1, 3000);
  camera.position.set(width / 2, -height / 2 - 130, height * 1.55);
  const controls = new OrbitControls(camera, element);
  controls.target.set(width / 2, -height / 2, 0);
  controls.enablePan = false; controls.minDistance = height * 0.7; controls.maxDistance = height * 2.5;
  controls.minPolarAngle = Math.PI / 4; controls.maxPolarAngle = Math.PI * 0.9;
  controls.update();
  // OrbitControls defaults to touch-action:none; preserve the page's vertical scrolling policy.
  element.style.touchAction = "pan-y";
  scene.add(new AmbientLight(0xffffff, 2));
  const light = new DirectionalLight(0xffffff, 3); light.position.set(0, 0, 1000); scene.add(light);
  const geometries: BufferGeometry[] = [];
  const materials: (MeshStandardMaterial | MeshBasicMaterial | LineDashedMaterial)[] = [];
  const meshes: Mesh[] = [];
  const warnings: LineDashedMaterial[] = [];
  function outline(d: string, color: string, dashSize: number, gapSize: number, pulse = false) {
    const vertices: number[] = [];
    // Region outlines are independent segments; province outlines are closed rings.
    for (const part of d.matchAll(/M([^MZ]+)(Z?)/g)) {
      const pairs = part[1].split("L").map((pair) => pair.split(",").map(Number));
      if (part[2]) pairs.push(pairs[0]);
      for (let i = 1; i < pairs.length; i++) vertices.push(pairs[i - 1][0], -pairs[i - 1][1], 2.2, pairs[i][0], -pairs[i][1], 2.2);
    }
    const geometry = new BufferGeometry(); geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3)); geometries.push(geometry);
    const material = new LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity: 0.9, depthWrite: false }); materials.push(material);
    const lines = new LineSegments(geometry, material); lines.computeLineDistances(); scene.add(lines);
    if (pulse) {
      warnings.push(material);
      const glow = new LineDashedMaterial({ color, transparent: true, opacity: 0.35, depthTest: false, blending: AdditiveBlending, linewidth: 3 });
      materials.push(glow); warnings.push(glow); scene.add(new LineSegments(lines.geometry, glow));
    }
  }
  try {
    for (const province of thProvinces) {
      const geometry = provinceGeometry(province.d); geometries.push(geometry);
      const material = new MeshStandardMaterial({ color: provinceColor(data.counts?.[province.id] ?? null), roughness: 1 }); materials.push(material);
      const mesh = new Mesh(geometry, material); mesh.userData.province = province.id; meshes.push(mesh); scene.add(mesh);
      outline(province.d, data.affected.includes(province.id) ? "#334155" : "#64748b", data.affected.includes(province.id) ? 2 : 10000, data.affected.includes(province.id) ? 2 : 0);
    }
    for (const region of data.warnedRegions) outline(thRegionOutlines[region], "#a855f7", 4, 3, true);
  } catch (error) {
    controls.dispose(); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    throw error;
  }
  const points = floodPoints(data.samples);
  const dotGeometry = new CircleGeometry(0.9, 6); geometries.push(dotGeometry);
  const dotMaterial = new MeshBasicMaterial({ color: "#fb923c", side: DoubleSide }); materials.push(dotMaterial);
  const dots = new InstancedMesh(dotGeometry, dotMaterial, points.length);
  const matrix = new Matrix4();
  points.forEach((point, i) => {
    const [x, y] = projectThailand(point.lon, point.lat);
    dots.setMatrixAt(i, matrix.makeTranslation(x, -y, 2.5));
  });
  dots.instanceMatrix.needsUpdate = true; scene.add(dots);
  const state = { provinces: 77, points: points.length, warnedRegions: data.warnedRegions };
  const change = () => host.markDirty(element);
  controls.addEventListener("change", change);
  let pointer: { id: number; x: number; y: number } | null = null;
  let moved = false;
  const pressed = new Set<number>();
  function down(event: PointerEvent) {
    if (host.tier === "svg") return;
    pressed.add(event.pointerId);
    if (pressed.size > 1) { moved = true; return; }
    moved = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }
  function move(event: PointerEvent) {
    if (pointer && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 6) moved = true;
  }
  function up(event: PointerEvent) {
    pressed.delete(event.pointerId);
    if (!pointer || pointer.id !== event.pointerId) return;
    const tap = !moved && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) <= 6
      && event.type === "pointerup" && host.tier !== "svg";
    pointer = null;
    if (!tap) return;
    const rect = element.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (hit) onSelect(hit.object.userData.province);
  }
  element.addEventListener("pointerdown", down); element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up); element.addEventListener("pointercancel", up);
  const unregister = host.registerView(element, { scene, camera, state,
    onTierChange: (tier) => {
      controls.enabled = tier !== "svg";
      // Retain keyboard access to province paths under the shared canvas.
      fallback.style.opacity = tier === "svg" ? "" : "0";
      fallback.style.pointerEvents = tier === "svg" ? "" : "none";
      warnings.forEach((material, index) => { material.opacity = index % 2 ? (tier === "full" ? 0.35 : 0) : 0.9; });
      host.setAnimating(element, tier === "full" && warnings.length > 0);
    },
    onFrame: ({ time, tier }) => {
      if (tier === "full") warnings.forEach((material, index) => { material.opacity = (0.65 + Math.sin(time / 500) * 0.3) * (index % 2 ? 0.4 : 1); });
    },
  });
  host.markDirty(element);
  return () => {
    unregister(); controls.removeEventListener("change", change); controls.dispose();
    element.removeEventListener("pointerdown", down); element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up); element.removeEventListener("pointercancel", up);
    dots.dispose(); geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    fallback.style.opacity = ""; fallback.style.pointerEvents = "";
    writeSceneState(element, { mode: "svg", ...state });
  };
}
