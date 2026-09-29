# Plan: Water v3 — ติดตามแม่น้ำ, หน้า "น้ำ", การ์ดหน้าแรก, เทียบปีก่อน/2554

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "ในเรื่องของน้ำ ทำยังไงให้น่าใช้และครบน่าติดตามกว่านี้".
Today water lives behind the map's น้ำ switch; the only daily change is dam % (~0.3 %/day), the home card only
appears when something is risky, and there is no push — so there is little reason to come back.
User decisions: **no push/database this round** (in-app "มีอะไรใหม่" instead); **add a 3rd bottom tab "น้ำ"**.

Verified by Claude today (live requests):
- **Open-Meteo Flood API** (flood-api.open-meteo.com; GloFAS v4 / Copernicus, CC BY 4.0): daily `river_discharge`
  + ensemble median/p25/p75/min/max, 30-day forecast, history back to 1984. 5 km cells: a raw lat/lon can hit a
  tributary (2 m³/s); snapping to the max-discharge cell within ±0.1° gives Chao Phraya at Nakhon Sawan ≈ 3,640 m³/s
  rising to ~4,100 in 2–3 days. → the originally requested "ปริมาณน้ำไหลผ่าน" is possible with published terms.
- **RID history** `/api/dam/public/{YYYY-MM-DD}` works back to 2011 (Bhumibol 2011-09-29 91.97 %, 2025-09-29 84.4 %,
  today 64.2 %).
- Reusable code: `src/components/share/render-share-image.ts` (client canvas share image), `src/lib/dams/watchlist.ts`
  (localStorage diff pattern), `src/app/api/dams-trend/route.ts` (WeatherCache + SWR route pattern),
  `src/components/dams-banner.tsx` (home card; `return null` when nothing risky, line 39),
  `src/components/bottom-nav.tsx` (2 tabs: `/`, `/map`), `public/sw-routing.js` (offline "data" routes).

## Decisions (Fable, checked by Claude)
- **River watch points** (~12–15 curated: Ping/เชียงใหม่, Nan/นครสวรรค์, Chao Phraya/ชัยนาท + อยุธยา, Pa Sak, Yom/สุโขทัย,
  Mun/อุบลฯ, Chi, Tapi/สุราษฎร์ฯ, Mae Klong, Bang Pakong …): snapped GloFAS cell, 7-day forecast band (median + p25–p75),
  status word vs **±15-day day-of-year climatology 1984–2025** (`ต่ำกว่าปกติ / ปกติ / สูงกว่าปกติ / สูงมาก`), trend arrow,
  "วันนี้ปี 2554" line. Climatology is built once offline into `public/data/river-points.json` (never at deploy).
- **Honest wording** (fixed strings): "ปริมาณน้ำไหลผ่าน (แบบจำลอง)" — never "ระดับน้ำ"; footer "ประมาณการจากแบบจำลอง GloFAS
  ความละเอียด 5 กม. · ไม่ใช่ค่าที่วัดจริงจากสถานี · ไม่ใช่แผนที่น้ำท่วม"; rare levels as "สูงเท่าที่พบราวปีละครั้ง / ราว 5 ปีครั้ง";
  "เฝ้าระวัง/เตือนภัย" only for official TMD/RID notices; points below dams add "ปริมาณจริงขึ้นกับการระบายของเขื่อน" + the
  upstream dam's release; 2554 rows add "ปริมาณน้ำในเขื่อนอย่างเดียวไม่ได้บอกว่าจะท่วม"; every number shows its data date.
- **Dam context**: last year (1 RID fetch/day) and 2554 same-day (frozen static JSON) in the dam card and /water.
- **/water tab** (พยากรณ์ | น้ำ | แผนที่): list-first — warnings, "มีอะไรใหม่ตั้งแต่ครั้งก่อน", river points near me,
  watched dams/points, dams near me, heavy rain near me, link "ดูบนแผนที่".
- **Home card always on**: "น้ำใกล้คุณ: ปกติ / สูงกว่าปกติ / สูงมาก" from the nearest river point + upstream-dam line +
  one change-since-last-visit line; still shows the existing upstream-dam warning when risky.
- **"มีอะไรใหม่" badge**: watchlist generalised to `kind:id` (dam | river), migrating `fah-dam-watch`; dot on the น้ำ tab.
- **v3.1 (after a week live)**: "สรุปน้ำวันนี้" share image 1080×1350 via render-share-image.ts.
- Cut: push/DB (user), tide, province pages, medium dams (no licensed source).

## Where Claude adds to Fable
- Quota: 15 points × 4 refreshes/day ≈ 60 Open-Meteo calls (current ≈ 3k/day of ~10k); the one-off history build
  (42 y × 15 points) runs locally, chunked by decade, once.
- Each curated point is checked by eye (snapped cell discharge ≫ tributary, plausible seasonal max) before it goes in;
  points that fail are dropped, not tuned.

## Changes during execution (Claude)
- Task 1: history limited to 2011–2025 (Open-Meteo counts long ranges as many calls); snapping uses Sept 2020 only.
- Eye check dropped 5 points right below big reservoirs — GloFAS applies generic reservoir rules, not real gate
  operations (Mae Klong 4,415 m³/s modelled while Srinagarind/Vajiralongkorn released ~23): ping-tak, nan-phitsanulok,
  pasak-saraburi, maeklong-ratchaburi, bangpakong-prachinburi. 11 points remain; Chao Phraya points carry
  downstreamOfDam = Bhumibol for the "ขึ้นกับการระบายของเขื่อน" note.

## Map page extras (added at the user's request "มีอะไรแนะนำเพิ่มเติมใส่มาได้เลย หน้าแผนที่")
Water mode (8a–8e): forecast-day slider, all-routes overview, upstream dams per river point, filter chips + water
search, "ฝนตอนนี้" radar toggle. Both modes (8f–8k): cloud + heat-index layers, tap-point 24 h chart, saved places
on the map, share-as-image, "ข้อมูลล่าสุด" freshness panel, desktop shortcuts. All reuse existing sources
(GloFAS/Open-Meteo/RID/TMD/HydroRIVERS/RainViewer) — no new providers, no DB. Order after the core (1–8):
8a, 8b, 8c, 8d, 8e, 8f, 8g, 8j, 8h, 8i, 8k (most useful first; the last three can be cut if time runs short).

## Tasks (1 Codex dispatch each; Claude verifies diff + Verify + headless; commit per task)
1. `scripts/rivers/build-points.mjs`: curated list → snap (max `river_discharge_mean` in ±0.1°) → history 1984–2025
   → `public/data/river-points.json` {id, nameTh/En, river, provinceId, lat, lon, doy p25/p50/p75/p90 (±15 d),
   annual-max p50/p80, value2554[doy], downstreamOfDam?}. Claude runs it once and eyeballs every point.
   Verify: `node scripts/rivers/build-points.mjs --check` (schema + ≥ 10 points + no p50 < 20 m³/s)
2. `src/lib/rivers/{types,status,client}.ts` + tests: parse Flood API (fixture), `riverStatus(value, doy, clim)`,
   `trend`, rare-level words. Verify: `npx vitest run src/lib/rivers`
3. `src/app/api/rivers/route.ts` (one multi-location call, WeatherCache 6 h, SWR, 503 when nothing) + test; add to
   verify-deploy and sw-routing "data". Verify: vitest + `curl localhost:3457/api/rivers`
4. Dam history: `scripts/dams/freeze-2554.mjs` → `public/data/dams-2554.json` (365 days × 35 ids, verify ids stable);
   `/api/dams-lastyear` (1 RID fetch, 24 h cache); rows "ปีที่แล้ว / ปี 2554" in the dam card. Verify: vitest + curl + headless card.
5. Watchlist generalisation `kind:id` + "มีอะไรใหม่" diff helper (migrate `fah-dam-watch`). Verify: vitest.
6. `/water` page + 3rd tab in bottom-nav (+ `--nav-h`, active state, offline "page" route). Verify: headless 390×844 both
   themes, sections render with live data, tab dot appears after a seeded change.
7. Home card always on (dams-banner → water-near-you card). Verify: headless Bangkok / Tak / Phuket.
8. Map water mode: river points layer (status colour) + tap → river card (sparkline band + wording). Verify: headless.
8a. **(Map extra, Claude) Water-mode day slider "วันนี้ → +7 วัน"**: a compact day stepper replaces the hidden time bar
   in water mode; river-point colours/status and the 3-day-rain shading follow the chosen day (GloFAS daily forecast,
   Open-Meteo daily rain); dams stay "ข้อมูลวันที่ …" (observed, not forecast) and are dimmed with a note when a future
   day is chosen. Play button steps days. `?wd=N` in the URL. Verify: vitest (day→status) + headless day 0/3/7.
8b. **(Map extra) "เส้นทางน้ำทุกเขื่อน" overview toggle**: all 35 downstream routes from the existing
   `public/data/dam-paths.geojson`, faint, width by each dam's release (`flowWidth`), no animation; tapping a route opens
   its dam. The focused route keeps its animated flow on top. Verify: headless screenshot + tap.
8c. **(Map extra) Upstream dams of a river point**: offline, record which dam routes pass within 5 km of each river point
   (in build-points.mjs) → river card lists "เขื่อนเหนือจุดนี้" with their release, tap → dam card/route.
   Verify: vitest on the matcher (Nakhon Sawan ← Bhumibol, Sirikit) + headless.
8d. **(Map extra) Filter chips in water mode**: `ทั้งหมด · น้ำมาก >80% · ระบายมาก · ติดตาม` for dam markers + a search
   that also finds dams and river points by name (reuse MapSearchPill, water results first in water mode).
   Verify: headless chip counts match /api/dams; search "ภูมิพล" flies to the dam.
8e. **(Map extra) "ฝนตอนนี้" radar toggle in water mode** (off by default): newest RainViewer frame at 0.5 opacity so
   flash-flood-prone heavy cells can be seen over dams/rivers, with its age label. Verify: headless toggle.
8f. **(Map, both modes) New primary layers "เมฆ" and "ดัชนีความร้อน"**: add Open-Meteo `cloud_cover` to the wind-grid
   request (7 vars, still under the 10-var quota tier; add a 5th chunk if a chunk nears Next's 2 MB cache limit);
   "ดัชนีความร้อน" reuses the existing `feels` grid with the heat-index palette used on the home page. RainViewer's
   satellite feed is empty (checked), so clouds come from the model and are labelled "แบบจำลอง". Verify: vitest
   (palette/legend), `/api/wind?day=0` has `cloud`, headless layer switch.
8g. **(Map) Tap-point 24 h mini chart**: the weather point card gains a 24-hour strip (temp line + rain-chance bars)
   for the tapped spot from the existing hourly series. Verify: headless card.
8h. **(Map) Saved places on the map**: favourites from `useFavourites` drawn as small pins with current temp + rain
   dot; tap → that place's card. Verify: headless with 2 seeded favourites.
8i. **(Map) "แชร์ภาพแผนที่"**: export the current view (map canvas + legend strip + time + source line) as an image via
   `src/components/share/render-share-image.ts` for LINE (needs `preserveDrawingBuffer` only during capture).
   Verify: headless download size > 0, text present.
8j. **(Map) "ข้อมูลล่าสุด" panel**: one row per source (radar, model run, dams, TMD rain, rivers, warnings) with its
   data time and age, in the เพิ่มเติม section — builds trust, explains "why didn't it change". Verify: headless.
8k. **(Desktop) Keyboard shortcuts**: Space play/pause, ←/→ ±1 h (±1 day in water mode), 1–4 layers, W/A mode, ? help
   dialog. Verify: headless key presses change state.
9. i18n/legend/attribution sweep ("River discharge: GloFAS via Open-Meteo (CC BY 4.0)"). Verify: i18n-check, legend tests.
10. Regression, push, verify:deploy, live check, memory. (v3.1 share image = separate small plan after a week.)

## Verification
Each task: `git diff`, its Verify, `npx vitest run --no-file-parallelism`, typecheck, lint, i18n-check; UI in headless
Chrome 390×844 + 1280×800, light + dark. Final: verify:deploy all 200 incl. /api/rivers, /api/dams-lastyear, /water;
live: /water lists river points with status + forecast, home card present in Bangkok, no ThaiWater requests.

## Risks
- GloFAS is a model (5 km, no gate operations) → wording above + drop bad points; users may still read it as gauge data.
- Open-Meteo Flood quota assumed shared with the forecast API — keep calls ≤ ~100/day.
- 3rd tab changes app navigation muscle memory; the map's น้ำ mode stays unchanged.
