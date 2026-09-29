export type MapState = {
  primary: "rain" | "temp" | "pm25";
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
  | { type: "setFocus"; focus: MapState["focus"] };

export function initialMapState(override?: Partial<Pick<MapState, "primary" | "overlays" | "timeMs" | "focus">>): MapState {
  return {
    primary: override?.primary ?? "rain",
    rainOn: true,
    overlays: { wind: true, storms: true, quakes: true, dams: false, terrain: false, ...override?.overlays },
    timeMs: override?.timeMs ?? null,
    playing: false,
    focus: override?.focus ?? null,
  };
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "setPrimary": return { ...state, primary: action.primary, playing: false };
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
  }
}
