# Plan: finish future radar (model-only) + neon hologram map (Blender) + Vercel deploy

Status: APPROVED (2026-09-28)

## Context
- Phase 1 + 2 of ฟ้าวันนี้ are done and pushed (github.com/Josaha1/fahwanni, main).
- Future-radar plan `docs/plans/radar-nowcast.md` was approved; its spike **failed**: radar
  extrapolation ≈ persistence (CSI +30 min 0.565 vs 0.567, and 0.584 vs 0.586 on a second window).
  Per the plan's gate: drop nowcast A (tasks 7–9) and everything built on it (12 live confidence,
  13 home ETA); keep B (model rain +1–12 h) + unified timeline + "rain at your place" strip.
- New user request: "ทำ 3D แผนที่ และ เรดาห์ ให้สวยล้ำสมัย เท่ๆ ด้วย Blender แล้ว deploy บน vercel".
  User chose **Neon hologram** style and **deploy by importing the GitHub repo** in Vercel.
- Design by Fable (thinker-fable); facts checked by Claude (MapLibre 6.11.2 has setSky/fog,
  raster saturation/contrast/resampling, ImageSource.updateImage; OpenFreeMap dark = 47
  background/fill/line/symbol layers, only "Noto Sans Regular").

## Decisions
- **Map tab is always neon** (dark navy base) regardless of app theme — Claude's call, see below.
- Neon style = pure `neonStyle(ofmDark)` transform applied before `new Map()` (no flicker,
  testable on a committed OFM-dark fixture): recolour by layer id, glow pairs (wide `line-blur`
  under a 1 px crisp line, ids prefixed `neon-`) for coast/borders/rivers/motorways, bright labels
  with dark halo (WCAG ≥ 4.5 checked in tests), `sky` purple→black fog (visible when tilted/3D).
- One shared palette `src/lib/map/neon-palette.ts` feeds radar paint, model-rain ramp, legend
  gradient and wind colours (replaces the ad-hoc colours in `levelToRgba`/`speedColor`).
- Radar: RainViewer scheme 2 kept (legend semantics), `raster-saturation`/`raster-contrast` up,
  linear resampling; no hue-rotate.
- **Blender (baked, committed — Vercel can't run Blender)**:
  1. Hologram terrain plate: Terrarium z6 tiles → 16-bit heightmap (sharp) → Blender displaced
     plane with emissive contour bands + rim light + compositor Glare bloom, top-down ortho,
     tile-aligned Mercator bbox → `public/map/hologram-terrain.webp` ≤ 350 KB → ImageSource under
     water, full at z ≤ 7, fading out by z 9, skipped on saveData, added after first idle.
  2. Typhoon glyph sprite (spinning neon cyclone) via existing `scripts/blender/icons.py` +
     `build.mjs`, used as the storm-centre marker, loaded only when storms exist.
- CSS (not Blender): neon location pin + rotating radar sweep ring (`conic-gradient`), quake
  ripple via `circle-blur`; all stop under `prefers-reduced-motion`. Glass panels for controls.
- Cut: 3D buildings (maxZoom 12), intro animation, Blender pin/sweep, custom fonts.
- Deploy: repo already public on GitHub; user imports it in Vercel; Claude prepares repo and
  verifies the live URL with a script.

## Where Claude disagrees with Fable
- Fable: neon only in dark/night theme. Claude: **always neon on the map tab** — with "auto"
  theme users are in light mode all day and would rarely see the requested look; one style is
  also less code. (User can overrule → light theme keeps positron.)
- Fable marked the typhoon glyph optional; user explicitly asked for Blender, so it stays in.

## Tasks (sequential; Codex while quota lasts, else Claude)
### Part 1 — finish future radar (model-only)
1. Record the spike: commit `scripts/nowcast-spike.mts`, mark tasks 7–9/12/13 as CUT with the
   CSI numbers in `docs/plans/radar-nowcast.md`. Verify: `git show --stat HEAD`
2. Model-rain data: add `precipitation,precipitation_probability` to the existing `/api/wind`
   Open-Meteo request (`src/lib/wind/{client,grid}.ts`, fixture, tests; 12 hourly steps; fields
   optional for old CDN copies). Verify: `npx vitest run src/lib/wind` + live curl `12 12 361`
3. Model-rain render (pure) `src/lib/precip/render.ts` + test (Mercator rows, palette bins,
   probability alpha). Verify: `npx vitest run src/lib/precip`
4. Timeline (pure) `src/lib/timeline/frames.ts` + test (radar past → model future, labels,
   autoplay loops radar only). Verify: `npx vitest run src/lib/timeline`
5. Map wiring: 12 model ImageSources + unified scrubber with "เรดาร์"/"แบบจำลอง" labels and
   segment bar. Verify: typecheck/lint + Chrome (scrub to +3 ชม.)
6. "ฝนที่ตำแหน่งคุณ" strip (radar now + model hours at the place) + test. Verify: vitest + Chrome
### Part 2 — neon hologram
7. Palette + contrast tests `src/lib/map/neon-palette.ts`. Verify: `npx vitest run src/lib/map`
8. Style transform `src/lib/map/neon-style.ts` + OFM-dark fixture + tests. Verify: vitest
9. Wire style into `map-view.tsx` (always neon; theme observer no longer swaps basemap). Verify:
   typecheck + Chrome z3–7, check coast-glow tile seams (fallback: outline-only)
10. Radar/model/wind/legend on palette. Verify: `npx vitest run` + Chrome
11. CSS neon pin + sweep ring + glass panels + storm/quake glow **+ collapsible map controls**
    (user request 2026-09-28: "ช่วยทำให้สามารถย่อตรง control ในแผนที่ให้ด้วย" — layer chips and the
    radar/timeline panel collapse to a small toggle; attribution stays compact/collapsed on small
    screens; state remembered on the device). Done before task 10 at the user's request.
    Verify: Chrome incl. reduced-motion and a phone-width window
12. **SPIKE** hologram plate pipeline (`scripts/map/stitch-dem.mjs`, `scripts/blender/hologram-terrain.py`,
    `scripts/map/build-hologram.mjs`, `src/lib/map/hologram.ts` + test). Verify:
    `node scripts/map/build-hologram.mjs` → file ≤ 358400 bytes + visual check of the render
13. Hologram layer in map (zoom fade, saveData skip, cleanup on style reload, SW cache).
    Verify: typecheck + Chrome Network (map tab ≤ 2.5 MB)
14. Blender typhoon glyph sprite + storm-centre marker. Verify: `node scripts/blender/build.mjs --only typhoon`
### Part 3 — deploy
15. Repo prep: `engines.node`, `.env.example`, README deploy section, `scripts/verify-deploy.mjs`
    (checks `/`, `/map`, `/api/{weather,radar,wind,storms,quakes}`, maplibre worker, `/sw.js`,
    hologram image, `x-vercel-id` region sin1). Verify: build + typecheck + full vitest; push.
16. **User**: rotate the Google API key; import github.com/Josaha1/fahwanni in Vercel; set
    `GOOGLE_MAPS_API_KEY` for Production + Preview; deploy. **Claude**: `node scripts/verify-deploy.mjs <url>`
    + open the live map tab in Chrome.

## Verification (end-to-end)
Every task: its Verify + `npx vitest run` + lint/typecheck, output pasted; visual tasks checked in
Chrome (screenshots). Final: live Vercel URL passes verify-deploy and the map tab shows neon style,
radar, model rain, wind, hologram plate, typhoon marker (mocked if no storm).

## Risks
- Coast glow may show tile seams at low zoom → fallback outline-only.
- Hologram look depends on Blender tuning (spike); fallback: skip plate, keep live neon style.
- Map-tab weight: plate 350 KB + radar + wind within 2.5 MB budget (checked in Task 13).
- API key in chat history → must be rotated before the public deploy.
