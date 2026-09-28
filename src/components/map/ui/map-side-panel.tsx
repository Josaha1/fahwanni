import type { ReactNode } from "react";

export function MapSidePanel({ children }: { children: ReactNode }) {
  return <aside className="map-panel map-side-panel">{children}</aside>;
}
