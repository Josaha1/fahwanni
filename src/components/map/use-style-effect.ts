"use client";

import { useEffect, type DependencyList } from "react";
import type { Map } from "maplibre-gl";

/**
 * Keeps a custom source/layer on the map across style reloads.
 *
 * Contract:
 * - `apply(map)` runs now, again on every `style.load` (a `setStyle` drops all custom
 *   sources/layers) and on every `idle`. A style that has not loaded yet can reject
 *   a source/layer; the next event retries without waiting for raster tiles to load.
 * - `apply` must therefore be idempotent: check `getSource`/`getLayer` before adding and only
 *   update paint/data when it differs. Do not keep "already applied" flags outside the map —
 *   they would survive a style reload and skip the re-add.
 * - `remove(map)` runs when `deps` change or the component unmounts (guarded, never throws).
 */
export function useStyleEffect(map: Map | null, apply: (map: Map) => void, remove: (map: Map) => void, deps: DependencyList): void {
  useEffect(() => {
    if (!map) return;
    const run = () => {
      try { apply(map); } catch { /* A style that has not loaded yet can reject a layer; the next event retries. */ }
    };
    run();
    map.on("style.load", run);
    map.on("idle", run);
    return () => {
      map.off("style.load", run);
      map.off("idle", run);
      try { if (map.getStyle()) remove(map); } catch { /* The map may already be removed. */ }
    };
    // `apply`/`remove` are expected to change with `deps`; callers list what they read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ...deps]);
}
