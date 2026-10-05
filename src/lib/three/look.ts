import {
  ACESFilmicToneMapping, DataTexture, LinearFilter, PMREMGenerator, RepeatWrapping,
  RGBFormat, SRGBColorSpace, type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export function applyLook(renderer: Pick<WebGLRenderer, "toneMapping" | "toneMappingExposure" | "outputColorSpace">): void {
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = SRGBColorSpace;
}

/** The caller owns the target and must recreate it after a context restore. */
export function makeEnvironment(renderer: WebGLRenderer) {
  const room = new RoomEnvironment();
  const pmrem = new PMREMGenerator(renderer);
  try {
    return pmrem.fromScene(room);
  } finally {
    room.dispose();
    pmrem.dispose();
  }
}

export function waterNormals(size: number): DataTexture {
  if (!Number.isInteger(size) || size < 1) throw new RangeError("Normal map size must be a positive integer");
  const data = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
      // Integer-frequency waves and their analytic slopes stay periodic at both edges.
      const dx = 0.18 * Math.cos(u + 2 * v) + 0.12 * Math.cos(3 * u - v + 0.7);
      const dy = 0.36 * Math.cos(u + 2 * v) - 0.04 * Math.cos(3 * u - v + 0.7)
        + 0.16 * Math.cos(4 * v + 1.3);
      const length = Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 3;
      data[offset] = Math.round((1 - dx / length) * 127.5);
      data[offset + 1] = Math.round((1 - dy / length) * 127.5);
      data[offset + 2] = Math.round((1 + 1 / length) * 127.5);
    }
  }
  const texture = new DataTexture(data, size, size, RGBFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
