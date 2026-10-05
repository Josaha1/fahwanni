import { FOCUS } from "../features";

export type MapState = {
  /** "weather": forecast layers + time bar; "water": dams and their downstream routes (observed daily data). */
  mode: "weather" | "water";
  waterDay: number;
  /** Water mode: every dam's downstream route drawn faintly (overview). */
  allRoutes: boolean;
  primary: "rain" | "temp" | "pm25" | "heat" | "cloud" | "satellite";
  rainOn: boolean;
  overlays: { wind: boolean; storms: boolean; quakes: boolean; dams: boolean; terrain: boolean };
  /** Selected time in epoch ms; null follows "now". */
  timeMs: number | null;
  playing: boolean;
  /** A dam's downstream route kept on the map until explicitly cleared (not tied to the open card). */
  focus: { kind: "damRoute"; damId: string } | null;
};

export type MapAction =
  | { type: "setPrimary"; primary: MapState["primary"] }
  | { type: "toggleRain" }
  | { type: "toggleOverlay"; key: keyof MapState["overlays"] }
  | { type: "setOverlay"; key: keyof MapState["overlays"]; enabled: boolean }
  | { type: "setTime"; t: number | null }
  | { type: "togglePlay" }
  | { type: "stop" }
  | { type: "setFocus"; focus: MapState["focus"] }
  | { type: "setMode"; mode: MapState["mode"] }
  | { type: "setWaterDay"; day: number }
  | { type: "toggleAllRoutes" };

export function initialMapState(override?: Partial<Pick<MapState, "mode" | "waterDay" | "allRoutes" | "primary" | "overlays" | "timeMs" | "focus">>, focus: "flood" | "all" = FOCUS): MapState {
  const mode = override?.mode ?? (focus === "flood" ? "water" : "weather");
  const waterDay = override?.waterDay ?? 0;
  return {
    mode,
    allRoutes: mode === "water" && override?.allRoutes === true,
    waterDay: mode === "water" && Number.isInteger(waterDay) && waterDay >= 0 && waterDay <= 7 ? waterDay : 0,
    primary: focus === "flood" ? "rain" : override?.primary ?? "rain",
    rainOn: true,
    overlays: { wind: true, storms: true, quakes: true, dams: false, terrain: false, ...override?.overlays,
      ...(focus === "flood" ? { wind: false, storms: false, quakes: false } : {}),
      ...(mode === "water" ? { dams: true } : {}) },
    timeMs: override?.timeMs ?? null,
    playing: false,
    focus: override?.focus ?? null,
  };
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "setPrimary": return { ...state, primary: FOCUS === "flood" ? "rain" : action.primary, playing: false };
    case "toggleRain": return { ...state, rainOn: !state.rainOn, playing: false };
    case "toggleOverlay": return { ...state, overlays: { ...state.overlays, [action.key]: !state.overlays[action.key] },
      focus: action.key === "dams" && state.overlays.dams ? null : state.focus };
    // Turning dams off also drops a dam route: there is nothing left on the map to follow.
    case "setOverlay": return { ...state, overlays: { ...state.overlays, [action.key]: action.enabled },
      focus: action.key === "dams" && !action.enabled ? null : state.focus };
    case "setTime": return { ...state, timeMs: action.t };
    case "togglePlay": return { ...state, playing: !state.playing };
    case "stop": return { ...state, playing: false };
    case "setFocus": return { ...state, focus: action.focus };
    case "setWaterDay": return state.mode === "water" && Number.isInteger(action.day) && action.day >= 0 && action.day <= 7
      ? { ...state, waterDay: action.day } : state;
    case "toggleAllRoutes": return state.mode === "water" ? { ...state, allRoutes: !state.allRoutes } : state;
    // Dams belong to water mode; leaving it drops the route too.
    case "setMode": return action.mode === "water"
      ? { ...state, mode: "water", overlays: { ...state.overlays, dams: true }, playing: false }
      : { ...state, mode: "weather", waterDay: 0, allRoutes: false, overlays: { ...state.overlays, dams: false }, focus: null, playing: false };
  }
}
