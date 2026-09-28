# Spike: wind particle library (Phase 2, task 9) — 2026-09-28

Input we have: `/api/wind` → 19×19 u/v grid (m/s), 8 time steps (3-hourly), 24 KB JSON / 7.5 KB gzip.
Map: maplibre-gl **6.11.2**.

| Candidate | Result |
|---|---|
| `mapbox-exif-layer` 1.3.4 | ✗ peer `maplibre-gl ^4 \|\| ^5` (we are on v6); also peers `mapbox-gl`, `geotiff`; input is PNG/JPEG/GeoTIFF, not a JSON grid |
| `@geoql/maplibre-gl-wind` | ✗ does not exist on npm (404) |
| `maplibre-gl-wind` 0.2.1 | ✗ requires deck.gl + luma.gl (+300 KB, second GL context) — rejected in plan |
| `@sakitam-gis/maplibre-wind` 2.0.3 | ✗ image-tile input only, 2.2 MB dist, last release 2024-04 (pre-v6), untested with v6 |
| leaflet-velocity / wind-layer | ✗ Leaflet / OpenLayers only |

## Recommendation (Claude)
Write a small in-house **canvas-2D particle overlay** (no dependency):
- a `<canvas>` absolutely positioned over the map, sized to the container, DPR ≤ 1.5
- ~1,200 particles (600 when `deviceMemory < 4`), each advected with `sampleAt()` (already in
  `src/lib/wind/grid.ts`), positions kept in lon/lat and projected with `map.project()` per frame
- trails via semi-transparent fill each frame; colour by speed; respawn after N frames or off-grid
- pause while the map is moving (`movestart`/`moveend`), stop on `prefers-reduced-motion` / `saveData`
  (static arrows instead), cancel rAF on unmount
- ~150 lines, fully under our control, testable pure step function

FPS measurement is done after the layer exists (task 10 Verify), not against a library.

Status: **DECIDED 2026-09-28 — user chose the in-house canvas-2D overlay.**
