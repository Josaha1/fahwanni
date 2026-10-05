# Plan: visual-first flood UI — interactive 3D on every screen, SVG as fallback, a few "ล้ำสมัย" extras

Status: APPROVED 2026-10-05 ("อนุมัติ"). Runs after `docs/plans/flood-first.md` task 7; replaces the UI part of its task 8
(rain page) — the rain data work stays. Task 9–10 of flood-first follow after this plan.

## Context
User (2026-10-05): "ต้องการลดการแสดงเป็นข้อความให้น้อยที่สุด ต้องการแสดงเป็นรูปภาพ หรือ hologram" → first draft had one 3D
piece; user overruled: "ทำ 3D แบบขยับได้จริงๆ และมีอะไรแนะนำที่จะทำให้เว็บนี้ล้ำสมัยขึ้นใส่มาได้เลย".
Design: Fable (two reports); facts checked against the code by Claude.

## Principle (Fable)
3D only where the third axis is real (DEM terrain, water height as % of capacity, radar frames over terrain); never invented
(no extruded provinces, no water depth, no simulated flow). Motion only encodes a number already printed with its `<SourceTime>`.

## Rules
- Each visual = 3D view **or** its SVG fallback + **one caption line** from a pure `visualSummary*()` = aria-label = voice text.
- `<SourceTime>` stays visible. Never "ปลอดภัย"; never "ระดับน้ำ" for rivers; hatch = model ("แบบจำลอง") everywhere.
- Vessels: same size for every dam, height = "% ความจุ", 100 % crest line ("เต็มความจุ"), > 100 % above the crest; not red by itself.
- Satellite: dots/decals at real pixel positions; "จุดตรวจ ไม่ใช่พื้นที่"; cloud = grey stipple. DEM exaggeration printed on the tile.
- Time scrubber shows only reported days; tween = transition only.
- Fallback ladder (same caption at every step):
  - **Full 3D:** particles, terrain, pixel ratio 1.5.
  - **Reduced 3D:** pixel ratio 1, no particles, renders only on gesture.
    - Triggers: device memory ≤ 4 GB, or an average frame time > 33 ms.
  - **SVG:** the 2D visuals.
    - Triggers: lite mode, reduced motion, no WebGL2, a software renderer (SwiftShader or llvmpipe), or a second context loss.
- Budget: ≥ 30 fps on a mid-range Android phone, at most 25 KB gz of new code per screen, GPU memory ≤ 64 MB.
  - three.js stays lazily loaded.
  - MapLibre loads only on /rain and /map.
  - No deck.gl (~300 KB gz, and it duplicates what we already ship).

## What the user sees (Fable)
| Screen | 3D object (real data) | Moves | SVG fallback |
|---|---|---|---|
| Home ใกล้บ้าน | 30 km terrain tile (AWS Terrarium), flood pixels as glowing decals at real positions, cloud stipple, DDPM villages as house billboards, nearest TMD station raining ∝ mm, nearest dam glyph with jet ∝ release | drag rotate/tilt, pinch zoom, phone tilt | radar ring + village icons + rain tube + dam glyph |
| Home ทั้งประเทศ | flat Thailand slab (77 provinces, no extrusion), flood detections as points, event provinces outlined, TMD warning regions pulse | rotate/tilt, 7-day satellite replay | Thailand province SVG map |
| `/water` | 35 identical vessels in one canvas, outlet jet ∝ release, inlet ∝ inflow | shared drag-tilt; tap → drill-down (morph transition) | 35 SVG tanks |
| `/water/dam/[id]` | existing `dam.glb` + valley terrain + ghost water planes (last year, 2554) | orbit/pinch, spillway particles ∝ release, inlet ∝ inflow, 7-day scrubber | big SVG tank with ghost lines |
| `/rain` | MapLibre pitched 55° with terrain, radar frames (past 2 h + nowcast) replaying on terrain, station circles pulsing ∝ mm, model accumulation hatched | map gestures + play/scrub | static radar thumbnail + map image off |
| `/map` | as today + replay control, satellite flood points | gestures + time | — |

## ล้ำสมัย extras (Fable ranked; Claude kept 1–4 + haptics)
1. 7-day time scrubber: dams + daily satellite + radar 2 h.
2. Phone-tilt parallax on the 3D views. iOS asks permission on tap; drag is the fallback.
3. "ฟังสรุป" voice button using the phone's Thai voice, free with no key. Hidden when the phone has no Thai voice.
4. Smooth animated transitions between tabs and from a tank to its dam page. Browsers without support just switch normally.
5. Haptic buzz on warning banners. Android only.

## Tasks (Codex, one per dispatch; Claude verifies diff + Verify + full vitest + Playwright 390 px light/dark)
Playwright headless = software GL → our detector picks SVG; `?gl=force` (test-only) exercises 3D; assert `data-scene-state` JSON, never pixels.
V1. Pure mapping `src/lib/visuals/`: `rainGauge`, `tankFill`, `satelliteRing`, `provinceBins`, `streamRate(cms|mm)` (capped), `visualSummary*()`.
    Verify: `npx vitest run --no-file-parallelism src/lib/visuals` (caps, bins, null → no-data, no "ปลอดภัย"/"ระดับน้ำ")
V2. `/api/flood-now`: `nearMe.samples` (≤ 30 km, cap 400 even thinning) + national `samples` decimated ≤ 3000; counts unchanged.
    Verify: `npx vitest run --no-file-parallelism src/lib/flood src/app/api/flood-now` + Claude curl lengths ≤ 400 / ≤ 3000
V3. Shared 3D foundation `src/lib/three/scene-host.ts` (one renderer, scissor views, IntersectionObserver, render-on-demand, DPR cap)
    + `src/lib/three/gl-tier.ts` (ladder) + `data-scene-state` hook.
    Verify: `npx vitest run --no-file-parallelism src/lib/three`
V4. Dam drill-down interactive: OrbitControls, ghost planes, streams ∝ cms, 7-day scrubber, terrain valley; SVG fallback.
    Files `src/components/water/dam-3d.tsx`, `src/lib/dams/model3d.ts`, `src/components/dams/*`.
    Verify: `npx vitest run --no-file-parallelism src/lib/dams/model3d.test.ts src/components/dams`; Claude Playwright `/water/dam/200101?gl=force` (mode full, day changes) and without `gl` (SVG)
V5. `/water` 35 vessels via SceneHost + SVG tanks. Verify: vitest fixture incl. > 100 %; Claude Playwright: exactly 1 canvas, 35 `[data-scene-state]`
V6. Home ใกล้บ้าน terrain tile (`src/lib/terrain/terrarium.ts` decode + `near-me-3d.tsx`) + SVG ring/tube/glyph; sw.js `cacheFirst` for Terrarium + GIBS tiles.
    Verify: vitest terrarium decode (known pixel → metres), sample → decal positions; Claude Playwright aria-label non-empty, section < 560 px
V7. Home ทั้งประเทศ slab + Thailand SVG (`scripts/build-th-svg.mjs` → `src/lib/visuals/th-provinces.ts`, ≤ 40 KB gz); tap → `?province=`.
    Verify: vitest 77 paths + `node scripts/build-th-svg.mjs --check`; Claude Playwright tap sets `?province=`
V8. `/rain` MapLibre pitched + radar replay + station pulse + model tubes (with flood-first task 8 data).
    Verify: vitest + Claude Playwright `.maplibregl-canvas`, play advances `data-frame-index`
V9. Shared time scrubber + `/map` replay; first confirm GIBS has 7 daily composites. Verify: vitest date math (reported days only); Playwright state attribute
V10. Tilt + view transitions + haptics + voice button. Verify: vitest orientation → camera clamp; Playwright no-permission path falls back to drag
V11. Sweep: lite screenshots of 4 tabs, i18n, bundle delta per route, share image/today-brief still read fine.
     Verify: full vitest + `node scripts/i18n-check.mjs` + build output sizes

## Not in this plan (Claude)
- **Web Push for warnings in your province (Fable #5):** needs a subscription database and a scheduled poller, which means a new service. You said no sign-ups → a separate plan only if you want it.
- **Share as video (Fable #6):** unreliable on iOS, lower value.
- **Also out:** WebXR/AR (no iOS Safari), an AI assistant (needs a key), water depth/flow simulation, new data sources.

## Risks
- **Heavy on cheap phones:** the ladder and the frame-time watchdog decide whether to step down. Claude checks the lite-mode screenshots.
- **Gestures fighting page scroll:** use `touch-action: pan-y` on the 3D views.
- **Open-Meteo quota:** replay must not refetch forecasts.
- **Unverified:**
  - GIBS keeps 7 daily composites.
  - View Transitions works in Next 16.
  - The cost of the national samples.
