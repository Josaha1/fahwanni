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
