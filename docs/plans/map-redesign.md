# Plan: map page redesign — easy, modern, complete (light/dark, no neon)

Status: APPROVED (2026-09-28)

## Context
User (2026-09-28): "ต้องการให้ออกแบบหน้าแผนที่ใหม่ ให้ดูง่าย ล้ำสมัย สวยงาม ฟังก์ชั่นครบ".
Pain points they picked: tapping the map does nothing; colours/symbols unexplained; neon is
uncomfortable. Wanted: tap-anywhere weather, search + GPS on the map, temperature + PM2.5 layers,
fullscreen + share view, "anything else you recommend". Mobile and desktop equally. Look: follow the
app theme (light → light-modern, dark/night → calm-dark, no glow). Blender relief re-rendered to match.
Exploration: `src/components/map/map-view.tsx` is 594 lines, one component; no click handler; no
legends for wind/quake/storm; map rebuilds on place/locale change; play loops radar only.
Design by Fable (thinker-fable); facts checked by Claude (Open-Meteo air-quality multi-point works;
OFM positron + dark share glyphs; positron has Noto Sans Regular/Bold/Italic, dark only Regular).

## Decisions
- **Tap anywhere = the centre of the page.** Point card is 100 % client-side (no Google calls):
  radar pixel at the point, sampled wind/temp/rain/PM2.5 grids, nearest province, nearest
  storm/quake. "ดูพยากรณ์เต็ม" sets the place (source 'search') and opens the forecast tab.
  Tapping a storm/quake opens the card on that item (name, category / place, time, depth, tsunami).
- **One primary layer** (ฝน = radar+model | อุณหภูมิ | PM2.5) + overlays (ลม, พายุ, แผ่นดินไหว, 3D).
  Timeline stops come from the primary; play loops the whole range; wind follows the stop's hour.
- **Legends always visible** for the primary layer (compact chip with numbers); tap → "อ่านแผนที่"
  panel with numbers + Thai words per step and symbol rows for active overlays.
- **Layout.** Mobile: full-bleed map, top search pill with GPS, right action rail (layers, 3D,
  fullscreen, share), bottom sheet peek/half/hidden. Desktop ≥ 1024 px: 360 px left panel + map.
- **Look.** Basemap follows theme via `setStyle` (light = positron transform, dark/night = OFM dark
  transform, no glow layers), frosted panels with opaque-enough backgrounds for contrast. Data
  colours are the same in both themes.
- **Data.** Temperature (+ apparent temp) added to the existing `/api/wind` Open-Meteo request (≤ 10
  variables → no extra quota). PM2.5 from Open-Meteo Air-Quality on the same 19×19 grid via new
  `/api/pm25` (3 h shared cache). Google AQ heatmap tiles rejected (billed per tile).
- **URL state** `?lat&lon&z&layer&t&ov=` (pure `url-state.ts`, `window.history.replaceState` on
  moveend); share via Web Share → clipboard; fullscreen = CSS immersive mode + native when available.
- **Architecture first.** `MapProvider` creates the map once; generic `useStyleEffect` (apply on
  now/style.load/idle, idempotent, reset on style.load); one hook per layer; UI components
  (SearchBar, ActionRail, Sheet/SidePanel, LayerPicker, Legend, TimeScrubber, PointCard). Place
  change = marker move + easeTo; locale change = relabel only.
- **Blender.** Two matte relief plates (`relief-light.webp`, `relief-dark.webp`, ≤ 220 KB each,
  soft hillshade, faint hypsometric tint, no contours/bloom, sea transparent); calm typhoon sprite.
  Only the active theme's plate loads.

## Where Claude disagrees with Fable
1. **Rain colours:** Fable proposed a new pale-blue → purple ramp, which would not match the
   RainViewer radar tiles (scheme 2: blue → yellow → red) shown on the same timeline. Claude: the
   model-rain ramp and the legend are defined **from the radar tile colours** so past (radar) and
   future (model) read the same; only temperature and PM2.5 get new ramps.
2. **PM2.5 mismatch:** Open-Meteo CAMS (map) and Google AQ (home card) differ a lot (Bangkok now:
   5.6 vs 16.8 µg/m³). Claude: label the map layer "ค่าประมาณจากแบบจำลอง (CAMS)" in the legend and
   point card, and add a note that the forecast tab shows the station-based value.

## Tasks (1 Codex dispatch each; Claude verifies diff + Verify + Chrome)
1. `use-style-effect.ts` + `map-provider.tsx`; map-view uses the provider, same behaviour.
   Verify: `npm run typecheck && npx vitest run src/lib/map` + Chrome smoke (map loads, radar)
2. Extract layer hooks (radar, model rain via `use-scalar-layer`, storms, quakes, terrain, plate,
   place marker); main map created once. Verify: typecheck/lint + Chrome: change place → recentre, no rebuild
3. `map-state.ts` reducer (+ tests) + `use-map-data.ts`. Verify: `npx vitest run src/components/map src/lib/map`
4. `palette.ts` + `legend.ts` (rain from radar colours, temp, PM2.5 using existing `pm25Level`
   thresholds; Thai words + numbers) with tests; remove `neon-palette.ts`. Verify: `npx vitest run src/lib/map`
5. `base-style.ts` light/dark transforms + positron fixture + tests (no glow/neon ids, fonts valid,
   style-spec validator 0 errors); remove `neon-style.ts`. Verify: `npx vitest run src/lib/map`
6. `use-base-style.ts` theme → `setStyle`, overlays re-apply. Verify: Chrome theme toggle both ways
7. Layout shell: mobile sheet, desktop side panel, action rail, nav-height CSS var, no max-w on map.
   Verify: Chrome at ~400 px and ≥ 1280 px; lint
8. Search pill (compact SearchBox variant) + GPS. Verify: Chrome search "เชียงใหม่" → flyTo; GPS
9. Unified timeline (per primary; play across radar+model; wind follows hour) + tests.
   Verify: `npx vitest run src/lib/timeline`
10. `probe.ts` + `nearest.ts` (+ tests), `use-probe.ts`, `point-card.tsx`, storm/quake hit-test,
    "ดูอากาศตรงกลางแผนที่" keyboard alternative. Verify: vitest + Chrome tap
11. Legend UI (chip + detail sheet). Verify: Chrome both themes, contrast check
12. Temperature in the wind grid + generic `render-scalar.ts` (+ tests). Verify: `npx vitest run src/lib/wind src/lib/raster src/lib/precip`
13. Temperature layer UI. Verify: Chrome + legend numbers
14. `/api/pm25` + `src/lib/pm25` (+ route tests, shared cache, stale on 429). Verify: vitest + curl
15. PM2.5 layer UI with CAMS label. Verify: Chrome
16. URL state + share + fullscreen (+ `url-state` tests). Verify: vitest + open `/map?lat=13.7&lon=100.5&z=8&layer=temp`
17. Blender relief plates (light/dark) + calm typhoon sprite + `relief.ts` (+ tests). Verify: sizes ≤ 220 KB, vitest
18. Cleanup (neon CSS/assets, dead i18n keys), full regression, push, `npm run verify:deploy https://fahwanni.vercel.app`.
    Verify: `npx vitest run && npm run typecheck && npm run lint && npm run build` + live check

## Verification (end-to-end)
Each task: `git diff`, its Verify, full vitest, lint/typecheck, pasted output; UI tasks checked in
Chrome at phone and desktop widths in light and dark themes (screenshots). Final: deploy via push,
`verify:deploy` 11/11 × 200, live map tested: tap card, search, GPS, temp/PM2.5 layers, share link
reopens the same view, theme switch.

## Risks
- `setStyle` drops custom layers → every layer hook must re-add on style.load (no stale "applied" guards).
- Open-Meteo quota: PM2.5 grid adds ~2.9k calls/day per IP (air-quality API appears to be a separate
  pool — observed working while the forecast API was at 429); keep 3 h shared cache.
- CDN may serve old `/api/wind` JSON for up to 3 h after deploy → new fields optional, temp layer hidden until present.
- iOS Safari has no element fullscreen → CSS immersive mode is primary.
- Large refactor with no component tests → Chrome smoke after every task.

## Out of scope
Wind-speed raster layer, lightning, TMD warning polygons, reverse geocoding, component/e2e test
harness, offline tile caching, English province-name bug on the home page (separate fix).
