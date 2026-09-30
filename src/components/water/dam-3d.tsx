"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight, Box3, Color, DataTexture, DirectionalLight, DoubleSide, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, RepeatWrapping, RGBAFormat,
  Scene, SRGBColorSpace, Texture, Vector3, WebGLRenderer,
  type Material, type Object3D,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useT } from "@/i18n/client";
import { damSceneSummary } from "@/lib/chart-summaries";
import type { DamHistory } from "@/lib/dams/history";
import { damSceneColors, waterLevel } from "@/lib/dams/model3d";
import type { Dam } from "@/lib/dams/types";

type Props = {
  dam: Dam; history?: DamHistory | null; theme: "light" | "dark";
  reducedMotion: boolean; onFallback: () => void;
};

function disposeModel(root: Object3D) {
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export function Dam3D(props: Props) {
  const { dam, history } = props;
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settings = useRef(props);
  const updateRef = useRef<(() => void) | null>(null);
  const summary = damSceneSummary(dam, history, t);

  useEffect(() => {
    settings.current = props;
    updateRef.current?.();
  }, [props]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch {
      settings.current.onFallback();
      return;
    }

    const scene = new Scene();
    const pivot = new Group();
    const ambient = new AmbientLight(0xffffff, 2);
    const hemisphere = new HemisphereLight(0xe6efff, 0x99836b, 0.5);
    scene.add(pivot, ambient, hemisphere);
    const sun = new DirectionalLight(0xffffff, 3);
    sun.position.set(-3, 8, 5);
    scene.add(sun);
    const camera = new PerspectiveCamera(38, 1, 0.1, 100);
    const viewDirection = new Vector3(8, 7, -10).normalize();
    const viewRight = new Vector3().crossVectors(camera.up, viewDirection).normalize();
    const viewUp = new Vector3().crossVectors(viewDirection, viewRight).normalize();
    const bounds = new Box3();
    let model: Object3D | null = null;
    let nodes: Record<string, Mesh> = {};
    let widthAxis: "x" | "z" = "x";
    let unitWidth = 1;
    let levelHeight = 2;
    let widthAt0 = 0;
    let widthAt1 = 4;
    let radius = 5;
    let frame = 0;
    let previousTime = 0;
    let flowOffset = 0;
    let disposed = false;
    let failed = false;
    let sceneTheme = settings.current.theme;
    let pointer: { id: number; x: number; angle: number } | null = null;
    let flowTexture: DataTexture | null = null;

    function fail() {
      if (disposed || failed) return;
      failed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      settings.current.onFallback();
    }

    function flowSpeed() {
      const { dam, reducedMotion } = settings.current;
      return !reducedMotion && Number.isFinite(dam.releaseCms) && (dam.releaseCms ?? 0) > 0
        ? Math.min(2, (dam.releaseCms ?? 0) / 500) : 0;
    }

    function requestRender() {
      if (disposed || failed || document.hidden || frame) return;
      frame = requestAnimationFrame(render);
    }

    function render(time: number) {
      frame = 0;
      if (disposed || failed || document.hidden) return;
      const speed = flowSpeed();
      if (flowTexture && speed) {
        if (previousTime) flowOffset = (flowOffset - Math.min(0.1, (time - previousTime) / 1000) * speed) % 1;
        flowTexture.offset.y = flowOffset;
      }
      previousTime = speed ? time : 0;
      try { renderer.render(scene, camera); }
      catch { fail(); return; }
      if (model && speed) requestRender();
    }

    function resize() {
      if (disposed || failed) return;
      const { width, height } = canvas.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      const vertical = camera.fov * Math.PI / 360;
      let distance = radius * 2;
      const center = new Vector3();
      if (model) {
        pivot.updateWorldMatrix(true, false);
        bounds.setFromObject(model);
        bounds.getCenter(center);
        radius = bounds.getSize(new Vector3()).length() / 2;
        // Fit the box, measured from its own centre, into 92% of the canvas width and height separately, including depth.
        const focalLength = height / (2 * Math.tan(vertical));
        const halfWidth = width * 0.92 / 2, halfHeight = height * 0.92 / 2;
        distance = 0;
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              const corner = new Vector3(x, y, z).sub(center);
              const needed = Math.max(Math.abs(corner.dot(viewRight)) / halfWidth, Math.abs(corner.dot(viewUp)) / halfHeight);
              distance = Math.max(distance, corner.dot(viewDirection) + needed * focalLength);
            }
          }
        }
      }
      camera.position.copy(viewDirection).multiplyScalar(distance).add(center);
      camera.far = distance + radius * 4;
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      requestRender();
    }

    function setLevel(mesh: Mesh, level: number, baseWidth: number) {
      mesh.position.y = level * levelHeight;
      mesh.scale[widthAxis] = (widthAt0 + (widthAt1 - widthAt0) * level) / baseWidth;
    }

    function update() {
      const { dam, history } = settings.current;
      const colors = damSceneColors(sceneTheme, dam.band);
      scene.background = new Color(colors.background);
      ambient.intensity = sceneTheme === "dark" ? 2.8 : 2;
      hemisphere.intensity = sceneTheme === "dark" ? 1.6 : 0.5;
      for (const [name, mesh] of Object.entries(nodes)) {
        const material = mesh.material as MeshStandardMaterial | MeshBasicMaterial;
        material.color.set(name === "Basin" ? colors.terrain
          : name === "WaterUp" ? colors.water : name === "WaterDown" ? colors.waterDeep
            : name === "RimLastYear" ? colors.rimLastYear : name === "Rim2554" ? colors.rim2554 : colors.wall);
        // The baked terrain already carries its colour and AO; a dark tint compounds both.
        if (name === "Basin" && sceneTheme === "dark") material.color.lerp(new Color(0xffffff), 0.75);
      }
      if (nodes.WaterUp) setLevel(nodes.WaterUp, waterLevel(dam.storagePct), unitWidth);
      for (const [name, entry] of [["RimLastYear", history?.lastYear], ["Rim2554", history?.year2554]] as const) {
        const mesh = nodes[name];
        if (!mesh) continue;
        const pct = history?.dataDate === dam.date ? entry?.pct[dam.id] : undefined;
        mesh.visible = pct !== undefined && Number.isFinite(pct);
        if (mesh.visible) setLevel(mesh, waterLevel(pct!), widthAt1);
      }
      if (nodes.WaterDown) nodes.WaterDown.visible = (dam.releaseCms ?? 0) > 0;
      previousTime = 0;
      if (!flowSpeed()) { cancelAnimationFrame(frame); frame = 0; }
      resize();
    }

    updateRef.current = () => { sceneTheme = settings.current.theme; update(); };
    update();
    const themeObserver = new MutationObserver(() => {
      const theme = document.documentElement.dataset.theme;
      sceneTheme = theme === "dark" || theme === "night" ? "dark" : theme === "light" ? "light" : settings.current.theme;
      update();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    function onVisibility() {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      requestRender();
    }
    function onContextLost(event: Event) { event.preventDefault(); fail(); }
    function onPointerDown(event: PointerEvent) {
      if (failed || pointer || !event.isPrimary || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, angle: pivot.rotation.y };
      canvas.setPointerCapture(event.pointerId);
    }
    function onPointerMove(event: PointerEvent) {
      if (!pointer || pointer.id !== event.pointerId || failed) return;
      const delta = (event.clientX - pointer.x) / Math.max(1, canvas.clientWidth) * Math.PI;
      pivot.rotation.y = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, pointer.angle + delta));
      resize();
    }
    function onPointerEnd(event: PointerEvent) {
      if (pointer?.id !== event.pointerId) return;
      pointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("lostpointercapture", onPointerEnd);

    void new GLTFLoader().loadAsync("/models/dam.glb").then((gltf) => {
      if (disposed || failed) { disposeModel(gltf.scene); return; }
      model = gltf.scene;
      const names = ["Basin", "Wall", "Spillway", "WaterUp", "WaterDown", "RimLastYear", "Rim2554"];
      for (const name of names) {
        const mesh = model.getObjectByName(name);
        if (!(mesh instanceof Mesh)) throw new Error(`Missing dam mesh: ${name}`);
        nodes[name] = mesh;
      }
      const upstream = nodes.WaterUp;
      upstream.geometry.computeBoundingBox();
      const size = upstream.geometry.boundingBox!.getSize(new Vector3());
      // The export is Y-up; the unit-width dimension identifies the valley axis.
      widthAxis = Math.abs(size.x - 1) <= Math.abs(size.z - 1) ? "x" : "z";
      unitWidth = size[widthAxis];
      ({ levelHeight, widthAt0, widthAt1 } = upstream.userData);
      if (![unitWidth, levelHeight, widthAt0, widthAt1].every(Number.isFinite)
        || unitWidth <= 0 || levelHeight <= 0 || widthAt1 <= 0) throw new Error("Invalid dam dimensions");

      // A repeating highlight follows the model's distance-based spillway UVs.
      const pixels = new Uint8Array(4 * 64);
      for (let i = 0; i < 64; i++) {
        const shade = Math.round(205 + 50 * Math.pow((1 + Math.cos(i / 64 * Math.PI * 2)) / 2, 8));
        pixels.set([shade, shade, shade, 255], i * 4);
      }
      flowTexture = new DataTexture(pixels, 1, 64, RGBAFormat);
      flowTexture.wrapS = flowTexture.wrapT = RepeatWrapping;
      flowTexture.colorSpace = SRGBColorSpace;
      flowTexture.needsUpdate = true;
      const originalMaterials = new Set<Material>();
      for (const [name, mesh] of Object.entries(nodes)) {
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) originalMaterials.add(material);
        const water = name === "WaterUp" || name === "WaterDown";
        const rim = name === "RimLastYear" || name === "Rim2554";
        // Rims share the transparent queue with water so higher renderOrder applies.
        mesh.renderOrder = rim ? 2 : water ? 1 : 0;
        // The rim tubes are ~0.02 units thick; stretch them vertically so the level band reads at dialog size.
        if (rim) mesh.scale.y = 6;
        mesh.material = rim ? new MeshBasicMaterial({
          side: DoubleSide, transparent: true, opacity: 1, depthTest: true, depthWrite: false,
        }) : new MeshStandardMaterial({
          vertexColors: name === "Basin" || name === "Wall" || name === "Spillway",
          roughness: water ? 0.35 : 0.9, side: DoubleSide,
          transparent: water, opacity: water ? 0.88 : 1, depthWrite: !water,
          map: name === "WaterDown" ? flowTexture : null,
        });
      }
      originalMaterials.forEach((material) => {
        for (const value of Object.values(material)) if (value instanceof Texture) value.dispose();
        material.dispose();
      });
      bounds.setFromObject(model);
      const center = bounds.getCenter(new Vector3());
      model.position.sub(center);
      pivot.add(model);
      update();
      resize();
    }).catch(fail);

    return () => {
      disposed = true;
      updateRef.current = null;
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("lostpointercapture", onPointerEnd);
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
      if (model) disposeModel(model);
      flowTexture?.dispose();
      nodes = {};
      renderer.dispose();
    };
  }, []);

  return <div className="space-y-2">
    <canvas ref={canvasRef} className="aspect-[3/2] w-full rounded-xl" style={{ touchAction: "pan-y" }}
      role="img" aria-label={summary} />
    <p className="text-muted text-xs">{summary}</p>
  </div>;
}
