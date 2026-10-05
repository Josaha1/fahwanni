import { beforeEach, expect, it, vi } from "vitest";
import { ACESFilmicToneMapping, NoColorSpace, RepeatWrapping, RGBFormat, SRGBColorSpace, type WebGLRenderer } from "three";
import { applyLook, makeEnvironment, waterNormals } from "./look";

const harness = vi.hoisted(() => ({ roomDispose: vi.fn(), pmremDispose: vi.fn(), fromScene: vi.fn() }));
vi.mock("three", async (original) => ({ ...await original<typeof import("three")>(),
  PMREMGenerator: class { fromScene = harness.fromScene; dispose = harness.pmremDispose; },
}));
vi.mock("three/examples/jsm/environments/RoomEnvironment.js", () => ({
  RoomEnvironment: class { dispose = harness.roomDispose; },
}));
beforeEach(() => { vi.resetAllMocks(); });

it("applies the shared tone mapping and output colour space", () => {
  const renderer: Pick<WebGLRenderer, "toneMapping" | "toneMappingExposure" | "outputColorSpace"> = { toneMapping: 0, toneMappingExposure: 1, outputColorSpace: "" };
  applyLook(renderer);
  expect(renderer).toEqual({ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.1, outputColorSpace: SRGBColorSpace });
});

it("releases temporary environment resources and leaves the target owned by the caller", () => {
  const target = { texture: {}, dispose: vi.fn() };
  harness.fromScene.mockReturnValue(target);
  expect(makeEnvironment({} as WebGLRenderer)).toBe(target);
  expect(harness.fromScene).toHaveBeenCalledOnce();
  expect(harness.roomDispose).toHaveBeenCalledOnce();
  expect(harness.pmremDispose).toHaveBeenCalledOnce();
  expect(target.dispose).not.toHaveBeenCalled();
});

it("releases temporary resources if PMREM generation fails", () => {
  harness.fromScene.mockImplementation(() => { throw new Error("PMREM failed"); });
  expect(() => makeEnvironment({} as WebGLRenderer)).toThrow("PMREM failed");
  expect(harness.roomDispose).toHaveBeenCalledOnce();
  expect(harness.pmremDispose).toHaveBeenCalledOnce();
});

it.each([1, 16, 64])("generates deterministic RGB unit normals at size %i", (size) => {
  const a = waterNormals(size), b = waterNormals(size);
  expect(a.image.data).toEqual(b.image.data);
  expect(a.image.data).not.toBe(b.image.data);
  expect(a.image.width).toBe(size);
  expect(a.image.height).toBe(size);
  expect(a.format).toBe(RGBFormat);
  expect(a.colorSpace).toBe(NoColorSpace);
  expect(a.wrapS).toBe(RepeatWrapping);
  expect(a.wrapT).toBe(RepeatWrapping);
  const data = a.image.data!;
  for (let i = 0; i < data.length; i += 3) {
    const normal = [data[i], data[i + 1], data[i + 2]].map((value) => value / 127.5 - 1);
    // RGB8 encoding introduces at most sqrt(3) / 255 length error.
    expect(Math.abs(Math.hypot(...normal) - 1)).toBeLessThan(Math.sqrt(3) / 255);
    expect(normal[2]).toBeGreaterThan(0);
  }
  a.dispose(); b.dispose();
});

it("keeps the wrap seam as smooth as neighbouring normal samples", () => {
  const texture = waterNormals(128);
  const data = texture.image.data!;
  const difference = (x: number, y: number, nextX: number, nextY: number) =>
    Math.hypot(...[0, 1, 2].map((channel) =>
      (data[(y * 128 + x) * 3 + channel] - data[(nextY * 128 + nextX) * 3 + channel]) / 127.5));
  for (let i = 0; i < 128; i++) {
    expect(difference(127, i, 0, i)).toBeLessThan(0.12);
    expect(difference(i, 127, i, 0)).toBeLessThan(0.12);
  }
  expect(new Set(data).size).toBeGreaterThan(32);
  texture.dispose();
});

it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid normal map size %s", (size) => {
  expect(() => waterNormals(size)).toThrow(RangeError);
});
