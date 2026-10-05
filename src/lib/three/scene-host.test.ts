import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Camera, Scene } from "three";
import type { GlSignals } from "./gl-tier";
import { getSceneHost, SceneHost, type SceneRenderer } from "./scene-host";

const threeMock = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("three", () => ({ WebGLRenderer: class { constructor() { return threeMock.create(); } } }));

class TestElement extends EventTarget {
  attributes = new Map<string, string>();
  style = {};
  hidden = false;
  rect = { left: 20, top: 30, width: 100, height: 80 };
  getBoundingClientRect = vi.fn(() => this.rect);
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  remove = vi.fn();
  getContext = vi.fn();
  get state() { return JSON.parse(this.attributes.get("data-scene-state")!); }
  get element() { return this as unknown as HTMLElement; }
  get canvas() { return this as unknown as HTMLCanvasElement; }
}

class TestObserver {
  static instances: TestObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: IntersectionObserverCallback) { TestObserver.instances.push(this); }
  visible(element: TestElement, isIntersecting = true) {
    this.callback([{ target: element.element, isIntersecting } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

class TestResizeObserver {
  static instances: TestResizeObserver[] = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(readonly callback: () => void) { TestResizeObserver.instances.push(this); }
}

const normal: GlSignals = { lite: false, reducedMotion: false, webgl2: true, contextLosses: 0, forceGl: false };
const environment = { lite: false, reducedMotion: false };
let frames: Map<number, FrameRequestCallback>;
let browser: EventTarget & { innerWidth: number; innerHeight: number; devicePixelRatio: number; location: { search: string } };
let doc: EventTarget & { hidden: boolean; body: { appendChild: ReturnType<typeof vi.fn> }; createElement: ReturnType<typeof vi.fn> };
let renderer: SceneRenderer;
let canvas: TestElement;
let hosts: SceneHost[];
let clock: number;

function host(signals = normal) {
  const result = new SceneHost(renderer, canvas.canvas, signals);
  hosts.push(result);
  return result;
}

function view() {
  const element = new TestElement();
  const options = { scene: {} as Scene, camera: {} as Camera, onFrame: vi.fn(), onTierChange: vi.fn() };
  return { element, options };
}

function tick(time: number) {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(time);
}

beforeEach(() => {
  frames = new Map();
  hosts = [];
  clock = 0;
  let frameId = 0;
  TestObserver.instances = [];
  TestResizeObserver.instances = [];
  canvas = new TestElement();
  canvas.getContext.mockReturnValue({ getExtension: () => null });
  browser = Object.assign(new EventTarget(), {
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 3, location: { search: "" },
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); },
  });
  doc = Object.assign(new EventTarget(), { hidden: false, body: { appendChild: vi.fn() }, createElement: vi.fn(() => canvas) });
  renderer = {
    autoClear: true, setClearColor: vi.fn(), setPixelRatio: vi.fn(), setSize: vi.fn(),
    setScissorTest: vi.fn(), setViewport: vi.fn(), setScissor: vi.fn(), clear: vi.fn(), render: vi.fn(), dispose: vi.fn(),
  };
  threeMock.create.mockReset().mockReturnValue(renderer);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("IntersectionObserver", TestObserver);
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  hosts.forEach((item) => item.dispose());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shared scene host with a mock renderer", () => {
  it("renders scissored visible views on demand and repaints clean views on a shared canvas", () => {
    const shared = host();
    const a = view(), b = view();
    b.element.rect = { left: 200, top: 800, width: 100, height: 80 };
    shared.registerView(a.element.element, a.options);
    shared.registerView(b.element.element, b.options);
    expect(frames.size).toBe(0);
    TestObserver.instances[0].visible(a.element);
    TestObserver.instances[0].visible(b.element);
    expect(frames.size).toBe(1);
    tick(0);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.setSize).toHaveBeenCalledWith(390, 844, false);
    expect(renderer.setViewport).toHaveBeenCalledWith(200, -36, 100, 80);
    expect(renderer.setScissor).toHaveBeenCalledWith(200, 0, 100, 44);
    expect(frames.size).toBe(0);
    shared.markDirty(a.element.element);
    shared.markDirty(a.element.element);
    tick(5000);
    expect(renderer.render).toHaveBeenCalledTimes(4);
    expect(a.options.onFrame).toHaveBeenCalledTimes(2);
    expect(b.options.onFrame).toHaveBeenCalledTimes(1);
    expect(a.options.onFrame.mock.lastCall?.[0].deltaMs).toBe(0);
    expect(a.element.state).toMatchObject({ mode: "full", dirty: false, visible: true, frames: 2 });
    expect(canvas.style).toMatchObject({ position: "fixed", pointerEvents: "none" });
  });

  it("clips from fresh DOM bounds after scrolling and skips invisible or offscreen views", () => {
    const shared = host();
    const a = view(), b = view();
    shared.registerView(a.element.element, a.options);
    shared.registerView(b.element.element, b.options);
    TestObserver.instances[0].visible(a.element);
    tick(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(b.element.getBoundingClientRect).not.toHaveBeenCalled();
    a.element.rect.top = -20;
    browser.dispatchEvent(new Event("scroll"));
    tick(16);
    expect(renderer.setViewport).toHaveBeenLastCalledWith(20, 784, 100, 80);
    expect(renderer.setScissor).toHaveBeenLastCalledWith(20, 784, 100, 60);
    a.element.rect.top = 900;
    shared.markDirty(a.element.element);
    tick(32);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
  });

  it("animates full views, pauses hidden documents, and stops after the last visible view leaves", () => {
    const shared = host();
    const a = view();
    shared.registerView(a.element.element, { ...a.options, animating: true });
    TestObserver.instances[0].visible(a.element);
    tick(0);
    tick(16);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(1);
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(frames.size).toBe(0);
    expect(canvas.hidden).toBe(true);
    doc.hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    tick(5000);
    expect(a.options.onFrame.mock.lastCall?.[0].deltaMs).toBe(0);
    TestObserver.instances[0].visible(a.element, false);
    tick(5016);
    expect(frames.size).toBe(0);
    expect(a.element.state.visible).toBe(false);
  });

  it("does not animate reduced views and can render them after explicit invalidation", () => {
    const shared = host({ ...normal, deviceMemory: 4 });
    const a = view();
    shared.registerView(a.element.element, { ...a.options, animating: true });
    TestObserver.instances[0].visible(a.element);
    tick(0);
    expect(frames.size).toBe(0);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(a.element.state.animating).toBe(false);
    shared.markDirty(a.element.element);
    tick(5000);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(shared.avgFrameMs).toBe(0);
  });

  it("feeds continuous frame time into the fallback ladder, stopping animation at reduced", () => {
    const shared = host();
    const a = view();
    shared.registerView(a.element.element, { ...a.options, animating: true });
    TestObserver.instances[0].visible(a.element);
    tick(0);
    tick(40);
    expect(shared.tier).toBe("reduced");
    expect(shared.avgFrameMs).toBe(40);
    expect(a.element.state).toMatchObject({ mode: "reduced", avgFrameMs: 40 });
    tick(56);
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1);
    expect(frames.size).toBe(0);
    expect(a.options.onTierChange).toHaveBeenLastCalledWith("reduced");
  });

  it("also detects expensive render work on an isolated demand frame", () => {
    const shared = host();
    const a = view();
    vi.mocked(renderer.render).mockImplementation(() => { clock += 40; });
    shared.registerView(a.element.element, a.options);
    TestObserver.instances[0].visible(a.element);
    tick(0);
    expect(shared.tier).toBe("reduced");
  });

  it("resizes the renderer and perspective camera without changing the one-canvas layout", () => {
    const shared = host();
    const a = view();
    const camera = { isPerspectiveCamera: true, aspect: 1, updateProjectionMatrix: vi.fn() };
    shared.registerView(a.element.element, { ...a.options, camera: camera as unknown as Camera });
    TestObserver.instances[0].visible(a.element);
    tick(0);
    expect(camera.aspect).toBe(1.25);
    browser.innerWidth = 800;
    browser.innerHeight = 600;
    a.element.rect.width = 200;
    TestResizeObserver.instances[0].callback();
    tick(16);
    expect(camera.aspect).toBe(2.5);
    expect(renderer.setSize).toHaveBeenLastCalledWith(800, 600, false);
    expect(renderer.setViewport).toHaveBeenLastCalledWith(20, 490, 200, 80);
    expect(frames.size).toBe(0);
  });

  it("retains an invalidation raised inside onFrame", () => {
    const shared = host();
    const a = view();
    a.options.onFrame.mockImplementationOnce(() => shared.markDirty(a.element.element));
    shared.registerView(a.element.element, a.options);
    TestObserver.instances[0].visible(a.element);
    tick(0);
    expect(frames.size).toBe(1);
    tick(16);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(frames.size).toBe(0);
  });

  it("reports SVG and stops scheduling if the renderer fails", () => {
    const shared = host();
    const a = view();
    shared.registerView(a.element.element, { ...a.options, animating: true });
    TestObserver.instances[0].visible(a.element);
    vi.mocked(renderer.render).mockImplementation(() => { throw new Error("GPU unavailable"); });
    tick(0);
    expect(shared.tier).toBe("svg");
    expect(a.element.state.mode).toBe("svg");
    expect(canvas.hidden).toBe(true);
    expect(frames.size).toBe(0);
  });

  it("restores the first context loss, but stays SVG after the second", () => {
    const shared = host();
    const a = view();
    shared.registerView(a.element.element, a.options);
    TestObserver.instances[0].visible(a.element);
    tick(0);
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(shared.contextLosses).toBe(1);
    expect(canvas.hidden).toBe(true);
    expect(frames.size).toBe(0);
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    tick(5000);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    shared.markDirty();
    expect(shared.tier).toBe("svg");
    expect(frames.size).toBe(0);
    expect(canvas.hidden).toBe(true);
    expect(a.element.state).toMatchObject({ mode: "svg", contextLosses: 2, contextLost: false });
  });

  it("publishes custom state and updates the ladder when preferences change", () => {
    const shared = host();
    const a = view();
    shared.registerView(a.element.element, { ...a.options, state: { day: 1, mode: "invented" } });
    shared.setViewState(a.element.element, { day: 2, pct: 110 });
    expect(a.element.state).toMatchObject({ day: 2, pct: 110, mode: "full" });
    shared.updateEnvironment({ ...environment, lite: true });
    expect(a.element.state.mode).toBe("svg");
    expect(canvas.hidden).toBe(true);
    shared.updateEnvironment(environment);
    TestObserver.instances[0].visible(a.element);
    tick(0);
    shared.setAnimating(a.element.element, true);
    tick(16);
    expect(frames.size).toBe(1);
    shared.setAnimating(a.element.element, false);
    tick(32);
    expect(frames.size).toBe(0);
  });

  it("unregisters idempotently, clears stale pixels and disposes observers, listeners and renderer", () => {
    const shared = host();
    const a = view();
    const unregister = shared.registerView(a.element.element, a.options);
    TestObserver.instances[0].visible(a.element);
    tick(0);
    unregister();
    unregister();
    tick(16);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(a.element.attributes.has("data-scene-state")).toBe(false);
    expect(TestObserver.instances[0].unobserve).toHaveBeenCalledTimes(1);
    expect(TestResizeObserver.instances[0].unobserve).toHaveBeenCalledTimes(1);
    shared.dispose();
    shared.dispose();
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(TestObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);
    expect(TestResizeObserver.instances[0].disconnect).toHaveBeenCalledTimes(1);
    browser.dispatchEvent(new Event("scroll"));
    canvas.dispatchEvent(new Event("webglcontextlost"));
    expect(frames.size).toBe(0);
    expect(shared.contextLosses).toBe(0);
    expect(() => shared.registerView(a.element.element, a.options)).toThrow("disposed");
  });
});

describe("lazy singleton", () => {
  it("shares one renderer and canvas across concurrent callers and recreates only after disposal", async () => {
    const [a, b] = await Promise.all([getSceneHost(environment), getSceneHost(environment)]);
    hosts.push(a);
    expect(a).toBe(b);
    expect(threeMock.create).toHaveBeenCalledTimes(1);
    expect(doc.body.appendChild).toHaveBeenCalledTimes(1);
    a.dispose();
    const c = await getSceneHost(environment);
    hosts.push(c);
    expect(c).not.toBe(a);
    expect(threeMock.create).toHaveBeenCalledTimes(2);
  });

  it.each([{ lite: true }, { reducedMotion: true }])("does not load three or probe GL for %o", async (preferences) => {
    const shared = await getSceneHost({ ...environment, ...preferences });
    hosts.push(shared);
    expect(shared.tier).toBe("svg");
    expect(threeMock.create).not.toHaveBeenCalled();
    expect(canvas.getContext).not.toHaveBeenCalled();
  });

  it("falls back on software GL, with the force override read from the URL", async () => {
    canvas.getContext.mockReturnValue({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 37446 }), getParameter: () => "SwiftShader" });
    const fallback = await getSceneHost(environment);
    hosts.push(fallback);
    expect(fallback.tier).toBe("svg");
    expect(threeMock.create).not.toHaveBeenCalled();
    fallback.dispose();
    browser.location.search = "?gl=force";
    const forced = await getSceneHost(environment);
    hosts.push(forced);
    expect(forced.tier).toBe("full");
    expect(threeMock.create).toHaveBeenCalledTimes(1);
  });

  it("can leave initial lite mode without replacing the host, canvas or registered views", async () => {
    const shared = await getSceneHost({ ...environment, lite: true });
    hosts.push(shared);
    const a = view();
    shared.registerView(a.element.element, a.options);
    TestObserver.instances[0].visible(a.element);
    expect(frames.size).toBe(0);
    const [first, second] = await Promise.all([getSceneHost(environment), getSceneHost(environment)]);
    expect(first).toBe(shared);
    expect(second).toBe(shared);
    expect(threeMock.create).toHaveBeenCalledTimes(1);
    expect(doc.body.appendChild).toHaveBeenCalledTimes(1);
    tick(0);
    expect(a.element.state.mode).toBe("full");
    expect(renderer.render).toHaveBeenCalledTimes(1);
    await shared.updateEnvironment({ ...environment, lite: true });
    expect(shared.tier).toBe("svg");
    await shared.updateEnvironment(environment);
    tick(16);
    expect(threeMock.create).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(2);
  });

  it.each(["missing", "throws", "renderer throws"])("falls back when WebGL %s", async (failure) => {
    if (failure === "missing") canvas.getContext.mockReturnValue(null);
    if (failure === "throws") canvas.getContext.mockImplementation(() => { throw new Error("Denied"); });
    if (failure === "renderer throws") threeMock.create.mockImplementation(() => { throw new Error("Unavailable"); });
    const shared = await getSceneHost(environment);
    hosts.push(shared);
    expect(shared.tier).toBe("svg");
    expect(canvas.hidden).toBe(true);
  });
});
