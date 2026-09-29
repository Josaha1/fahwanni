# Plan: map UX v2 — "อากาศ | น้ำ" modes, route bug fix, licence-clean water data

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "ปรับ UI หน้าแผนที่ใหม่ … กดทิศทางน้ำแล้วซ่อน UI ไป ทิศทางน้ำหายไปด้วย … เพิ่มปริมาณน้ำไหลผ่าน,
พื้นที่ที่คาดว่าจะได้รับผลกระทบและความรุนแรง, กล้องที่ติดตามเขื่อน, คลอง, น้ำท่วมถนน, ทิศทางน้ำแบบสวยๆ + แนะนำเพิ่ม
… ไม่รกตาและใช้งานง่าย". Decisions from the user in this session:
- **Sources without published terms are not used** ("อันไหนที่ไม่ publish ก็ไม่ต้องใช้") → remove ThaiWater (สสน.)
  everywhere, incl. the live dam feature; add it back only if สสน. grants permission (Claude drafts the email).
- Affected areas / severity MVP = heavy-rain risk from station rainfall (not a flood-extent map).

Verified by Claude/Explore (2026-09-29):
- Route bug: `activePathId = damsOn && probe.kind==='dam' && pathRequestedId===probe.id`
  (src/components/map/map-view.tsx:169) — closing the card (✕), tapping the map, Escape, tapping another
  feature all remove the route; on phones the sheet is locked at half while a card is open (⌄ no-op,
  map-view.tsx:212), so the only way to see the map is to close the card → route gone.
- Clutter at 390×844: ~9 floating items (search pill, 3–4 rail buttons, legend chip, sheet, attribution,
  bottom nav); dam card + route sheet covers ~450/756 px; disclaimer duplicated (point-card.tsx:180, :258).
- ThaiWater currently feeds: /api/dams (src/lib/dams/thaiwater.ts, client.ts), river stations + barrage C.13,
  dam-downstream.json station lists (built from the ThaiWater snapshot), home "เขื่อนเหนือน้ำของคุณ"
  (src/lib/dams/near.ts uses station situation), legend river rows, map attribution.
- Replacements with public documentation: RID `https://app.rid.go.th/reservoir/api/dam/public` (35 large
  dams: storage, percent_storage, inflow, outflow; no coordinates; docs at
  app.rid.go.th/reservoir/api/document/dam) — **docs are public but no explicit licence text; RID datasets on
  data.go.th are Open Government License (TH)**. TMD `data.tmd.go.th` API (published terms; the app already
  uses its public uid/ukey for WeatherWarningNews). HydroRIVERS (CC BY 4.0) for routes. Wikidata (CC0) for dam
  coordinates.
- Not usable under the rule: ThaiWater flood_road / CCTV / canal stations / discharge, EGAT CCTV (no terms),
  BMA canal API (no terms, and data weeks old), Floodboard (unclear), GISTDA (not chosen), Google Flood Hub
  (waitlist, not chosen).

## Decisions
- **Two modes, one map: "อากาศ | น้ำ"** segmented control top-centre (Fable). Mode filters layers, legend,
  card types and sheet content; `?mode=water` in the URL. Water mode hides the time bar (observed daily data)
  and shows a source stamp ("ข้อมูลกรมชลประทาน · วันที่ …").
- **Route = its own focus state** `focus: { kind: 'damRoute', damId } | null` in map-state; cleared only by the
  focus chip ✕, choosing another route, or leaving water mode. Floating chip "ลำน้ำจากเขื่อน X ✕" (tap → reopen
  the card). Card close / map tap / Escape no longer remove it.
- **Sheet always collapsible** (drag handle + ⌄ work with a card open; peek shows the card's title row).
- **Declutter to ≤ 5 floating items on phones**: mode switch, search pill (GPS inside), one "ชั้นข้อมูล" rail
  button (3D / fullscreen / share move to a "เพิ่มเติม" row in the layer sheet), focus chip when active,
  sheet. Legend chip → colour strip in the sheet peek (tap → อ่านแผนที่).
- **Water mode content (licence-clean)**:
  - Dams from RID (bands ≤30/31–50/51–80/81–100/>100 %, cited as กรมชลประทาน criteria), release (outflow)
    = "ปริมาณน้ำไหลผ่านเขื่อน" in m³/s.
  - Downstream routes (HydroRIVERS) drawn as **animated flowing lines** (line-dasharray step animation,
    paused with reduced motion / hidden tab); line width by the dam's release; label "ทิศทางน้ำจากเขื่อน".
    No station dots, no river-level colours (no licensed source). Provinces along the route stay.
  - **Heavy-rain risk** from TMD station 24 h rainfall using TMD's published categories (ฝนหนัก 35.1–90 mm,
    หนักมาก > 90 mm): coloured station points + list by จังหวัด; wording "ฝน 24 ชม. เข้าเกณฑ์ฝนหนัก" — never
    "พื้นที่น้ำท่วม", no polygons.
  - "สรุปสถานการณ์น้ำวันนี้" line in the water peek (dams > 80 % / > 100 %, stations with heavy rain).
- **Dropped (tell the user why)**: river discharge along rivers, canals, flooded roads, dam CCTV, Chao Phraya
  barrage flow, river-level colours on routes — no source with published terms. Re-add if สสน. / EGAT grant
  permission.
- Every water layer shows a badge **สังเกต** (observed) and names source + time in the card footer.

## Where Claude disagrees with Fable
1. Fable's MVP relied on ThaiWater (stations, discharge, rain rule, canals, flood_road) and EGAT CCTV; the user
   ruled out unpublished-terms sources, so those are cut and replaced with RID + TMD.
2. Discharge encoding uses the **dam's own release** (RID outflow), not nearest-station river discharge.
3. Rain severity uses **TMD categories**, not ThaiWater's per-zone rule.

## Spikes (Claude, live requests, before coding)
- S1 RID `dam/public`: fields, % of dams with inflow/outflow, update time, headers/CORS, response size; read
  `/api/document/dam` and any terms text; confirm the 35 names map 1:1 to the current dam ids.
- S2 Wikidata SPARQL: coordinates for the 35 RID dams (dam wall, not reservoir centroid); fallback manual.
- S3 TMD API: an endpoint with per-station 24 h rainfall + coordinates using the public uid/ukey; read
  data.tmd.go.th terms (attribution, rate limit).
- S4 Mobile perf: 36 animated dashed routes at 4× CPU throttle (frame time).
If S1 or S3 fails → Status BLOCKED, re-plan that part.

**Spike results (Claude, 2026-09-29):**
- S1 ✅ RID `dam/public`: 35 dams, 7 KB, `Access-Control-Allow-Origin: *`; fields id, name, owner
  (การไฟฟ้า / กรมชลประทาน), capacity, storage, active_storage, dead_storage, volume, percent_storage,
  inflow (35/35), outflow (27/35); units = million m³/day (matches the old source for the same dams);
  history `…/dam/public/YYYY-MM-DD` documented. No licence text on the docs page.
- S2 ✅ coordinates for all 35 in `scripts/dams/registry-sources.json`: 30 from Wikidata (CC0), 5 from
  OpenStreetMap (ODbL) — ห้วยหลวง (Wikidata matched a different reservoir, 342 km off), รัชชประภา (Wikidata =
  reservoir centre, OSM dam wall used), คลองสียัด (OSM reservoir centre), ประแสร์ and นฤบดินทรจินดา (OSM dam
  walls). Attribution needed: "© OpenStreetMap contributors" (already shown for the basemap).
- S3 ✅ TMD `https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345&format=json`: 124 stations,
  lat/lon, `Observation.Rainfall` (24 h to 07:00), header "CopyRight: Thai Meteorological Department";
  today 6 stations ≥ 35.1 mm, 0 ≥ 90.1 mm. Attribution "ข้อมูล: กรมอุตุนิยมวิทยา".
- S4 ⏳ measured in task 9.

## Tasks (1 Codex dispatch each; Claude verifies diff + Verify + headless Chrome)
1. Focus state for the dam route (map-state `focus`, reducer + tests; route layer reads focus; focus chip).
   Verify: vitest + headless: open route → ✕ card, tap map, Escape → route still drawn; chip ✕ clears.
2. Collapsible sheet with a card open (drag + ⌄; peek shows card title). Verify: headless 390×844 card open →
   peek → map visible → reopen.
3. Mode switch "อากาศ | น้ำ" (+ `?mode=water`, url-state tests); mode filters layers/legend/cards; water mode
   hides time bar + source stamp. Verify: vitest + headless toggle, reload with ?mode=water, share link.
4. Declutter: single "ชั้นข้อมูล" rail button + "เพิ่มเติม" row; legend strip in peek. Verify: headless count
   floating elements ≤ 5 at 390×844 in both modes/themes; desktop layout screenshot.
5. RID dam client + static dam registry (`src/lib/dams/registry.ts`: RID id, names th/en, Wikidata coords,
   capacity) + `/api/dams` from RID (tests with a RID fixture; stale-on-failure kept). Verify: vitest + curl.
6. Rebuild `dam-paths.geojson` / `dam-downstream.json` from the registry coords (provinces only, no stations);
   remove ThaiWater snapshot use from scripts/dams/build-paths.mjs. Verify: script run, 35 paths, ภูมิพล →
   กรุงเทพฯ.
7. Remove ThaiWater: thaiwater.ts / stations / barrage / river legend rows / attribution / near.ts rules
   (home card = storage > 80 % or high release only) / verify-deploy / tests. Verify: `grep -ri thaiwater src
   scripts public` = 0 (except the permission-email draft), full vitest, headless dam card + home card.
8. Dam card cleanup (one disclaimer, order: storage → release → route button → provinces → collapsed
   กรณีเขื่อนแตก; RID source/date). Verify: headless both themes.
9. Animated flow lines + width by release, reduced-motion pause. Verify: headless screenshot + perf (S4).
10. TMD heavy-rain layer: `/api/rain-risk` (TMD stations, categories, tests) + points + province list in water
    mode. Verify: vitest + curl + headless.
11. Water summary line + "เขื่อนใกล้ฉัน" (nearest 3 dams via GPS/place). Verify: headless text.
12. Legend + i18n + attribution updates for water mode (RID, TMD, HydroRIVERS). Verify: legend test, i18n-check.
13. Permission email draft to สสน. (and EGAT for CCTV) in docs/ — Claude writes; user sends.
14. Regression, push, `npm run verify:deploy https://fahwanni.vercel.app`, live check; update memory.
(Separate, already approved in style: fix the app icon's clipped sun rays by widening the Blender camera,
rebuild, commit — done before task 1.)

## Recommended extras (Claude — added at the user's request "มีอะไรแนะนำเพิ่มใส่มาได้เลย")
Licence-clean only; ranked by value ÷ effort. Included in this plan as tasks 15–20 (run after task 12,
before 14):
15. **ฝนสะสมคาดการณ์ 3 วัน** (forecast accumulation, Open-Meteo CC BY, data already in the 7-day store):
    water-mode layer shading where the next 72 h model rain ≥ 90 / 150 mm, badge **พยากรณ์ (แบบจำลอง)**.
    This is the honest "พื้นที่ที่อาจได้รับผลกระทบ" forecast view next to the observed TMD rain.
    Verify: vitest on the accumulation + thresholds, headless screenshot.
16. **แนวโน้มเขื่อน 7 วัน**: RID documented history endpoint (`…/public/{YYYY-MM-DD}`) → ▲▼ arrow on dam
    markers and a small sparkline in the dam card (server cache 6 h). Verify: vitest + card screenshot.
17. **ประกาศเตือนภัย กรมอุตุฯ ในโหมดน้ำ**: the TMD WeatherWarningNews we already fetch, shown as a dismissible
    banner in water mode (heavy rain / flash-flood notices, with time and link). Verify: headless with a
    routed warning.
18. **เบอร์ฉุกเฉิน**: a compact "เบอร์ฉุกเฉิน" row in water mode (ปภ. 1784, กรมชลประทาน 1460, สายด่วนกู้ชีพ 1669,
    เหตุด่วน 191) with tel: links — static, no data licence needed. Verify: headless links.
19. **ติดตามเขื่อน** (watchlist, localStorage): star a dam → shown first in water mode with "เปลี่ยนจากครั้งก่อน
    +3.2%" since your last visit. Verify: vitest on the diff helper + headless.
20. **ข้อมูลออฟไลน์**: service worker keeps the last /api/dams, /api/rain-risk and TMD warnings; when offline
    the water peek says "ข้อมูลออฟไลน์ เมื่อ HH:MM" (useful when the signal drops in a flood). Verify: headless
    with offline emulation.
Optional (needs the user to register a free key, not in this plan): **GISTDA satellite flood extent** (published
terms, non-commercial) as "พื้นที่น้ำท่วมจากดาวเทียม (ล่าช้า 1–3 วัน)". Later, separate plan: web-push alerts.

## Verification (end-to-end)
Each task: `git diff`, its Verify, full vitest, lint/typecheck, i18n-check; UI tasks in headless Chrome at
390×844 and 1280×800, light + dark. Final: verify:deploy all 200, live: water mode, route persists after
closing the card, rain-risk list, no ThaiWater requests in the network log.

## Risks
- RID API has public docs but no explicit licence text — flagged to the user; if they want strict
  "published licence only", dams would also go until RID confirms.
- TMD station network is sparse (~120 synoptic stations vs 4,238 ThaiWater gauges) → rain risk is coarse.
- Removing ThaiWater loses river levels, the barrage and CCTV that users may already use.
- Wikidata coords may point to reservoir centroids → HydroRIVERS snapping may pick the wrong reach
  (manual overrides file).

## Out of scope
River discharge along rivers, canals, flooded roads, CCTV, GISTDA flood extent, Google Flood Hub, dam-break
modelling, push notifications.

## Task specs (Claude, written from the code after tasks 1, 2, 5, 6, 7 landed)

### Task 3 — mode switch "อากาศ | น้ำ" (detailed)
Files: src/lib/map/map-state.ts (+ .test.ts), src/lib/map/url-state.ts (+ .test.ts), src/components/map/use-probe.ts,
src/components/map/map-view.tsx, src/components/map/ui/mode-switch.tsx (new), src/components/map/ui/map-panel-content.tsx,
src/components/map/ui/legend-dialog.tsx, src/app/globals.css, src/i18n/en/*.ts.
1. map-state: add `mode: "weather" | "water"` (default "weather") and action `{ type: "setMode"; mode }`.
   `setMode` water → `overlays.dams = true`, `playing = false`. `setMode` weather → `overlays.dams = false`,
   `focus = null`. `initialMapState` accepts `mode`; when `mode === "water"` it forces `overlays.dams = true`.
   Tests: both transitions, focus cleared on leaving water, initial water forces dams.
2. url-state: `UrlView.mode?: "water"`. Parse: `mode=water`, OR legacy links with `dam=` or `ov` containing `dams`
   → `mode: "water"`. Format: add `mode` to the input; write `mode=water` only in water mode; stop writing
   `dams` inside `ov`; write `dam=` only in water mode. Tests for all of these (legacy `?ov=dams`, `?dam=200101`).
3. map-view: `const water = mapState.mode === "water"`. In water mode do NOT render: radar + model-rain + temp +
   pm25 image layers (pass enabled=false), WindCanvas, storms, quakes, LegendChip, the timeline (mobile sheet and
   desktop `.map-time-floating`), primaryPicker, `details`, `layers`, and the "ดูอากาศตรงกลางแผนที่" button.
   Playback stops (the reducer already does it). Terrain, place marker, plates stay. State for the weather
   layers is kept, so switching back restores them. Replace the `view.dam` → `overlays.dams = true` hack with
   `mode: view.mode`. Remove the "เขื่อน" chip from `layers` (dams now belong to water mode only).
   Pass `mode` to `formatUrlView`.
4. Water panel content (new `water` prop on MapPanelContent, shown instead of timeline/details/layers):
   - source stamp: `ข้อมูลกรมชลประทาน · ข้อมูลวันที่ {date}` (Thai date via existing formatFullDate with
     dams.dataDate) + badge `สังเกต` (small pill); when `dams.stale` add `map-warning` text `ข้อมูลอาจไม่เป็นปัจจุบัน`;
     while loading `กำลังโหลดข้อมูลเขื่อน…`.
   - a `map-chip` button `อ่านแผนที่` that opens the legend dialog (same ref/showModal as LegendChip).
   - hint text `แตะเขื่อนบนแผนที่เพื่อดูรายละเอียดและทิศทางน้ำ`.
5. use-probe: `useProbe(map, { points: boolean })` — when `points` is false a tap on empty map does nothing
   (dam/quake/storm taps unchanged). map-view passes `points: !water`.
6. LegendDialog: new prop `mode`; in water mode skip the primary-layer section and the RainViewer/Open-Meteo
   source line; `active` = `{ wind:false, storms:false, quakes:false, dams: true-when-ready }`.
7. ModeSwitch (`ui/mode-switch.tsx`): `role="radiogroup"` `aria-label="โหมดแผนที่"`, two `role="radio"` buttons
   `อากาศ` / `น้ำ` with `aria-checked`, arrow keys move between them; min 44px tall; class `map-panel map-mode-switch`.
   CSS: mobile `position:absolute; z-index:6; top: calc(64px + env(safe-area-inset-top)); left:50%;
   transform:translateX(-50%)`; move `.map-legend-chip` mobile top to `calc(120px + env(safe-area-inset-top))`
   (task 4 replaces it); desktop (≥1024px) `top:16px; left: calc(50% + 196px)` and move `.map-focus-chip`
   desktop `top` to `76px`. Selected radio uses `--map-accent` background + white text.
   Switching to water on a phone keeps the sheet position; `close()` any open weather card (point/storm/quake)
   when switching to water, and any dam card when switching to weather.
8. i18n: every new Thai string gets an English entry; `node scripts/i18n-check.mjs` passes.
Verify: `npx vitest run src/lib/map` ; `npm run typecheck && npm run lint && node scripts/i18n-check.mjs` ;
headless (Claude): toggle to น้ำ → dam markers visible, no time bar, no wind canvas, URL has `mode=water`;
reload `/map?mode=water` → water mode; `/map?ov=dams&dam=200101` → water mode + route; back to อากาศ → rain
layer and time bar return, URL has no `mode`.

### Task 4 — declutter (detailed)
Goal on phones (<1024px): floating items = search pill, mode switch, ONE rail button (ชั้นข้อมูล), focus chip
(only while a route is shown), sheet. Desktop (≥1024px) keeps today's rail and floating legend chip.
Files: src/components/map/ui/action-rail.tsx, src/components/map/ui/legend-chip.tsx, src/components/map/ui/map-panel-content.tsx,
src/components/map/map-view.tsx, src/lib/map/legend.ts (+ .test.ts), src/app/globals.css, src/i18n/en/*.ts.
1. ActionRail: new prop `compact: boolean` (map-view passes `!isDesktop`). When compact render only the
   ชั้นข้อมูล button. Desktop unchanged.
2. "เพิ่มเติม" row: new `more` ReactNode prop on MapPanelContent, rendered (only when `!compact`) as
   `<section aria-labelledby="map-more"><h2 id="map-more">เพิ่มเติม</h2>` + a flex row of `map-chip` buttons:
   `แผนที่ 3 มิติ` (aria-pressed, only when terrainOk), `เต็มจอ`/`ออกจากเต็มจอ` (aria-pressed), `แชร์มุมมองนี้`.
   Shown in BOTH modes (in water mode after the water panel). Phones only: map-view passes `more={isDesktop ? null : …}`.
3. Legend strip in the sheet (phones only; desktop keeps the floating LegendChip):
   - LegendChip gets `variant: "floating" | "strip"`. `strip` = a full-width button (class `map-legend-strip`,
     not absolutely positioned, min-height 32px): title · unit on the left, the gradient bar (h-2) and
     min/max values in one row; same aria-label / onOpen. map-view renders the floating chip only on desktop, and
     on phones passes the strip into MapPanelContent as a new `legend` prop shown right after `timeline`.
   - Water mode strip: new `damLegendStrip()` in src/lib/map/legend.ts returning the 5 band colours with short
     labels `≤30`, `31–50`, `51–80`, `81–100`, `>100` (unit `% ความจุ`) (test it). Rendered as a button
     `map-legend-strip` (5 dots + labels, title `เขื่อน (% ความจุ)`) that opens the legend dialog, placed FIRST in
     the water panel. Remove the old `อ่านแผนที่` chip from the water panel.
4. CSS: `.map-sheet[data-position="peek"] { max-height: 152px }` so the time bar AND the strip (weather) or the
   strip AND the source line (water) fit in the peek. Remove the mobile `.map-legend-chip` absolute rule's
   mobile top (the chip is desktop-only now); keep the desktop rule.
5. i18n for every new string.
Verify: `npx vitest run src/lib/map` ; `npm run typecheck && npm run lint && node scripts/i18n-check.mjs` ;
headless (Claude): at 390×844 in both modes and both themes, count visible floating elements outside the sheet
(search pill, mode switch, rail buttons, legend chip, focus chip) ≤ 4 + sheet; legend strip visible in the peek;
3D/fullscreen/share reachable from the half sheet; desktop 1280×800 screenshot unchanged apart from the mode switch.

### Task 9 — animated flow line (detailed)
Only ONE route is drawn at a time (the focused dam), so the S4 "36 animated routes" perf risk does not apply.
Files: src/lib/dams/flow.ts (new) + flow.test.ts, src/components/map/layers/use-dam-path-layer.ts,
src/components/map/map-view.tsx.
1. `src/lib/dams/flow.ts`:
   - `flowWidth(releaseCms: number | null): number` = line width in px for the solid route:
     null or ≤ 0 → 3; otherwise `Math.min(10, 3 + Math.sqrt(releaseCms) / 4.5)` rounded to 0.5.
     (≈ 4.5 px at 35 m³/s, 6.5 at 250, 10 at ≥ 1000.)
   - `FLOW_DASH_STEPS: number[][]` — the 14-step dash sequence from MapLibre's "animate a line" example:
     [0,4,3],[0.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],[2.5,4,0.5],[3,4,0],[0,0.5,3,3.5],[0,1,3,3],[0,1.5,3,2.5],
     [0,2,3,2],[0,2.5,3,1.5],[0,3,3,1],[0,3.5,3,0.5]
   - `flowStep(elapsedMs: number): number` = `Math.floor(elapsedMs / 60) % FLOW_DASH_STEPS.length`.
   Tests: widths for null/0/35/250/1000/5000; flowStep wraps; every step array has an even total length pattern ≥ 3 entries.
2. use-dam-path-layer: signature `(map, path, releaseCms, isDesktop, reducedMotion)`.
   - `dam-path` width = `flowWidth(releaseCms)`; casing width = that + 4.
   - New layer `dam-path-flow` (after `dam-path`, before `dam-path-arrows`): same source, `line-color` `#bfdbfe`,
     `line-width` = `Math.max(2, flowWidth - 1.5)`, `line-dasharray` = FLOW_DASH_STEPS[0], `line-cap` butt.
     Add it to LAYERS so it is removed with the others.
   - Animation effect: when `map && path && !reducedMotion`, a requestAnimationFrame loop that calls
     `map.setPaintProperty("dam-path-flow", "line-dasharray", FLOW_DASH_STEPS[step])` only when the step changes
     (guard `map.getLayer("dam-path-flow")`); stop the loop while `document.visibilityState !== "visible"` and
     restart on `visibilitychange`; cancel on cleanup. With reduced motion the dashes stay static (step 0) and
     the `›` arrows remain the direction cue.
3. map-view: pass `activePath ? dams?.dams.find((d) => d.id === activePath.id)?.releaseCms ?? null : null`.
Verify: `npx vitest run src/lib/dams` ; `npm run typecheck && npm run lint` ;
headless (Claude): `/map?mode=water&dam=200101` → `dam-path-flow` layer exists and its `line-dasharray` changes
between two reads 300 ms apart; with `reducedMotion: "reduce"` it does not change; screenshot both themes.

### Task 10 — TMD heavy-rain risk (detailed)
Source: `https://data.tmd.go.th/api/WeatherToday/V2/?uid=api&ukey=api12345&format=json` (TMD's public demo key,
already used for WeatherWarningNews). Real response saved at `src/lib/rain-risk/fixture-tmd-today.json`
(124 stations; `Stations.Station[]` with `WmoStationNumber`, `StationNameThai`, `StationNameEnglish`, `Province`
(Thai), `Latitude`, `Longitude` (strings) and `Observation.DateTime` ("2026-09-29 07:00:00.000", Bangkok time),
`Observation.Rainfall` (string mm, rain in the 24 h ending at DateTime)).
TMD categories (24 h): ฝนหนัก 35.1–90.0 mm, ฝนหนักมาก > 90.0 mm.
Files: src/lib/rain-risk/tmd.ts (+ tmd.test.ts), src/app/api/rain-risk/route.ts (+ route.test.ts if the dams route
has one — copy its style), src/components/map/layers/use-rain-risk-layer.ts, src/components/map/use-map-data.ts,
src/components/map/use-probe.ts, src/components/map/ui/point-card.tsx, src/components/map/map-view.tsx,
src/lib/map/legend.ts (+ test), src/components/map/ui/legend-dialog.tsx, src/components/map/map-provider.tsx (attribution),
scripts/verify-deploy.mjs (add `/api/rain-risk`), src/i18n/en/*.ts.
1. `parseTmdRain(raw: unknown): RainRisk` with zod (lenient: skip bad stations, never throw on one bad row):
   `type RainStation = { id; nameTh; nameEn; provinceTh; lat; lon; rainMm: number; category: "heavy" | "veryHeavy" }`
   `type RainRisk = { observedAt: string | null /* ISO with +07:00 */; reporting: number /* stations with a numeric
   Rainfall */; stations: RainStation[] /* ONLY rainMm > 35.0, sorted by rainMm desc */ }`.
   `rainCategory(mm)`: > 90 → veryHeavy, > 35 → heavy, else null. Tests with the fixture (reporting = 124,
   6 stations > 35 on the fixture, sorted, all have lat/lon inside Thailand bbox) + boundary tests 35.0 / 35.1 / 90.0 / 90.1
   + a row with Rainfall "-" or missing is skipped from both counts.
2. `/api/rain-risk`: same shape as src/app/api/tmd-warnings/route.ts (WeatherCache, 30 min fresh, `s-maxage=1800,
   stale-while-revalidate=3600`, `fetch(..., { next: { revalidate: 1800 }, signal: AbortSignal.timeout(15_000) })`,
   stale-on-failure, 503 `{ error: "upstream" }` when nothing cached).
3. use-map-data: `rainRisk`, `rainRiskStatus`, `loadRainRisk()` exactly like `dams`/`loadDams`. map-view loads it
   when water mode is on (same effect style as dams; on failure a toast `ข้อมูลฝนหนักไม่พร้อมใช้งาน`, water mode stays).
4. Layer `use-rain-risk-layer.ts` (water mode only): geojson source `rain-risk`, circle layer `rain-risk-circle`
   (heavy `#f97316` radius 8, veryHeavy `#b91c1c` radius 11, white/dark stroke 2 like dams) drawn BELOW `dam-circle`
   if it exists; symbol `rain-risk-label` at minzoom 7 with text `{rainMm} มม.` offset below.
5. Probe: new kind `{ kind: "rain"; id }`; use-probe queries `rain-risk-circle` after dams (8 px box like dams).
   PointCard for rain: title = station nameTh (en: nameEn), line `จ.{province}`, big `{mm} มม. ใน 24 ชม.`, category
   word (`ฝนหนัก` / `ฝนหนักมาก`) coloured like the point, `สังเกต` badge, `ถึง {time} น. {date}` from observedAt,
   footer `ที่มา: กรมอุตุนิยมวิทยา` + `ฝนเข้าเกณฑ์ฝนหนักไม่ได้แปลว่ามีน้ำท่วม`.
   switching to weather mode closes a rain card too (same rule as dam cards: `probe.kind` dam or rain belongs to water).
6. Water panel (after the dam source line): section `ฝนหนัก 24 ชม. (กรมอุตุฯ)` with `สังเกต` badge:
   if stations: a list grouped by province (max mm per province, sorted desc, top 8, then `แสดงทั้งหมด ({n})`),
   each row `จ.{province}` + `{mm} มม. · {category word}`; tapping a row selects that station (opens its card).
   If none: `ไม่มีสถานีที่ฝน 24 ชม. เข้าเกณฑ์ฝนหนัก ({n} สถานี)`. Footer `ข้อมูลถึง {time} น. · กรมอุตุนิยมวิทยา`.
   Loading / error states in one muted line. Bangkok has no `จ.` prefix (province "กรุงเทพมหานคร").
7. Legend: `overlayLegend` gets `rainRisk: boolean` → section `ฝน 24 ชม. (กรมอุตุฯ)` rows
   `ฝนหนัก 35.1–90 มม.` (circle #f97316 size 12) and `ฝนหนักมาก มากกว่า 90 มม.` (circle #b91c1c size 14).
   LegendDialog passes it true in water mode when data is ready. Update legend tests. Dam strip unchanged.
8. Attribution: add `<a href="https://www.tmd.go.th" ...>Rain: Thai Meteorological Department</a>`.
9. i18n for every new string.
Verify: `npx vitest run src/lib/rain-risk src/lib/map` ; `npm run typecheck && npm run lint && node scripts/i18n-check.mjs` ;
`curl -s localhost:3457/api/rain-risk | head -c 600` after `npm run build && PORT=3457 npm run start` (Claude runs it);
headless (Claude): water mode shows the rain points + province list; tap a point → rain card; weather mode hides them.
