export type Tilt = { pitch: number; yaw: number };

// Degrees stay bounded before conversion, including invalid or unavailable sensor values.
export function orientationToCamera(beta: number | null, gamma: number | null): Tilt {
  const angle = (value: number | null) => value !== null && Number.isFinite(value)
    ? Math.max(-10, Math.min(10, value / 3)) * Math.PI / 180 : 0;
  return { pitch: angle(beta), yaw: angle(gamma) };
}

export function attachOrientation(element: HTMLElement, button: HTMLButtonElement | null, onTilt: (tilt: Tilt) => void) {
  if (!button || typeof window === "undefined" || !window.DeviceOrientationEvent) return () => {};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active = false, disposed = false, pending = false;
  const stop = () => {
    if (active) onTilt({ pitch: 0, yaw: 0 });
    active = false;
    window.removeEventListener("deviceorientation", orient);
    element.dataset.tiltState = "drag";
    button.setAttribute("aria-pressed", "false");
  };
  const orient = (event: DeviceOrientationEvent) => {
    if (motion.matches || document.hidden) return;
    onTilt(orientationToCamera(event.beta, event.gamma));
  };
  const enable = async () => {
    if (pending || motion.matches) return;
    if (active) { stop(); return; }
    pending = true;
    try {
      const sensor = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
      const granted = !sensor.requestPermission || await sensor.requestPermission() === "granted";
      if (!disposed && !motion.matches && granted) {
        active = true;
        element.dataset.tiltState = "tilt";
        button.setAttribute("aria-pressed", "true");
        window.addEventListener("deviceorientation", orient);
      } else stop();
    } catch { stop(); }
    finally { pending = false; }
  };
  const preference = () => { button.hidden = motion.matches; if (motion.matches) stop(); };
  // A drag takes over the camera until the user explicitly enables tilt again.
  const drag = (event: PointerEvent) => { if (event.target !== button) stop(); };
  stop(); preference();
  button.addEventListener("click", enable);
  element.addEventListener("pointerdown", drag);
  motion.addEventListener("change", preference);
  return () => {
    disposed = true; stop(); button.hidden = true;
    button.removeEventListener("click", enable);
    element.removeEventListener("pointerdown", drag);
    motion.removeEventListener("change", preference);
  };
}
