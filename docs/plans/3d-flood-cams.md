# Plan: 3D city + flood what-if, webcams on the map, CCTV letters, camera locations, extras

Status: APPROVED 2026-10-05 with changes: user said "เอา windy ออกเลย ไม่ต้องการ sign up กับระบบอื่นๆ" → Windy removed
(code deleted), Mapillary (E2) dropped; no source that needs a sign-up.

## Context
User (2026-10-05): sent two Longdo demo screenshots — "ต้องการให้แผนที่สามารถมองแบบนี้ได้มั้ย และดูระดับน้ำท่วมได้"; then
"ที่ไหนมี cctv ก็ให้สามารถดูได้ด้วย" → chose: Windy webcams on the map, permission letters, camera locations, and
"มีอะไรที่แนะนำเพิ่มมาได้เลย ขอเป็นของฟรีและถูกลิขสิทธิ์". Design: Fable; facts checked by Claude. Codex quota resets today.

## Facts checked (Claude)
- Basemap OpenFreeMap (`openmaptiles` source) has a `building` source-layer, drawn flat today (ODbL) → 3D needs no new data.
  Unverified: how many Thai buildings carry real heights (OSM often lacks them → default low heights); the UI will say so.
- Terrain = AWS Terrain Tiles (Terrarium, SRTM ~30 m, terrain source `maxzoom: 12`). Attribution today credits Mapzen
  only; the tile docs require crediting sources ("SRTM data courtesy of the U.S. Geological Survey") → fix (task 7).
- No Thai CCTV source with published terms provides live images: licensed data.go.th CCTV datasets are lists/counts
  (a few with coordinates, e.g. Ayutthaya); BMA "License not specified"; BMA traffic, DOH, EGAT have no terms.
- OSM Thailand: 1,851 hospitals (useful); only 41 shelters/assembly points (too sparse → not proposed).

## Part 1 — 3D city + flood what-if (Fable's design)
Always labelled **"ภาพจำลองสมมติ ไม่ใช่การพยากรณ์"**. Pure MapLibre, no new sources, whole flood module lazy-loaded, off in lite mode.
- **3D buildings**: `fill-extrusion` on `openmaptiles`/`building` (`render_height`, `render_min_height`), zoom ≥ 14,
  flat building fill hidden while on. Hint "ซูมเข้าเพื่อเห็นอาคาร".
- **Mode A "ความลึกน้ำจากพื้น"** (works everywhere, like screenshot 1): depth slider 0–5 m (step 0.25) + presets with human
  anchors (0.3 ม. รถเก๋งเริ่มดับ · 0.5 ม. · 1 ม. ถึงชั้น 1 · 1.5 ม.); water = semi-transparent `fill-extrusion` over a ~250 m grid
  of the view (follows the ground when 3D terrain is on); buildings get a darker "wet band" up to the water.
- **Mode B "ระดับน้ำ (ม.รทก.)"** (like the Phuket screenshot, terrain-aware): decode Terrarium tiles → depth raster
  (`level − ground`) as an image source + "พื้นที่ในจอต่ำกว่าระดับน้ำ ≈ x%". **Only offered where the view's relief ≥ 8 m**;
  in flat areas (Bangkok) it explains "พื้นที่ราบ — ความสูงจาก SRTM (±5 ม.) ไม่ละเอียดพอ ใช้โหมดความลึกจากพื้นแทน".
- **Tap → card**: depth here, ground height (when terrain is on), "น้ำถึงชั้น x" (3 m per floor), tapped building height.
- **Cut** (honesty/scope): tsunami timeline animation, presets from river gauges or the tide model (different datums → false precision).

## Part 2 — Cameras
- **CCTV locations (licensed only)**: build-time script scans data.go.th CCTV datasets with "Open Data Common"/"CC BY", keeps
  rows with coordinates → map layer "จุดติดตั้งกล้องวงจรปิด (ไม่มีภาพสด)" with source per point. Low value; small.
- **Permission letters**: add requests to `docs/permissions/data-requests.md` for live CCTV: BMA (traffic + canals/water gates),
  DOH highway cameras, RID dam/water-gate cameras, EGAT dam cameras. You send them; nothing is shown until a written OK.

## Part 3 — Extras (free, licensed) — E1 only (E2 dropped: needs sign-up)
- **E1 Hospitals near you + flood risk** (OSM ODbL, 1,851): nearest hospitals on the map/home, flagged when inside a DDPM
  high-risk village area or under a what-if water level. No key.

## Tasks (one at a time — Codex again from today, Claude verifies)
1. `src/lib/map/flood-sim.ts` + tests: grid, floor reached, Terrarium decode, depth colours, relief gate, layer specs.
2. 3D buildings layer + hide flat buildings + switch "อาคาร 3 มิติ" in the layers dialog.
3. Mode A water + wet band; flood panel (slider, presets, caveat); off in lite.
4. Flood tap card (new probe kind that works in water mode).
5. Mode B (relief-gated) + % line.
7. Terrain attribution fix (USGS SRTM), URL state `flood=`, README, bundle check (flood module = separate chunk).
8. CCTV locations build script + layer; permission letters in docs.
9. E1 hospitals (build-time OSM snapshot like osm-dams, map layer + nearest on home, risk flag).
10. Wrap-up: verify:deploy, live screenshots (Bangkok mode A, Patong mode B, buildings), memory.
Each: Verify = vitest for the touched libs + typecheck + lint + i18n; Playwright asserts layers/sources/UI text (not pixels — software WebGL).

## For you
- Send the CCTV permission letters after I draft them.
