import {
  AmbientLight, BufferGeometry, CanvasTexture, CircleGeometry, Color, DirectionalLight, DoubleSide,
  Float32BufferAttribute, Fog, HemisphereLight, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera,
  PlaneGeometry, Points, PointsMaterial, RingGeometry, Scene, Sprite, SpriteMaterial, Vector3,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { attachOrientation } from "@/lib/three/orientation";
import { cameraTilt } from "@/lib/three/camera-tilt";
import type { SceneHost } from "@/lib/three/scene-host";
import { writeSceneState } from "@/lib/three/scene-state";
import { terrainCoordinate, terrainElevation, terrainPosition, terrainSurfaceHeight, terrariumArea, type TerrainPixels } from "@/lib/terrain/terrarium";
import type { NearMeProps, nearMeVisuals } from "./near-me-3d";

export function attachNearMe(host: SceneHost, element: HTMLElement, props: NearMeProps, data: ReturnType<typeof nearMeVisuals>) {
  const fallback = element.querySelector<HTMLElement>("[data-near-me-fallback]")!;
  const label = element.querySelector<HTMLElement>("[data-terrain-label]")!;
  const tiltButton = element.querySelector<HTMLButtonElement>("button[data-enable-tilt]");
  const scene = new Scene();
  const camera = new PerspectiveCamera(42, 1, 0.1, 500);
  // One unit = 1 km; this framing fills the 180 px tile with the 30 km circle.
  camera.position.set(0, 42, 50);
  const controls = new OrbitControls(camera, element);
  controls.enablePan = false;
  controls.minDistance = 30; controls.maxDistance = 120;
  controls.minPolarAngle = Math.PI / 12; controls.maxPolarAngle = Math.PI / 2.5;
  element.style.touchAction = "pan-y";
  controls.update();
  // Keep even the furthest orbit inside fog near; the radial alpha supplies the rim fade at every zoom.
  const background = new Color(getComputedStyle(element).getPropertyValue("--background").trim());
  scene.fog = new Fog(background, controls.maxDistance + 1, controls.maxDistance + 50);
  let edgeMaterial: MeshBasicMaterial | undefined;
  const themeObserver = new MutationObserver(() => {
    background.set(getComputedStyle(element).getPropertyValue("--background").trim());
    (scene.fog as Fog).color.copy(background);
    edgeMaterial?.color.copy(background);
    host.markDirty(element);
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  scene.add(new AmbientLight(0xffffff, 0.4), new HemisphereLight(0xe6efff, 0x99836b, 0.8));
  const sun = new DirectionalLight(0xffffff, 2.5);
  sun.position.set(-30, 70, 20); scene.add(sun);
  const geometries: BufferGeometry[] = [];
  const materials: (MeshBasicMaterial | MeshStandardMaterial | PointsMaterial | SpriteMaterial)[] = [];
  const textures: CanvasTexture[] = [];
  const abort = new AbortController();
  let disposed = false, ready = false;
  let terrain: TerrainPixels[] = [];
  let base = 0;
  let surface: number[] | null = null;
  const height = (x: number, z: number): number => surface ? terrainSurfaceHeight(surface, x, z)
    : terrain.length ? (terrainElevation(terrain, terrainCoordinate(props.place, x, z)) - base) / 1000 * 4 : 0;
  const particles: { points: Points; x: number; z: number; y: number; jet: boolean }[] = [];
  const state = { ...data.state, terrain: false, exaggeration: 4 };
  function show() {
    const svg = host.tier === "svg" || !ready;
    fallback.style.visibility = svg ? "" : "hidden";
    label.hidden = svg || !state.terrain;
    if (tiltButton) tiltButton.hidden = svg || !window.DeviceOrientationEvent || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (svg) { element.removeAttribute("role"); element.removeAttribute("aria-label"); }
    else { element.setAttribute("role", "group"); element.setAttribute("aria-label", props.summaries.join(" · ")); }
    particles.forEach(({ points }) => { points.visible = host.tier === "full"; });
    writeSceneState(element, { ...state, mode: svg ? "svg" : host.tier });
    host.setAnimating(element, ready && host.tier === "full" && particles.length > 0);
  }
  let unregister = () => {};
  const tiltCamera = cameraTilt(camera, () => controls.target ?? new Vector3());
  const disposeTilt = attachOrientation(element, tiltButton, (tilt) => {
    if (host.tier === "svg" || !ready) return;
    tiltCamera(tilt); change();
  });
  const change = () => {
    element.dataset.cameraPosition = JSON.stringify(camera.position.toArray());
    host.markDirty(element);
  };
  controls.addEventListener("change", change);

  function glyph(x: number, z: number, home: boolean, dam = false) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = dam ? "#94a3b8" : home ? "#38bdf8" : "#eab308";
    ctx.beginPath();
    if (dam) { ctx.moveTo(10, 54); ctx.lineTo(20, 12); ctx.lineTo(44, 12); ctx.lineTo(54, 54); }
    else { ctx.moveTo(8, 28); ctx.lineTo(32, 6); ctx.lineTo(56, 28); ctx.lineTo(50, 28); ctx.lineTo(50, 56); ctx.lineTo(14, 56); ctx.lineTo(14, 28); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = home ? "#0f172a" : "#fff"; ctx.fillRect(27, 36, 10, 20);
    const texture = new CanvasTexture(canvas); textures.push(texture);
    const material = new SpriteMaterial({ map: texture, depthWrite: false, fog: false }); materials.push(material);
    const sprite = new Sprite(material); sprite.position.set(x, height(x, z) + 1.6, z); sprite.scale.set(4, 4, 1); scene.add(sprite);
  }
  function stream(point: { lat: number; lon: number }, ratio: number, jet: boolean) {
    const position = terrainPosition(props.place, point);
    // An off-tile nearest source is an instrument inset, not a fabricated geographical location.
    const outside = Math.hypot(position.x, position.z) > 28;
    const { x, z } = outside ? { x: jet ? 22 : -22, z: 18 } : position;
    if (jet) glyph(x, z, false, true);
    if (ratio <= 0) return;
    const geometry = new BufferGeometry(); geometries.push(geometry);
    geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(Math.ceil(ratio * 80) * 3), 3));
    const material = new PointsMaterial({ color: "#38bdf8", size: 0.35, transparent: true, opacity: 0.9, depthWrite: false, fog: false }); materials.push(material);
    const points = new Points(geometry, material); points.frustumCulled = false; scene.add(points);
    particles.push({ points, x, z, y: height(x, z) + 0.4, jet });
  }

  async function load() {
    try {
      const geometry = new PlaneGeometry(60, 60, 64, 64); geometries.push(geometry); geometry.rotateX(-Math.PI / 2);
      const positions = geometry.getAttribute("position");
      try {
        terrain = await Promise.all(terrariumArea(props.place).map(async (tile) => {
          const response = await fetch(tile.url, { signal: abort.signal });
          if (!response.ok) throw new Error(`Terrarium ${response.status}`);
          const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
          try {
            const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (!ctx) throw new Error("Terrarium pixels unavailable");
            ctx.drawImage(bitmap, 0, 0);
            return { ...tile, width: bitmap.width, height: bitmap.height, rgba: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
          } finally { bitmap.close(); }
        }));
        if (disposed) return;
        base = terrainElevation(terrain, props.place);
        surface = Array.from({ length: positions.count }, (_, i) => height(positions.getX(i), positions.getZ(i)));
        state.terrain = true;
      } catch {
        if (disposed) return;
        // Missing or invalid DEM pixels still allow 3D, without claiming measured terrain.
        abort.abort(); terrain = []; base = 0; surface = null;
      }
      if (disposed) return;
      for (let i = 0; i < positions.count; i++) positions.setY(i, height(positions.getX(i), positions.getZ(i)));
      const indices = geometry.index!;
      const kept: number[] = [];
      for (let i = 0; i < indices.count; i += 3) {
        const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
        if (triangle.every((v) => Math.hypot(positions.getX(v), positions.getZ(v)) <= 30)) kept.push(...triangle);
      }
      geometry.setIndex(kept); geometry.computeVertexNormals();
      let minHeight = Infinity, maxHeight = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        if (Math.hypot(positions.getX(i), positions.getZ(i)) > 30) continue;
        minHeight = Math.min(minHeight, positions.getY(i));
        maxHeight = Math.max(maxHeight, positions.getY(i));
      }
      const range = maxHeight - minHeight;
      const green = new Color("#7fa36b"), dark = new Color("#294d3d"), high = new Color("#746b60");
      const colour = new Color(), colours: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        // A small local relief stays green rather than stretching DEM noise across the palette.
        const relative = range / 4 * 1000 < 20 ? 0 : MathUtils.clamp((positions.getY(i) - minHeight) / range, 0, 1);
        if (relative <= 0.65) colour.copy(green).lerp(dark, relative / 0.65);
        else colour.copy(dark).lerp(high, (relative - 0.65) / 0.35);
        // Finish before the clipped triangle boundary so its ~1 km steps cannot form a hard edge.
        const alpha = 1 - MathUtils.smoothstep(Math.hypot(positions.getX(i), positions.getZ(i)), 25, 29);
        colours.push(colour.r, colour.g, colour.b, alpha);
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colours, 4));
      const material = new MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, side: DoubleSide }); materials.push(material);
      // Transparent terrain must draw before the decals and sprites on the far side too.
      const ground = new Mesh(geometry, material); ground.renderOrder = -1; scene.add(ground);
      // Pixels are ~1 km; decals are drawn larger than that so they stay visible at phone size.
      const decalGeometry = new CircleGeometry(0.9, 12); geometries.push(decalGeometry); decalGeometry.rotateX(-Math.PI / 2);
      const floodMaterial = new MeshBasicMaterial({ color: "#fb923c", transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide, fog: false }); materials.push(floodMaterial);
      const haloMaterial = new MeshBasicMaterial({ color: "#fb923c", transparent: true, opacity: 0.18, depthWrite: false, side: DoubleSide, fog: false }); materials.push(haloMaterial);
      const stippleMaterial = new MeshBasicMaterial({ color: "#e2e8f0", transparent: true, opacity: 0.85, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false }); materials.push(stippleMaterial);
      const stippleBorderMaterial = new MeshBasicMaterial({ color: "#334155", transparent: true, opacity: 0.85, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false }); materials.push(stippleBorderMaterial);
      for (const point of "points" in data.ring ? data.ring.points : []) {
        if (point.kind === "dry" || point.kind === "water") continue;
        const { x, z } = terrainPosition(props.place, point);
        const flood = point.kind.includes("flood");
        if (flood) {
          const halo = new Mesh(decalGeometry, haloMaterial); halo.scale.setScalar(2.5);
          halo.position.set(x, height(x, z) + 0.03, z); scene.add(halo);
        } else {
          const border = new Mesh(decalGeometry, stippleBorderMaterial); border.scale.setScalar(0.62);
          border.position.set(x, height(x, z) + 0.035, z); scene.add(border);
        }
        const dot = new Mesh(decalGeometry, flood ? floodMaterial : stippleMaterial);
        dot.position.set(x, height(x, z) + (flood ? 0.06 : 0.04), z);
        if (!flood) dot.scale.setScalar(0.55);
        scene.add(dot);
      }
      const edgeGeometry = new RingGeometry(29.6, 30, 96); geometries.push(edgeGeometry); edgeGeometry.rotateX(-Math.PI / 2);
      edgeMaterial = new MeshBasicMaterial({ color: background, transparent: true, opacity: 0.15, depthWrite: false, side: DoubleSide, fog: false, toneMapped: false }); materials.push(edgeMaterial);
      const edge = new Mesh(edgeGeometry, edgeMaterial); edge.position.y = 0.3; scene.add(edge);
      for (const village of props.villages ?? []) { const { x, z } = terrainPosition(props.place, village); glyph(x, z, false); }
      glyph(0, 0, true);
      if (props.station && data.rain.state === "data") stream(props.station, data.rain.ratio, false);
      if (props.dam) stream(props.dam, data.release.state === "data" ? data.release.ratio : 0, true);
      ready = true;
      unregister = host.registerView(element, { scene, camera, state,
        onTierChange: show,
        onFrame: ({ time, tier }) => {
          if (tier !== "full") return;
          for (const { points, x, z, y, jet } of particles) {
            const positions = points.geometry.getAttribute("position");
            for (let i = 0; i < positions.count; i++) {
              const phase = (time / 1400 + i / positions.count) % 1;
              positions.setXYZ(i, x + (jet ? phase * 5 : Math.sin(i * 2.4) * 2),
                y + (jet ? 1 - phase * phase : (1 - phase) * 7), z + Math.cos(i * 2.4) * (jet ? 0.3 : 2));
            }
            positions.needsUpdate = true;
          }
        },
      });
      show(); host.markDirty(element);
    } catch {
      // WebGL scene setup failure retains the SVG summaries.
      if (!disposed) { ready = false; show(); }
    }
  }
  show();
  void load();
  return () => {
    disposed = true; disposeTilt(); abort.abort(); unregister(); themeObserver.disconnect(); controls.removeEventListener("change", change); controls.dispose();
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose()); textures.forEach((texture) => texture.dispose());
    fallback.style.visibility = ""; label.hidden = true; element.removeAttribute("role"); element.removeAttribute("aria-label");
    writeSceneState(element, { mode: "svg", terrain: false, ...data.state });
  };
}
