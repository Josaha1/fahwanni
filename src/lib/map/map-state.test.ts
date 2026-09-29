import { describe, expect, it } from "vitest";
import { initialMapState, mapReducer } from "./map-state";

describe("map state", () => {
  it("starts with rain and the existing overlay defaults", () => {
    expect(initialMapState()).toEqual({
      primary: "rain", rainOn: true,
      overlays: { wind: true, storms: true, quakes: true, dams: false, terrain: false },
      timeMs: null, playing: false,
    });
  });

  it("starts at a time from the URL", () => {
    expect(initialMapState({ timeMs: 1_800_000 }).timeMs).toBe(1_800_000);
  });

  it("uses URL layer and overlay overrides without changing other defaults", () => {
    expect(initialMapState({ primary: "temp", overlays: { wind: false, storms: false, quakes: true, dams: true, terrain: true } })).toEqual({
      primary: "temp", rainOn: true,
      overlays: { wind: false, storms: false, quakes: true, dams: true, terrain: true },
      timeMs: null, playing: false,
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
    for (const key of ["wind", "storms", "quakes", "dams", "terrain"] as const) {
      const state = { ...initialMapState(), playing: true };
      const changed = mapReducer(state, { type: "toggleOverlay", key });
      expect(changed.overlays[key]).toBe(!state.overlays[key]);
      expect(changed.playing).toBe(true);
      expect(mapReducer(changed, { type: "toggleOverlay", key }).overlays).toEqual(state.overlays);
    }
  });

  it("can explicitly close a failed overlay", () => {
    const state = mapReducer(initialMapState(), { type: "toggleOverlay", key: "dams" });
    expect(mapReducer(state, { type: "setOverlay", key: "dams", enabled: false }).overlays.dams).toBe(false);
  });

  it("selects a time and returns to automatic now", () => {
    const state = initialMapState();
    const selected = mapReducer(state, { type: "setTime", t: 1_800_000 });
    expect(selected.timeMs).toBe(1_800_000);
    expect(mapReducer(selected, { type: "setTime", t: null }).timeMs).toBeNull();
    expect(state.timeMs).toBeNull();
  });

  it("toggles and stops playback", () => {
    const state = initialMapState();
    const playing = mapReducer(state, { type: "togglePlay" });
    expect(playing.playing).toBe(true);
    expect(mapReducer(playing, { type: "togglePlay" }).playing).toBe(false);
    expect(mapReducer(playing, { type: "stop" }).playing).toBe(false);
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
