import { describe, expect, it } from "vitest";
import { terrainAvailable, terrainCamera, terrainSource } from "./terrain";

describe("terrainAvailable", () => {
  it.each([
    [undefined, true],
    [2, false],
    [3.9, false],
    [4, true],
    [8, true],
  ])("deviceMemory %s → %s", (memory, expected) => expect(terrainAvailable(memory)).toBe(expected));
});

describe("terrainCamera", () => {
  it("tilts in 3D and flattens in 2D", () => {
    expect(terrainCamera(true, false)).toEqual({ pitch: 55, duration: 800 });
    expect(terrainCamera(false, false)).toEqual({ pitch: 0, duration: 800 });
  });
  it("does not animate under reduced motion", () => {
    expect(terrainCamera(true, true).duration).toBe(0);
  });
});

it("uses Terrarium encoding", () => {
  expect(terrainSource.encoding).toBe("terrarium");
  expect(terrainSource.tiles[0]).toContain("/terrarium/{z}/{x}/{y}.png");
});
