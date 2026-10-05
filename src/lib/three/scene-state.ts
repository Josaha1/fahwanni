export type SceneState = Record<string, unknown>;

/** Shared JSON hook for view-specific data and host telemetry in Playwright. */
export function writeSceneState(element: Pick<Element, "setAttribute">, state: SceneState): void {
  element.setAttribute("data-scene-state", JSON.stringify(state));
}
