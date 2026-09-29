import { describe, expect, it } from "vitest";
import { initialMapState, mapReducer } from "./map-state";

describe("map state", () => {
  it("starts with rain and the existing overlay defaults", () => {
    expect(initialMapState()).toEqual({
      mode: "weather", waterDay: 0, allRoutes: false, primary: "rain", rainOn: true,
      overlays: { wind: true, storms: true, quakes: true, dams: false, terrain: false },
      timeMs: null, playing: false, focus: null,
    });
  });

  it("starts at a time from the URL", () => {
    expect(initialMapState({ timeMs: 1_800_000 }).timeMs).toBe(1_800_000);
  });

  it("uses URL layer and overlay overrides without changing other defaults", () => {
    expect(initialMapState({ primary: "temp", overlays: { wind: false, storms: false, quakes: true, dams: true, terrain: true } })).toEqual({
      mode: "weather", waterDay: 0, allRoutes: false, primary: "temp", rainOn: true,
      overlays: { wind: false, storms: false, quakes: true, dams: true, terrain: true },
      timeMs: null, playing: false, focus: null,
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

  it("keeps a dam route until it is cleared or dams are turned off", () => {
    const damsOn = mapReducer(initialMapState(), { type: "toggleOverlay", key: "dams" });
    const focused = mapReducer(damsOn, { type: "setFocus", focus: { kind: "damRoute", damId: "200101" } });
    expect(focused.focus).toEqual({ kind: "damRoute", damId: "200101" });
    // Unrelated changes (time, playback, other overlays) leave the route alone.
    expect(mapReducer(focused, { type: "setTime", t: 60_000 }).focus).toEqual(focused.focus);
    expect(mapReducer(focused, { type: "toggleOverlay", key: "wind" }).focus).toEqual(focused.focus);
    expect(mapReducer(focused, { type: "setFocus", focus: null }).focus).toBeNull();
    expect(mapReducer(focused, { type: "toggleOverlay", key: "dams" }).focus).toBeNull();
    expect(mapReducer(focused, { type: "setOverlay", key: "dams", enabled: false }).focus).toBeNull();
    expect(mapReducer(focused, { type: "setOverlay", key: "dams", enabled: true }).focus).toEqual(focused.focus);
    expect(initialMapState({ focus: { kind: "damRoute", damId: "1" } }).focus).toEqual({ kind: "damRoute", damId: "1" });
  });

  it("does not mutate the current state or overlays", () => {
    const state = initialMapState();
    const snapshot = structuredClone(state);
    const changed = mapReducer(state, { type: "toggleOverlay", key: "wind" });
    expect(state).toEqual(snapshot);
    expect(changed).not.toBe(state);
    expect(changed.overlays).not.toBe(state.overlays);
  });

  it("water mode turns dams on and stops playback; weather mode drops dams and the route", () => {
    const water = mapReducer({ ...initialMapState(), playing: true }, { type: "setMode", mode: "water" });
    expect(water).toMatchObject({ mode: "water", playing: false, overlays: { dams: true } });
    const focused = mapReducer(water, { type: "setFocus", focus: { kind: "damRoute", damId: "200101" } });
    expect(mapReducer(focused, { type: "setMode", mode: "weather" })).toMatchObject({ mode: "weather", focus: null, overlays: { dams: false } });
    expect(initialMapState({ mode: "water" }).overlays.dams).toBe(true);
    expect(initialMapState({ mode: "water", overlays: { wind: true, storms: true, quakes: true, dams: false, terrain: false } }).overlays.dams).toBe(true);
  });

  it("selects only days 0–7 in water mode and resets on weather", () => {
    const water = initialMapState({ mode: "water", waterDay: 7 });
    expect(water.waterDay).toBe(7);
    expect(mapReducer(water, { type: "setWaterDay", day: 3 }).waterDay).toBe(3);
    expect(mapReducer(water, { type: "setWaterDay", day: 8 })).toBe(water);
    expect(mapReducer(initialMapState(), { type: "setWaterDay", day: 3 }).waterDay).toBe(0);
    expect(mapReducer(water, { type: "setMode", mode: "weather" }).waterDay).toBe(0);
  });

  it("toggles the all-routes overview only in water mode and drops it when leaving", () => {
    expect(mapReducer(initialMapState(), { type: "toggleAllRoutes" }).allRoutes).toBe(false);
    const water = mapReducer(initialMapState(), { type: "setMode", mode: "water" });
    const on = mapReducer(water, { type: "toggleAllRoutes" });
    expect(on.allRoutes).toBe(true);
    expect(mapReducer(on, { type: "setMode", mode: "weather" }).allRoutes).toBe(false);
    expect(initialMapState({ allRoutes: true }).allRoutes).toBe(false);
    expect(initialMapState({ mode: "water", allRoutes: true }).allRoutes).toBe(true);
  });
});
