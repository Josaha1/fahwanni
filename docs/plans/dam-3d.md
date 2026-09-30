# Plan: 3D dam "gauge" — Blender model + Three.js (try-out that ships as a real feature)

Status: APPROVED 2026-09-30.
dispatch (model from `~/.claude/bin/codex-latest-model.sh --sync`, effort medium). Claude checks each task (diff, Verify,
regression, headless screenshot) and commits. Push happens at the end.

## Context
User (2026-09-30): "ต้องการให้ลองใช้งาน Blender + Three.js เพื่อสร้างอะไรซักอย่างที่ควรทำเป็น 3D ให้หน่อย".
Blender 4.5.14 LTS is already installed (`~/Applications/Blender.app`), and the repo already drives it headless
(`scripts/blender/build.mjs` + `icons.py`, `relief-terrain.py`, `app-icon.py`). Three.js is not a dependency yet.
Fable picked **the dam**. One model is reused for all 35 RID dams, and it shows in one picture what the card currently
spreads over five numbers: how full the reservoir is, compared with last year and with 2554, and how much water is being released now.
3D is still a *schematic*, not measured water levels — the page must say so every time.

## What it is
A **"ดูแบบ 3 มิติ" button on the dam card** (map + /water) opens a dialog with a low-poly model of a valley, a dam wall and a spillway:
- the water surface rises with `storagePct`, using a fixed schematic curve (not the real bathymetry)
- two thin rings mark last year's and 2554's level on the same day (from `/api/dams-history`, which already exists)
- the water colour follows the dam's band (the same colours as the map), switching for dark/light while the dialog is open
- water over the spillway moves at a speed that scales with `releaseCms` (stops under reduced motion)
- it can be rotated by dragging only; no auto-rotate; the camera is fixed at a 3/4 angle
- a clear label: "แผนภาพ ไม่ใช่ระดับน้ำจริง"
- **2D fallback = an SVG cross-section** with the same data and labels. It is used when: lite mode is on, reduced motion is on,
  there is no WebGL, the model fails to load, or the WebGL context is lost. The SVG also serves as the loading placeholder.
- a11y: the canvas gets `role="img"` + an `aria-label` summary; the same sentence is visible under the picture.

## Blender vs Three.js
- **Blender (headless, checked into the repo):** `scripts/blender/dam.py` builds the model with named objects `Basin`, `Wall`, `Spillway`,
  `WaterUp` (unit plane with height 0–1), `WaterDown`, `RimLastYear`, `Rim2554`. Ambient occlusion is baked into vertex colours (no textures), under 15k triangles,
  exported to `public/models/dam.glb` (target ≤ 150 KB, max 300 KB, no Draco). The script header pins Blender 4.5.
- **Three.js (raw three, not R3F):** GLTFLoader, set `WaterUp`/rims from the data, colours at runtime, UV-scroll on `WaterDown`,
  ResizeObserver, dispose on close. The `three` chunk is loaded only when the button is tapped
  (`next/dynamic(..., { ssr:false })`, same as `src/app/map/page.tsx`). Home and /water first load must not change.
  Why not R3F: adds 60–100 KB + reconciler that must match React 19/Next 16 for a single scene.

## Tasks (in order)
1. **Pure logic + tests** — `src/lib/dams/model3d.ts`: `waterLevel(pct)` (fixed schematic curve, clamped to 0–1.1 so
   over 100% still shows), `damSceneColors(theme, band)` (reuse the band colours from `damBandColor` in the map),
   `damSceneSummary(dam, history, t)` next to `damSparklineSummary` in `src/lib/chart-summaries.ts`.
   Verify: `npx vitest run --no-file-parallelism src/lib/dams/model3d.test.ts src/lib/chart-summaries.test.ts`
   **Decided by Claude (2026-09-30, Codex asked):** `waterLevel(pct) = Math.sqrt(clamp(pct, 0, 121) / 100)` (volume ∝ height² —
   V-shaped valley): 0→0, 25→0.5, 50→≈0.707, 100→1.0, ≥121→1.1; non-finite → 0.
   `damSceneColors(theme, band)` returns `{ water, waterDeep, terrain, wall, background, rimLastYear, rim2554 }`:
   water = the band colour from `src/lib/dams/bands.ts` (same in both themes); waterDeep = water darkened ~30 %;
   light: terrain `#d8cdb4`, wall `#b9bec7`, background `#eef4fb`; dark: terrain `#3b4150`, wall `#6b7280`, background `#141a26`;
   rimLastYear `#64748b` (both), rim2554 `#e11d48` (both). All values are hex strings.
2. **2D fallback** — `src/components/water/dam-section.tsx` (SVG cross-section: water level, last-year / 2554 lines,
   release arrow, "แผนภาพ ไม่ใช่ระดับน้ำจริง" label). Verify: `npx vitest run --no-file-parallelism src/components/water && npm run typecheck`
3. **Blender model** — `scripts/blender/dam.py` + `scripts/blender/build-dam.mjs` (copy the find-Blender/`-b -P` conventions
   from `build.mjs`; after export, parse the glb JSON chunk to check the node names and size ≤ 300 KB) → `public/models/dam.glb`.
   Claude runs it if Codex's sandbox can't. Verify: `node scripts/blender/build-dam.mjs && ls -l public/models/dam.glb`
4. **Add `three` + `@types/three`** — Claude does this (needs network): `npm i three && npm i -D @types/three`.
   Verify: `node -e "console.log(require('three/package.json').version)" && npm run typecheck`
5. **3D scene** — `src/components/water/dam-3d.tsx` (raw three, theme listener, ResizeObserver, dispose,
   `webglcontextlost` → fallback, reduced motion → no animation). Verify: `npm run typecheck && npm run lint`
6. **Wire it into the UI + lite** — move lite detection out of `src/components/map/map-view.tsx` (`liteDefault(device)` + the `fah-lite`
   localStorage override) into `src/hooks/use-lite.ts` so /water can use it too (the map's switch must keep working as before). Add the
   button + dialog to the dam section of `src/components/map/ui/point-card.tsx` and to the expanded details of
   `src/components/water/dam-row.tsx`; the dialog fetches `/api/dams-history` only if it isn't loaded yet; TH/EN i18n.
   Verify: `npx vitest run --no-file-parallelism && npm run typecheck && npm run lint && node scripts/i18n-check.mjs`
7. **Bundle guard** — `npm run build`: the JS for `/` and `/water` must stay at the current size (683 KB / 612 KB raw, measured with the same
   Playwright script); the chunk that contains `WebGLRenderer` must only be loaded after the button is tapped.
   Verify: Claude's measure script shows `/` and `/water` unchanged and no `WebGLRenderer` before the tap.
8. **Headless visual + docs** — Playwright (swiftshader): open /water, tap "ดูแบบ 3 มิติ", screenshot, check the canvas
   is not a single colour; reduced-motion/lite shows the SVG instead; dark/light. README: add a `build-dam.mjs` row and a note that
   the glb is committed (Vercel can't run Blender).
   Verify: smoke prints `canvas variance ok`, `lite → svg ok`, and there are screenshots for the user to look at.

Tasks 1–3 touch different files and could run in parallel, but they will run one at a time for easy checking. Push once at the end → verify:deploy.

## Where Claude differs from Fable
- None on the choice. Claude adds: the dialog fetches `/api/dams-history` itself on /water (the history is currently loaded
  only on the map), and task 7 measures with the same script as R6 so the before/after numbers are comparable.

## If it gets big — cut in this order
release-flow animation → drag-to-rotate → 3D rings (keep the text) → the whole 3D view (ship only the SVG cross-section, which is useful on its own).

## Out of scope
Chao Phraya mouth estuary scene, 3D wind over terrain (both runners-up), any new data source, the "next round" items (N1–N6
from the previous draft — kept for later).

## Verification (whole)
Per task: diff + Verify + full vitest/typecheck/lint/i18n. End: headless screenshots 390×844 light/dark on both the map card and /water,
lite fallback, the bundle-size table before/after, push → /api/version = new commit → verify:deploy 20/20.
