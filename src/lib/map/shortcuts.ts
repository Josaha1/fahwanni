import type { MapState } from "./map-state";

export type ShortcutAction =
  | { type: "togglePlay" | "toggleWaterPlay" | "help" }
  | { type: "step"; direction: -1 | 1 }
  | { type: "setPrimary"; primary: MapState["primary"] }
  | { type: "setMode"; mode: MapState["mode"] };

type ShortcutEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
};

export function mapShortcut(event: ShortcutEvent, context: { mode: MapState["mode"] }): ShortcutAction | null {
  const tag = event.target?.tagName?.toLowerCase();
  if (event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable
    || tag === "input" || tag === "textarea" || tag === "select") return null;

  switch (event.key) {
    case " ": return { type: context.mode === "water" ? "toggleWaterPlay" : "togglePlay" };
    case "ArrowLeft": return { type: "step", direction: -1 };
    case "ArrowRight": return { type: "step", direction: 1 };
    case "w": case "W": return { type: "setMode", mode: "water" };
    case "a": case "A": return { type: "setMode", mode: "weather" };
    case "?": return { type: "help" };
  }
  if (context.mode !== "weather") return null;
  const primary = ({ "1": "rain", "2": "temp", "3": "heat", "4": "pm25", "5": "cloud", "6": "satellite" } as const)[event.key as "1" | "2" | "3" | "4" | "5" | "6"];
  return primary ? { type: "setPrimary", primary } : null;
}
