import { afterEach, expect, it, vi } from "vitest";
import { PerspectiveCamera, Spherical, Vector3 } from "three";
import { attachOrientation, orientationToCamera } from "./orientation";
import { cameraTilt } from "./camera-tilt";

afterEach(() => vi.unstubAllGlobals());

it("maps beta/gamma to camera radians clamped at ±10° without drift", () => {
  const camera = new PerspectiveCamera(); camera.position.set(0, 42, 50);
  const original = camera.position.clone();
  const initial = new Spherical().setFromVector3(original);
  const tilt = cameraTilt(camera, () => new Vector3());
  const maximum = orientationToCamera(180, -90);
  for (let i = 0; i < 100; i++) tilt(maximum);
  const result = new Spherical().setFromVector3(camera.position);
  expect(result.phi - initial.phi).toBeCloseTo(Math.PI / 18);
  expect(result.theta - initial.theta).toBeCloseTo(-Math.PI / 18);
  expect(camera.position.length()).toBeCloseTo(original.length());
  tilt({ pitch: 0, yaw: 0 });
  expect(camera.position.distanceTo(original)).toBeCloseTo(0);
  expect(orientationToCamera(null, NaN)).toEqual({ pitch: 0, yaw: 0 });
  expect(orientationToCamera(-Infinity, Infinity)).toEqual({ pitch: 0, yaw: 0 });
  expect(orientationToCamera(15, -15)).toEqual({ pitch: Math.PI / 36, yaw: -Math.PI / 36 });
});

function setup(result: string | Error = "granted", reduced = false) {
  const requestPermission = result instanceof Error ? vi.fn().mockRejectedValue(result) : vi.fn().mockResolvedValue(result);
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const win = Object.assign(new EventTarget(), { DeviceOrientationEvent: { requestPermission }, matchMedia: () => motion });
  const button = Object.assign(new EventTarget(), { hidden: true, setAttribute: vi.fn() });
  const element = Object.assign(new EventTarget(), { dataset: {} as Record<string, string> });
  vi.stubGlobal("window", win); vi.stubGlobal("document", { hidden: false });
  const onTilt = vi.fn();
  const clean = attachOrientation(element as unknown as HTMLElement, button as unknown as HTMLButtonElement, onTilt);
  const orient = () => win.dispatchEvent(Object.assign(new Event("deviceorientation"), { beta: 90, gamma: 30 }));
  const click = async () => { button.dispatchEvent(new Event("click")); await Promise.resolve(); await Promise.resolve(); };
  return { requestPermission, motion, button, element, onTilt, clean, orient, click };
}

it.each(["denied", new Error("permission unavailable")])("keeps drag on denied or rejected permission: %s", async (permission) => {
  const h = setup(permission);
  expect(h.requestPermission).not.toHaveBeenCalled();
  h.orient(); expect(h.onTilt).not.toHaveBeenCalled();
  await h.click();
  expect(h.requestPermission).toHaveBeenCalledOnce();
  expect(h.element.dataset.tiltState).toBe("drag");
  h.orient(); expect(h.onTilt).not.toHaveBeenCalled();
  h.clean();
});

it("enables only on tap, hands back to drag and stops on reduced motion or cleanup", async () => {
  const h = setup();
  await h.click(); h.orient();
  expect(h.element.dataset.tiltState).toBe("tilt");
  expect(h.onTilt).toHaveBeenLastCalledWith(orientationToCamera(90, 30));
  h.element.dispatchEvent(new Event("pointerdown"));
  expect(h.element.dataset.tiltState).toBe("drag");
  expect(h.onTilt).toHaveBeenLastCalledWith({ pitch: 0, yaw: 0 });
  h.onTilt.mockClear(); h.orient(); expect(h.onTilt).not.toHaveBeenCalled();
  await h.click(); h.motion.matches = true; h.motion.dispatchEvent(new Event("change"));
  expect(h.button.hidden).toBe(true); expect(h.element.dataset.tiltState).toBe("drag");
  h.onTilt.mockClear(); h.orient(); expect(h.onTilt).not.toHaveBeenCalled();
  h.clean();
});

it("never requests permission under reduced motion, and ignores a grant after cleanup", async () => {
  const reduced = setup("granted", true);
  await reduced.click(); expect(reduced.requestPermission).not.toHaveBeenCalled(); reduced.clean();
  const h = setup();
  h.button.dispatchEvent(new Event("click")); h.clean();
  await Promise.resolve(); h.orient();
  expect(h.onTilt).not.toHaveBeenCalled(); expect(h.element.dataset.tiltState).toBe("drag");
});

it("keeps drag when the API is absent", () => {
  vi.stubGlobal("window", {});
  expect(() => attachOrientation({} as HTMLElement, {} as HTMLButtonElement, vi.fn())()).not.toThrow();
});
