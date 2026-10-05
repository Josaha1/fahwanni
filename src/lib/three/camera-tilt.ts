import { Spherical, Vector3, type PerspectiveCamera } from "three";
import type { Tilt } from "./orientation";

export function cameraTilt(camera: PerspectiveCamera, target: () => Vector3) {
  const base = new Spherical();
  let previous: Tilt = { pitch: 0, yaw: 0 };
  return (tilt: Tilt) => {
    const center = target();
    base.setFromVector3(camera.position.clone().sub(center));
    base.phi += tilt.pitch - previous.pitch;
    base.theta += tilt.yaw - previous.yaw;
    base.makeSafe();
    camera.position.copy(new Vector3().setFromSpherical(base).add(center));
    camera.lookAt(center);
    previous = tilt;
  };
}
