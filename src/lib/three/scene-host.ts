import type { Camera, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { forceGlFromSearch, glTier, readRendererString, type GlSignals, type GlTier } from "./gl-tier";
import { cappedDpr, sampleFrame, scissorRects, shouldRender, type FrameWatchdog, type ViewFlags } from "./scene-logic";
import type * as Look from "./look";
import { writeSceneState, type SceneState } from "./scene-state";

export type SceneEnvironment = Pick<GlSignals, "lite" | "reducedMotion" | "deviceMemory">;
export type FrameInfo = { time: number; deltaMs: number; width: number; height: number; tier: GlTier };
export type ViewOptions = {
  scene: Scene;
  camera: Camera;
  onFrame?: (frame: FrameInfo) => void;
  onTierChange?: (tier: GlTier) => void;
  animating?: boolean;
  state?: SceneState;
};
type View = ViewFlags & { options: ViewOptions; state: SceneState; frames: number; drawable: boolean };
export type SceneRenderer = Pick<WebGLRenderer,
  "toneMapping" | "toneMappingExposure" | "outputColorSpace" | "autoClear" | "setClearColor" | "setPixelRatio" | "setSize" | "setScissorTest" | "setViewport" | "setScissor" | "clear" | "render" | "dispose">;
type RendererInit = { renderer: SceneRenderer | null; webgl2: boolean; rendererString?: string | null; look?: typeof Look };

/** Use getSceneHost in the browser; the constructor also accepts a mock renderer for unit tests. */
export class SceneHost {
  private views = new Map<HTMLElement, View>();
  private observer: IntersectionObserver;
  private resizeObserver: ResizeObserver;
  private signals: GlSignals;
  private watchdog: FrameWatchdog = { samples: [], avgFrameMs: 0 };
  private frame: number | null = null;
  private previousTime: number | null = null;
  private layoutDirty = false;
  private contextLost = false;
  private disposed = false;
  private width = 0;
  private height = 0;
  private dpr = 0;
  private mode: GlTier;
  private performanceReduced = false;
  private initializing: Promise<RendererInit> | null = null;
  private canvasAttached = false;
  private environment: ReturnType<typeof Look.makeEnvironment> | null = null;

  constructor(private renderer: SceneRenderer | null, readonly canvas: HTMLCanvasElement, signals: GlSignals,
    private initialize?: (environment: SceneEnvironment) => Promise<RendererInit>, private look?: typeof Look) {
    this.signals = { ...signals };
    this.mode = glTier(signals);
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
    canvas.setAttribute("aria-hidden", "true");
    if (renderer) {
      renderer.autoClear = false;
      renderer.setClearColor(0x000000, 0);
      this.look?.applyLook(renderer);
      if (this.look && this.mode !== "svg") this.environment = this.look.makeEnvironment(renderer as WebGLRenderer);
    }
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const view = this.views.get(entry.target as HTMLElement);
        if (!view) continue;
        view.visible = entry.isIntersecting;
        view.drawable = true;
        view.dirty = true;
        this.publish(entry.target as HTMLElement, view);
      }
      this.invalidateLayout();
    });
    this.resizeObserver = new ResizeObserver(this.invalidateLayout);
    window.addEventListener("resize", this.invalidateLayout);
    // Capture includes scrolling containers, not just the document viewport.
    window.addEventListener("scroll", this.invalidateLayout, true);
    document.addEventListener("visibilitychange", this.onVisibility);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored);
    this.syncCanvas();
  }

  get tier(): GlTier { return this.mode; }
  get avgFrameMs(): number { return this.watchdog.avgFrameMs; }
  get contextLosses(): number { return this.signals.contextLosses; }
  get isDisposed(): boolean { return this.disposed; }

  registerView(element: HTMLElement, options: ViewOptions): () => void {
    if (this.disposed) throw new Error("SceneHost is disposed");
    if (this.views.has(element)) throw new Error("Scene view is already registered");
    const view: View = { options, state: options.state ?? {}, visible: false, dirty: true, animating: options.animating ?? false, frames: 0, drawable: true };
    if (this.environment) options.scene.environment = this.environment.texture;
    this.views.set(element, view);
    this.observer.observe(element);
    this.resizeObserver.observe(element);
    this.publish(element, view);
    options.onTierChange?.(this.mode);
    return () => {
      if (this.views.get(element) !== view) return;
      if (options.scene.environment === this.environment?.texture) options.scene.environment = null;
      this.views.delete(element);
      this.observer.unobserve(element);
      this.resizeObserver.unobserve(element);
      element.removeAttribute("data-scene-state");
      this.invalidateLayout();
    };
  }

  markDirty(element?: HTMLElement): void {
    if (this.disposed) return;
    for (const [el, view] of this.views) {
      if (element && el !== element) continue;
      view.dirty = true;
      this.publish(el, view);
    }
    this.schedule();
  }

  setAnimating(element: HTMLElement, animating: boolean): void {
    const view = this.views.get(element);
    if (!view) return;
    view.animating = animating;
    this.markDirty(element);
  }

  setViewState(element: HTMLElement, state: SceneState): void {
    const view = this.views.get(element);
    if (!view) return;
    view.state = state;
    this.markDirty(element);
  }

  async updateEnvironment(environment: SceneEnvironment): Promise<void> {
    if (this.disposed) return;
    const changed = this.signals.lite !== environment.lite || this.signals.reducedMotion !== environment.reducedMotion
      || (environment.deviceMemory !== undefined && environment.deviceMemory !== this.signals.deviceMemory);
    this.signals = { ...this.signals, ...environment, deviceMemory: environment.deviceMemory ?? this.signals.deviceMemory };
    this.updateTier();
    if (changed) this.markDirty();
    if (!this.renderer && this.initialize && (changed || this.initializing)
      && !environment.lite && !environment.reducedMotion && this.contextLosses < 2) {
      const pending = this.initializing ??= this.initialize(this.signals);
      const result = await pending;
      if (this.initializing !== pending) return;
      this.initializing = null;
      if (this.disposed) { result.renderer?.dispose(); return; }
      this.renderer = result.renderer;
      this.look = result.look ?? this.look;
      this.signals.webgl2 = result.webgl2;
      this.signals.rendererString = result.rendererString;
      if (this.renderer) {
        this.renderer.autoClear = false;
        this.renderer.setClearColor(0x000000, 0);
        if (this.look) {
          this.look.applyLook(this.renderer);
          this.environment = this.look.makeEnvironment(this.renderer as WebGLRenderer);
          for (const view of this.views.values()) view.options.scene.environment = this.environment.texture;
        }
      }
      this.updateTier();
      this.markDirty();
    }
  }

  private publish(element: HTMLElement, view: View): void {
    writeSceneState(element, {
      ...view.state, mode: this.mode, visible: view.visible, dirty: view.dirty,
      animating: this.mode === "full" && view.animating, frames: view.frames,
      avgFrameMs: this.avgFrameMs, contextLosses: this.contextLosses, contextLost: this.contextLost,
    });
  }

  private syncCanvas(): void {
    this.canvas.hidden = this.mode === "svg" || this.contextLost || document.hidden || this.views.size === 0;
    if (this.mode === "svg") {
      this.cancel();
      this.disposeEnvironment();
      this.renderer?.dispose();
      this.renderer = null;
      if (this.canvasAttached) this.canvas.remove();
      this.canvasAttached = false;
      this.width = this.height = this.dpr = 0;
    } else if (this.renderer && !this.canvasAttached) {
      document.body.appendChild(this.canvas);
      this.canvasAttached = true;
    }
  }

  private updateTier(): void {
    let next = glTier(this.signals);
    // Cheap gesture frames must not re-enable particles after the watchdog has stepped down.
    if (this.performanceReduced && next === "full") next = "reduced";
    if (next !== this.mode) {
      this.mode = next;
      for (const [element, view] of this.views) {
        view.dirty = true;
        this.publish(element, view);
        view.options.onTierChange?.(next);
      }
    }
    this.syncCanvas();
  }

  private invalidateLayout = (): void => {
    if (this.disposed) return;
    this.layoutDirty = true;
    for (const view of this.views.values()) view.drawable = true;
    this.markDirty();
  };

  private schedule(): void {
    this.syncCanvas();
    if (this.disposed || !this.renderer || this.mode === "svg" || this.contextLost || document.hidden || this.frame !== null) return;
    if (!this.layoutDirty && ![...this.views.values()].some((view) => view.drawable && shouldRender(view, this.mode))) return;
    this.frame = window.requestAnimationFrame(this.render);
  }

  private cancel(): void {
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.previousTime = null;
  }

  private render = (time: number): void => {
    this.frame = null;
    const renderer = this.renderer;
    if (this.disposed || !renderer || this.mode === "svg" || this.contextLost || document.hidden) {
      this.previousTime = null;
      return;
    }
    const started = performance.now();
    const deltaMs = this.previousTime === null ? 0 : time - this.previousTime;
    const width = window.innerWidth, height = window.innerHeight;
    const dpr = cappedDpr(window.devicePixelRatio, this.mode);
    if (width !== this.width || height !== this.height || dpr !== this.dpr) {
      this.width = width;
      this.height = height;
      this.dpr = dpr;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
    }
    // A shared canvas must redraw clean views too when another view changes or disappears.
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    renderer.setScissorTest(true);
    this.layoutDirty = false;
    let rendered = false;
    for (const [element, view] of this.views) {
      if (!view.visible) continue;
      const rect = element.getBoundingClientRect();
      const regions = scissorRects(rect, width, height);
      view.drawable = regions !== null;
      if (!regions) continue;
      const update = shouldRender(view, this.mode);
      view.dirty = false;
      const camera = view.options.camera;
      if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
        const perspective = camera as PerspectiveCamera;
        perspective.aspect = rect.width / rect.height;
        perspective.updateProjectionMatrix();
      }
      if (update) view.options.onFrame?.({ time, deltaMs, width: rect.width, height: rect.height, tier: this.mode });
      const { viewport, scissor } = regions;
      renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
      renderer.setScissor(scissor.x, scissor.y, scissor.width, scissor.height);
      renderer.clear(true, true, true);
      try { renderer.render(view.options.scene, camera); }
      catch {
        this.signals.webgl2 = false;
        this.updateTier();
        this.previousTime = null;
        for (const [el, current] of this.views) this.publish(el, current);
        return;
      }
      view.frames++;
      rendered = true;
    }
    if (rendered) {
      // Inter-frame time is sampled only in a continuous run, never across idle/hidden periods.
      this.watchdog = sampleFrame(this.watchdog, Math.max(performance.now() - started, deltaMs));
      this.signals.avgFrameMs = this.watchdog.avgFrameMs;
      if (this.watchdog.avgFrameMs > 33) this.performanceReduced = true;
      this.updateTier();
    }
    for (const [element, view] of this.views) this.publish(element, view);
    this.schedule();
    this.previousTime = this.frame === null ? null : time;
  };

  private onVisibility = (): void => {
    this.cancel();
    this.invalidateLayout();
  };

  private onContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.disposeEnvironment();
    this.signals.contextLosses++;
    this.cancel();
    this.updateTier();
    for (const [element, view] of this.views) this.publish(element, view);
  };

  private onContextRestored = (): void => {
    if (this.renderer && this.look && this.contextLost) {
      this.environment = this.look.makeEnvironment(this.renderer as WebGLRenderer);
      for (const view of this.views.values()) view.options.scene.environment = this.environment.texture;
    }
    this.contextLost = false;
    this.updateTier();
    this.invalidateLayout();
  };

  private disposeEnvironment(): void {
    if (!this.environment) return;
    for (const view of this.views.values()) {
      if (view.options.scene.environment === this.environment.texture) view.options.scene.environment = null;
    }
    this.environment.dispose();
    this.environment = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.invalidateLayout);
    window.removeEventListener("scroll", this.invalidateLayout, true);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    for (const element of this.views.keys()) element.removeAttribute("data-scene-state");
    this.disposeEnvironment();
    this.views.clear();
    // Scenes, geometries and materials belong to their view, not to the shared host.
    this.renderer?.dispose();
    this.canvas.remove();
  }
}

let sharedHost: Promise<SceneHost> | null = null;

async function initializeRenderer(canvas: HTMLCanvasElement, environment: SceneEnvironment, forceGl: boolean): Promise<RendererInit> {
  const signals: GlSignals = {
    ...environment, webgl2: false, contextLosses: 0, forceGl,
  };
  let renderer: WebGLRenderer | null = null;
  let look: typeof Look | undefined;
  if (!signals.lite && !signals.reducedMotion) {
    try {
      const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
      signals.webgl2 = context !== null;
      signals.rendererString = readRendererString(context);
      if (context && glTier(signals) !== "svg") {
        const { WebGLRenderer } = await import("three");
        look = await import("./look");
        renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
      }
    } catch {
      signals.webgl2 = false;
    }
  }
  return { renderer, webgl2: signals.webgl2, rendererString: signals.rendererString, look };
}

async function createSceneHost(environment: SceneEnvironment): Promise<SceneHost> {
  const canvas = document.createElement("canvas");
  const signals: GlSignals = {
    ...environment, deviceMemory: environment.deviceMemory ?? (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    webgl2: false, contextLosses: 0, forceGl: forceGlFromSearch(window.location.search),
  };
  const initialize = (env: SceneEnvironment) => initializeRenderer(canvas, env, signals.forceGl);
  const result = await initialize(signals);
  signals.webgl2 = result.webgl2;
  signals.rendererString = result.rendererString;
  return new SceneHost(result.renderer, canvas, signals, initialize, result.look);
}

/** Concurrent callers share one lazy import, renderer and fixed canvas. */
export async function getSceneHost(environment: SceneEnvironment): Promise<SceneHost> {
  if (typeof window === "undefined") throw new Error("SceneHost requires a browser");
  const pending = sharedHost ??= createSceneHost(environment);
  let host: SceneHost;
  try { host = await pending; }
  catch (error) { if (sharedHost === pending) sharedHost = null; throw error; }
  if (host.isDisposed) {
    if (sharedHost === pending) sharedHost = null;
    return getSceneHost(environment);
  }
  await host.updateEnvironment(environment);
  return host;
}
