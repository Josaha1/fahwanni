# Plan: make the water and dams look good (art direction, not a new library)

Status: APPROVED 2026-10-05 — user: "ไม่ต้องเอาจาก blender ที่วาด ต้องการเอาจากแหล่งอื่นเลย", "ขอmodel ที่สวยๆ", then chose "สร้างจากข้อมูลจริง OSM". Inserted after `docs/plans/visual-first.md` V7 (in progress), before V8.

## Context
User (2026-10-05), after seeing V4–V6 in Chrome: "น้ำ/เขื่อนไม่สวยเลย ใช้ lib หรือ plugin อย่างอื่นได้มั้ย".
Design: Fable; facts checked against the code by Claude.

## Decision
Keep three.js (already shipped, lazy).

Why it looks cheap, as checked in the code:
- `AmbientLight(…, 2)` washes everything flat, and there is no tone mapping and no environment light.
- Water is an opaque plane painted the status colour.
- The terrain is a square slab with brown cliffs, floating in the sky.
- The 35 tanks are solid boxes about 50 px wide.

Rejected libraries, all with bundle sizes from Fable (not checked):
- **R3F + drei:** second scheduler, fights SceneHost's render-on-demand, +45–85 KB gz.
- **postprocessing:** ~40 KB gz, too heavy for cheap phones.
- **Babylon (~400 KB gz) / PlayCanvas (~300 KB gz):** full rewrite, over budget.
- **Spline/Rive:** Spline's runtime is ~1 MB; Rive needs an account (sign-up).
- **Lottie:** can't bind to the real water height.

Rules kept:
- The water height equals the real storage %.
- The status colour (RID bands) moves from the water onto a rim/label accent, and the % stays printed.

## Look (Fable)
**Dam scene**
- Lighting:
  - Room environment light (`RoomEnvironment` + PMREM, no asset).
  - ACES tone mapping with sRGB output.
  - Ambient light down from 2 to ~0.35; hemisphere light 0.8; sun 2.5.
  - Soft shadow on the dam wall only.
- Terrain: a round disc that fades into fog/sky, coloured by height (sand → green → dark). No square slab, no brown cliffs.
- Water: three's `Water` (moving normal map, sky reflection), always blue-teal.
  - Normal map generated in code, so no asset or licence (Claude).
  - Reduced tier: a glassy `MeshPhysicalMaterial` with no mirror pass.
- Ghost levels for last year and 2554: thin outlines, not solid planes.
- Concrete: light grey, roughness 0.75.

**35 tanks**
- SVG glass tanks: rounded glass, highlight stripe, and a water surface as a sine wave moving with CSS. The wave stops with reduced motion.
- Crest tick at 100%.
- Status colour as a thin rim bar, with the % in text.
- No WebGL in the grid, which is sharper at 50 px and costs nothing in the bundle.

**Near-me disc**
- Same lighting and tone mapping as the dam scene.
- Height gradient instead of flat green, plus a fog fade at the rim.

## Tasks (Codex, one per dispatch; Claude verifies diff + Verify + full vitest + Chrome/Playwright screenshots)
P1. Shared look helper `src/lib/three/look.ts`:
    - Tone mapping, colour space, `makeEnvironment(renderer)` (RoomEnvironment + PMREM; regenerated after context restore; disposed).
    - `waterNormals(size)`: procedural DataTexture, deterministic.
    - Used by SceneHost and by `dam-3d.tsx`'s own renderer.
    Verify: `npx vitest run --no-file-parallelism src/lib/three` (env set once and disposed; normal map unit-length and deterministic)
P2a. Build-time dam geometry — `scripts/osm/build-dam-geo.mjs` (+ `scripts/osm/dam-geo.test.mjs`):
    - For each of the 35 RID dams (registry), query Overpass by wikidata/name (Thai and English). Use the same retry/mirror loop as
      `scripts/osm/build-dams.mjs`, but do NOT reuse its output, which drops RID dams. Never run at request time.
    - Take the `waterway=dam` way polygon (an area, not a crest line) and the `natural=water` reservoir (ring assembly, simplified to ≤ 400 points).
    - Dam type from Wikidata P31 (CC0).
    - Heights from the OSM `height` tag, else a hand table `scripts/dams/dam-dims.json` {height, crestLength, source URL}
      with RID/EGAT published figures; a missing height stays null (the caption says so).
    - Output: `public/data/dam-geo/<id>.json` with `source: "© OpenStreetMap contributors (ODbL); Wikidata CC0"`, each ≤ 12 KB.
    - Checked by Claude: Bhumibol way 36835245 (height 154, concrete, 89 nodes); Sirikit way 36814722 (height 113.6).
    Verify: `node scripts/osm/build-dam-geo.mjs && ls public/data/dam-geo | wc -l` (= 35, or a list of the missing ones with a reason) + `node --test scripts/osm/dam-geo.test.mjs`
P2b. Pure geometry — `src/lib/dams/dam-geometry.ts` (+ test):
    - Lat/lon → local metres around the registry point.
    - `profileFor(damType)`: arch = thin curved wall; gravity = steep upstream face, 0.75:1 downstream; earth/rockfill = 2.5:1 trapezoid with darker material.
    - `extrudeFootprint`, `crestStrip` (road + parapet), `gateBays(n)` (symbolic), `reservoirShape(rings)`.
    - `concreteMaps(size)`: deterministic procedural streaks/joints.
    Verify: `npx vitest run --no-file-parallelism src/lib/dams`
P2c. **Decided by Claude (P2b leaves height null for 32/35 dams):** when OSM/table height is null, the scene height comes from the
    Terrarium DEM (crest elevation − downstream valley floor), captioned "ความสูงประมาณจากภูมิประเทศ"; no metre figure is printed for it.
    Dam scene — `src/components/water/dam-3d.tsx`, `src/lib/dams/model3d.ts`:
    - Drop GLTFLoader; load `/data/dam-geo/<id>.json`; mesh from P2b.
    - With no OSM footprint → straight wall of crest length, captioned "รูปทรงโดยประมาณ".
    - Round faded terrain, P1 look, lights per Fable.
    - Water = reservoir shape at the existing schematic height (`waterLevel()`, real %) with the `Water` surface.
      Reduced tier = glass plane. Plus a % gauge strip on the upstream face.
    - No bathymetry exists, so never claim the shoreline at the current %.
    - Band colour → rim/label accent only; ghost levels as outlines.
    - Delete `public/models/dam.glb` and the Blender scripts.
    Verify: `npx vitest run --no-file-parallelism src/lib/dams src/components/water src/components/dams` + `test ! -f public/models/dam.glb` + `grep -rn "dam.glb\|GLTFLoader" src public scripts` empty; Claude Chrome screenshots of 200101 (arch), 200601 (> 100 %), one earth dam
P2d. Caption + i18n: "รูปทรงเขื่อนและขอบอ่างจาก OpenStreetMap · ระดับน้ำเป็นสัญลักษณ์ตาม % กักเก็บ · ประตูน้ำเป็นสัญลักษณ์" + attribution. Verify: `node scripts/i18n-check.mjs`
P3. Tanks → SVG glass:
    - New `src/components/dams/tank-svg.tsx`.
    - Remove `tank-grid-scene.ts`, its test, and the grid's SceneHost use. `data-scene-state` keeps `mode:"svg"`.
    Verify: vitest (path for 0/50/100/110 %; crest; reduced motion → no animation class); Claude screenshot `/water` at 390 px, 0 canvases
P4. Near-me polish: same look, height gradient, fog at the rim, ambient 2 → 0.4. Files `src/components/flood/near-me-scene.ts`.
    Verify: `npx vitest run --no-file-parallelism src/components/flood`; Claude Chrome screenshot of `/`
(P5 dropped: no glb left to shrink.)

## Out of scope
Postprocessing (bloom/SSAO), downloaded HDRIs, re-modelling the dam in Blender, any library switch.
