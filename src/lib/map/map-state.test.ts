import { describe, expect, it } from "vitest";
import { initialMapState, mapReducer } from "./map-state";
import type { TimelineStop } from "@/lib/timeline/frames";

const stops: TimelineStop[] = [
  { kind: "radar", time: "2026-09-28T07:00:00.000Z", index: 0 },
  { kind: "radar", time: "2026-09-28T07:10:00.000Z", index: 1 },
  { kind: "model", time: "2026-09-28T08:00:00.000Z", index: 0 },
];

describe("map state", () => {
  it("starts with rain and the existing overlay defaults", () => {
    expect(initialMapState()).toEqual({
      primary: "rain", rainOn: true,
      overlays: { wind: true, storms: true, quakes: true, terrain: false },
      activeIndex: 0, playing: false,
    });
  });

  it("sets each primary and stops playback", () => {
    for (const primary of ["temp", "pm25", "rain"] as const) {
      const state = { ...initialMapState(), playing: true };
      expect(mapReducer(state, { type: "setPrimary", primary })).toEqual({ ...state, primary, playing: false });
    }
  });

  it("toggles rain independently and stops playback", () => {
    const state = { ...initialMapState(), playing: true };
    const off = mapReducer(state, { type: "toggleRain" });
    expect(off).toEqual({ ...state, rainOn: false, playing: false });
    expect(mapReducer(off, { type: "toggleRain" }).rainOn).toBe(true);
  });

  it("toggles every overlay without changing playback", () => {
    for (const key of ["wind", "storms", "quakes", "terrain"] as const) {
      const state = { ...initialMapState(), playing: true };
      const changed = mapReducer(state, { type: "toggleOverlay", key });
      expect(changed.overlays[key]).toBe(!state.overlays[key]);
      expect(changed.playing).toBe(true);
      expect(mapReducer(changed, { type: "toggleOverlay", key }).overlays).toEqual(state.overlays);
    }
  });

  it("sets an index and stops playback", () => {
    const state = { ...initialMapState(), playing: true };
    expect(mapReducer(state, { type: "setIndex", index: 2 })).toEqual({ ...state, activeIndex: 2, playing: false });
  });

  it("ticks through radar and model stops before looping", () => {
    const state = { ...initialMapState(), playing: true };
    expect(mapReducer(state, { type: "tick", stops }).activeIndex).toBe(1);
    expect(mapReducer({ ...state, activeIndex: 1 }, { type: "tick", stops }).activeIndex).toBe(2);
    expect(mapReducer({ ...state, activeIndex: 2 }, { type: "tick", stops }).activeIndex).toBe(0);
    expect(mapReducer(state, { type: "tick", stops: [] }).activeIndex).toBe(0);
    expect(mapReducer(state, { type: "tick", stops }).playing).toBe(true);
  });

  it("toggles and stops playback", () => {
    const state = initialMapState();
    const playing = mapReducer(state, { type: "togglePlay" });
    expect(playing.playing).toBe(true);
    expect(mapReducer(playing, { type: "togglePlay" }).playing).toBe(false);
    expect(mapReducer(playing, { type: "stop" }).playing).toBe(false);
  });

  it("resets the index without changing playback", () => {
    const state = { ...initialMapState(), playing: true };
    expect(mapReducer(state, { type: "resetIndex", index: 3 })).toEqual({ ...state, activeIndex: 3 });
  });

  it("does not mutate the current state or overlays", () => {
    const state = initialMapState();
    const snapshot = structuredClone(state);
    const changed = mapReducer(state, { type: "toggleOverlay", key: "wind" });
    expect(state).toEqual(snapshot);
    expect(changed).not.toBe(state);
    expect(changed.overlays).not.toBe(state.overlays);
  });
});
