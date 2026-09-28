import { nextPlayIndex, type TimelineStop } from "@/lib/timeline/frames";

export type MapState = {
  primary: "rain" | "temp" | "pm25";
  rainOn: boolean;
  overlays: { wind: boolean; storms: boolean; quakes: boolean; terrain: boolean };
  activeIndex: number;
  playing: boolean;
};

export type MapAction =
  | { type: "setPrimary"; primary: MapState["primary"] }
  | { type: "toggleRain" }
  | { type: "toggleOverlay"; key: keyof MapState["overlays"] }
  | { type: "setIndex"; index: number }
  | { type: "tick"; stops: TimelineStop[] }
  | { type: "togglePlay" }
  | { type: "stop" }
  | { type: "resetIndex"; index: number };

export function initialMapState(): MapState {
  return {
    primary: "rain",
    rainOn: true,
    overlays: { wind: true, storms: true, quakes: true, terrain: false },
    activeIndex: 0,
    playing: false,
  };
}

export function mapReducer(state: MapState, action: MapAction): MapState {
  switch (action.type) {
    case "setPrimary": return { ...state, primary: action.primary, playing: false };
    case "toggleRain": return { ...state, rainOn: !state.rainOn, playing: false };
    case "toggleOverlay": return { ...state, overlays: { ...state.overlays, [action.key]: !state.overlays[action.key] } };
    case "setIndex": return { ...state, activeIndex: action.index, playing: false };
    case "tick": return { ...state, activeIndex: nextPlayIndex(action.stops, state.activeIndex) };
    case "togglePlay": return { ...state, playing: !state.playing };
    case "stop": return { ...state, playing: false };
    case "resetIndex": return { ...state, activeIndex: action.index };
  }
}
