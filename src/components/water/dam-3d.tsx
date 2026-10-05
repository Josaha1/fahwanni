"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight, Box3, Color, DataTexture, DirectionalLight, DoubleSide, Group, HemisphereLight,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, RepeatWrapping, RGBAFormat,
  Scene, SRGBColorSpace, Texture, Vector3, WebGLRenderer, BufferGeometry, Float32BufferAttribute,
  PlaneGeometry, Points, PointsMaterial, EdgesGeometry, LineSegments, LineBasicMaterial,
  type Material, type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { useT } from "@/i18n/client";
import { damSceneSummary } from "@/lib/chart-summaries";
import type { DamHistory } from "@/lib/dams/history";
import { damGhosts, damSceneColors, damStreams, waterLevel } from "@/lib/dams/model3d";
import type { Dam } from "@/lib/dams/types";
import { forceGlFromSearch, glTier, readRendererString, type GlTier } from "@/lib/three/gl-tier";
import { cappedDpr, sampleFrame, type FrameWatchdog } from "@/lib/three/scene-logic";
import { terrariumGrid, terrariumTile } from "@/lib/terrain/terrarium";

type Props = {
  dam: Dam; history?: DamHistory | null; theme: "light" | "dark";
  reducedMotion: boolean; onFallback: () => void;
  detail?: boolean; summary?: string; onTierChange?: (tier: GlTier) => void; onTerrainLoaded?: () => void;
};

function disposeModel(root: Object3D) {
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Points || object instanceof LineSegments)) return;
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
  const summary = props.summary ?? damSceneSummary(dam, history, t);

  useEffect(() => {
    settings.current = props;
    updateRef.current?.();
  }, [props]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
      renderer.setPixelRatio(cappedDpr(window.devicePixelRatio, "full"));
    } catch {
      settings.current.onFallback();
      return;
    }

    const signals = {
      lite: false, reducedMotion: settings.current.reducedMotion, webgl2: true,
      rendererString: readRendererString(renderer.getContext()),
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      contextLosses: 0, forceGl: forceGlFromSearch(window.location.search), avgFrameMs: 0,
    };
    let tier: GlTier = settings.current.detail ? glTier(signals) : "full";
    if (tier === "svg") { renderer.dispose(); settings.current.onFallback(); return; }
    renderer.setPixelRatio(cappedDpr(window.devicePixelRatio, tier));

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
    const initialTheme = document.documentElement.dataset.theme;
    let sceneTheme = initialTheme === "dark" || initialTheme === "night" ? "dark" : settings.current.theme;
    let pointer: { id: number; x: number; angle: number } | null = null;
    let flowTexture: DataTexture | null = null;
    let controls: OrbitControls | null = null;
    let fitted = false;
    let contextLost = false;
    let visible = true;
    let currentLevel = waterLevel(settings.current.dam.storagePct);
    let targetLevel = currentLevel;
    let tweenTime = 0;
    let watchdog: FrameWatchdog = { samples: [], avgFrameMs: 0 };
    const ghostPlanes: Record<string, Mesh> = {};
    const streams: { key: "release" | "inflow"; points: Points; start: Vector3; end: Vector3 }[] = [];
    const terrainAbort = new AbortController();
    let terrainMesh: Mesh | null = null;

    function applyTier() {
      const next = settings.current.detail ? glTier(signals) : "full";
      if (next === "svg") { fail(); return; }
      tier = next;
      renderer.setPixelRatio(cappedDpr(window.devicePixelRatio, tier));
      settings.current.onTierChange?.(tier);
      for (const stream of streams) {
        const count = tier === "full" ? damStreams(settings.current.dam)[stream.key] : 0;
        stream.points.geometry.setDrawRange(0, count);
        stream.points.visible = count > 0;
      }
    }

    if (settings.current.detail) {
      controls = new OrbitControls(camera, canvas);
      controls.enablePan = false;
      controls.minPolarAngle = 15 * Math.PI / 180;
      controls.maxPolarAngle = 70 * Math.PI / 180;
      controls.addEventListener("change", requestRender);
      // OrbitControls installs touch-action:none; keep vertical page scrolling available.
      canvas.style.touchAction = "pan-y";
    }

    function fail() {
      if (disposed || failed) return;
      failed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      settings.current.onFallback();
    }

    function flowSpeed() {
      const { dam, reducedMotion } = settings.current;
      return tier === "full" && !reducedMotion && Number.isFinite(dam.releaseCms) && (dam.releaseCms ?? 0) > 0
        ? Math.min(2, (dam.releaseCms ?? 0) / 500) : 0;
    }

    function requestRender() {
      if (disposed || failed || contextLost || !visible || document.hidden || frame) return;
      frame = requestAnimationFrame(render);
    }

    function render(time: number) {
      frame = 0;
      if (disposed || failed || contextLost || !visible || document.hidden) return;
      const started = performance.now();
      const delta = previousTime ? time - previousTime : 0;
      const speed = flowSpeed();
      if (flowTexture && speed) {
        if (previousTime) flowOffset = (flowOffset - Math.min(0.1, (time - previousTime) / 1000) * speed) % 1;
        flowTexture.offset.y = flowOffset;
      }
      const tweening = tier === "full" && Math.abs(currentLevel - targetLevel) > 0.001;
      if (tweening && nodes.WaterUp) {
        const elapsed = tweenTime ? Math.min(100, time - tweenTime) : 16;
        currentLevel += (targetLevel - currentLevel) * (1 - Math.exp(-elapsed / 120));
        setLevel(nodes.WaterUp, currentLevel, unitWidth);
      } else if (nodes.WaterUp) {
        currentLevel = targetLevel;
        setLevel(nodes.WaterUp, currentLevel, unitWidth);
      }
      tweenTime = tweening ? time : 0;
      const particle = new Vector3();
      for (const { points, start, end, key } of streams) {
        if (!points.visible) continue;
        if (key === "inflow") start.y = end.y = currentLevel * levelHeight + 0.04;
        const positions = points.geometry.getAttribute("position");
        for (let i = 0; i < 96; i++) {
          const phase = (time / 1400 + i / 96) % 1;
          const p = particle.lerpVectors(start, end, phase);
          p.x += Math.sin(i * 2.4) * 0.08;
          positions.setXYZ(i, p.x, p.y, p.z);
        }
        positions.needsUpdate = true;
      }
      try { renderer.render(scene, camera); }
      catch { fail(); return; }
      if (settings.current.detail && tier === "full") {
        watchdog = sampleFrame(watchdog, Math.max(performance.now() - started, delta));
        // Wait for a representative continuous run, not a single model-upload frame.
        if (watchdog.samples.length === 30 && watchdog.avgFrameMs > 33) {
          signals.avgFrameMs = watchdog.avgFrameMs;
          applyTier();
          currentLevel = targetLevel;
        }
      }
      if (model && tier === "full" && (speed || tweening || streams.some(({ points }) => points.visible))) requestRender();
      previousTime = frame ? time : 0;
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
      if (!controls || !fitted) {
        camera.position.copy(viewDirection).multiplyScalar(distance).add(center);
        if (controls) {
          controls.target.copy(center);
          controls.minDistance = radius * 1.2;
          controls.maxDistance = distance * 2.5;
          controls.update();
          fitted = model !== null;
        }
      }
      camera.far = Math.max(distance + radius * 4, 120);
      if (!controls) camera.lookAt(center);
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
      targetLevel = waterLevel(dam.storagePct);
      if (tier !== "full" || !settings.current.detail) currentLevel = targetLevel;
      if (nodes.WaterUp) setLevel(nodes.WaterUp, currentLevel, unitWidth);
      for (const [name, entry] of [["RimLastYear", history?.lastYear], ["Rim2554", history?.year2554]] as const) {
        const mesh = nodes[name];
        if (!mesh) continue;
        const pct = history?.dataDate === dam.date ? entry?.pct[dam.id] : undefined;
        mesh.visible = !settings.current.detail && pct !== undefined && Number.isFinite(pct);
        if (mesh.visible) setLevel(mesh, waterLevel(pct!), widthAt1);
      }
      for (const [key, mesh] of Object.entries(ghostPlanes)) {
        const ghost = damGhosts(dam, history).find((entry) => entry.key === key);
        mesh.visible = !!ghost;
        if (ghost) setLevel(mesh, waterLevel(ghost.pct), unitWidth);
      }
      applyTier();
      if (terrainMesh) (terrainMesh.material as MeshStandardMaterial).color.set(colors.terrain);
      if (nodes.WaterDown) nodes.WaterDown.visible = (dam.releaseCms ?? 0) > 0;
      previousTime = 0;
      if (!flowSpeed()) { cancelAnimationFrame(frame); frame = 0; }
      resize();
    }

    updateRef.current = () => {
      const theme = document.documentElement.dataset.theme;
      sceneTheme = theme === "dark" || theme === "night" ? "dark" : theme === "light" ? "light" : settings.current.theme;
      update();
    };
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
    function onContextLost(event: Event) {
      event.preventDefault();
      contextLost = true;
      signals.contextLosses++;
      canvas.style.visibility = "hidden";
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      if (!settings.current.detail) fail(); else applyTier();
    }
    function onContextRestored() { contextLost = false; canvas.style.visibility = ""; update(); }
    const visibilityObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      onVisibility();
    });
    visibilityObserver.observe(canvas);
    function onPointerDown(event: PointerEvent) {
      if (controls || failed || pointer || !event.isPrimary || event.button !== 0) return;
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
    canvas.addEventListener("webglcontextrestored", onContextRestored);
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
      if (settings.current.detail) {
        for (const [key, color] of [["lastYear", "#64748b"], ["year2554", "#e11d48"]]) {
          const plane = new Mesh(upstream.geometry, new MeshBasicMaterial({ color,
            transparent: true, opacity: 0.2, depthWrite: false, side: DoubleSide }));
          plane.position.copy(upstream.position);
          plane.rotation.copy(upstream.rotation);
          plane.renderOrder = 2;
          ghostPlanes[key] = plane;
          model.add(plane);
        }
        const crest = new LineSegments(new EdgesGeometry(upstream.geometry), new LineBasicMaterial({ color: "#94a3b8" }));
        crest.position.copy(upstream.position);
        crest.position.y = levelHeight;
        crest.rotation.copy(upstream.rotation);
        crest.scale[widthAxis] = widthAt1 / unitWidth;
        model.add(crest);
        model.updateWorldMatrix(true, true);
        for (const key of ["release", "inflow"] as const) {
          const node = key === "release" ? nodes.WaterDown : upstream;
          const streamBounds = new Box3().setFromObject(node);
          const start = model.worldToLocal(streamBounds.getCenter(new Vector3()));
          const end = start.clone();
          // Schematic paths only: density represents cms, not river velocity or routing.
          if (key === "release") {
            start.copy(model.worldToLocal(new Vector3(streamBounds.max.x - 0.25, streamBounds.max.y, streamBounds.max.z)));
            end.copy(model.worldToLocal(new Vector3(streamBounds.min.x + 0.25, streamBounds.min.y, streamBounds.min.z)));
          } else {
            start.z -= 1.2;
            start.y = end.y = currentLevel * levelHeight + 0.04;
          }
          const geometry = new BufferGeometry();
          geometry.setAttribute("position", new Float32BufferAttribute(new Float32Array(96 * 3), 3));
          const points = new Points(geometry, new PointsMaterial({ color: "#38bdf8", size: 0.06,
            transparent: true, opacity: 0.85, depthWrite: false }));
          points.frustumCulled = false;
          model.add(points);
          streams.push({ key, points, start, end });
        }
        void loadTerrain();
      }
      update();
      resize();
    }).catch(fail);

    async function loadTerrain() {
      const tile = terrariumTile(settings.current.dam.lat, settings.current.dam.lon);
      let bitmap: ImageBitmap | null = null;
      try {
        const response = await fetch(tile.url, { signal: terrainAbort.signal });
        if (!response.ok) return;
        bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none" });
        if (disposed || failed) return;
        const image = document.createElement("canvas");
        image.width = bitmap.width; image.height = bitmap.height;
        const context = image.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height);
        const heights = terrariumGrid(pixels.data, image.width, image.height);
        const geometry = new PlaneGeometry(18, 18, 32, 32);
        geometry.rotateX(-Math.PI / 2);
        const positions = geometry.getAttribute("position");
        const originIndex = Math.round(tile.v * 32) * 33 + Math.round(tile.u * 32);
        const base = heights[originIndex];
        const floor = bounds.min.y - 0.4;
        for (let i = 0; i < positions.count; i++) {
          positions.setXYZ(i, positions.getX(i) + (0.5 - tile.u) * 18,
            floor + (heights[i] - base) / tile.metres * 18 * 4,
            positions.getZ(i) + (0.5 - tile.v) * 18);
        }
        // Leave room for the schematic dam; DEM is geographical context, not bathymetry.
        const indices = geometry.index!;
        const kept: number[] = [];
        for (let i = 0; i < indices.count; i += 3) {
          const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
          if (triangle.every((v) => Math.hypot(positions.getX(v), positions.getZ(v)) > radius * 1.05)) kept.push(...triangle);
        }
        geometry.setIndex(kept);
        geometry.computeVertexNormals();
        terrainMesh = new Mesh(geometry, new MeshStandardMaterial({ color: damSceneColors(sceneTheme, settings.current.dam.band).terrain,
          roughness: 1, side: DoubleSide }));
        scene.add(terrainMesh);
        settings.current.onTerrainLoaded?.();
        requestRender();
      } catch {
        // Optional terrain must never take the dam or its scrubber down with it.
      } finally { bitmap?.close(); }
    }

    return () => {
      disposed = true;
      updateRef.current = null;
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      terrainAbort.abort();
      controls?.dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("lostpointercapture", onPointerEnd);
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
      if (model) disposeModel(model);
      if (terrainMesh) disposeModel(terrainMesh);
      flowTexture?.dispose();
      nodes = {};
      renderer.dispose();
    };
  }, []);

  return <div className="space-y-2" style={{ touchAction: "pan-y" }}>
    <canvas ref={canvasRef} className="aspect-[3/2] w-full rounded-xl" style={{ touchAction: "pan-y" }}
      role="img" aria-label={summary} />
    {!props.detail && <p className="text-muted text-xs">{summary}</p>}
  </div>;
}
