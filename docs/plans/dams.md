# Plan: dam situation + where released water goes

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "ต้องการดูสถานการณ์เขื่อนด้วย และถ้าเขื่อนระบายน้ำหรือเขื่อนแตกน้ำจะมาทางไหน".
Design by Fable (thinker-fable); data facts verified by Claude with live requests on 2026-09-29.

Verified facts:
- ThaiWater (คลังข้อมูลน้ำแห่งชาติ, HII) `GET https://api-v3.thaiwater.net/api/v1/thaiwater30/public/thailand_main`
  is keyless JSON (~10 MB, CORS allows our origin). `dam.data.data` = 35 large dams with
  `dam_date` (daily; today = yesterday's date), `dam_storage` / `dam_storage_percent`,
  `dam_uses_water(_percent)`, `dam_inflow`, `dam_released`, `dam_spilled` (ล้าน ลบ.ม./วัน),
  `dam.dam_name.{th,en}`, `dam.dam_lat/dam_long`, `max_storage`, `basin`, `geocode.province_name`.
  `waterlevel.data.data` = 801 river stations: `waterlevel_datetime` (hourly), `storage_percent`
  (% of bank-full), `situation_level` 1–5, `discharge` (m³/s, 282 stations), `station.{tele_station_name,
  tele_station_lat/long, tele_station_oldcode, qmax, left_bank, right_bank}`.
- Official bands (ThaiWater `setting.scale`):
  dams — ≤30 yellow #FFC000 "น้ำน้อยวิกฤต (% ใช้การ)", 31–50 green #00B050, 51–80 blue #003CFA,
  81–100 red #FF0000 "น้ำมาก", >100 dark red #C70000 ; rivers — ≤10 น้ำน้อยวิกฤติ, >10 น้ำน้อย,
  >30 น้ำปกติ, >70 น้ำมาก, >100 น้ำล้นตลิ่ง.
- Chao Phraya Dam (barrage, no storage %) = station C.13 "ท้ายเขื่อนเจ้าพระยา": discharge 2,000 m³/s,
  qmax 2,720 today → shown as a special barrage marker.
- RID `app.rid.go.th/reservoir/api/dam/public` (35 dams, no coords) = fallback only.

## Decisions
- **Where the water goes = the river downstream of the dam, not a flood map.** Precompute each dam's
  downstream river path offline (HydroRIVERS `NEXT_DOWN` walk, CC-BY 4.0) to the sea / 400 km,
  simplified, committed as static GeoJSON. Along each path list the river stations it passes
  (live level + situation) and provinces whose capital is ≤ 15 km from the path.
- **Planned release vs dam failure are separated.** Release: path with arrows + downstream stations
  with live levels. Failure (hypothetical): no extent, no arrival time — only direction + official
  emergency guidance. Copy (Fable, kept):
  - card + legend: "เส้นนี้คือแนวลำน้ำท้ายเขื่อน ไม่ใช่ขอบเขตน้ำท่วม ฟ้าวันนี้ไม่พยากรณ์พื้นที่น้ำท่วม"
  - release: "น้ำที่ระบายจะไหลไปตามลำน้ำนี้ ระดับน้ำท้ายเขื่อนอาจสูงขึ้นในช่วง 1–3 วัน ติดตามประกาศจากกรมชลประทาน/ปภ. ในพื้นที่"
  - "กรณีเขื่อนแตก (สมมติ)": "แอปนี้ไม่มีข้อมูลจำลองเขื่อนแตก หากมีประกาศเตือน ให้ปฏิบัติตามคำสั่งอพยพของทางราชการทันที ขึ้นที่สูง ออกห่างจากลำน้ำ" + call buttons ปภ. 1784, กรมชลประทาน 1460 (EGAT number only if Claude verifies it).
- **Bands and colours = ThaiWater official scale** (Claude overrules Fable's guessed bands).
- **One route `/api/dams`**: fetch thailand_main server-side, keep dams + trimmed river stations
  (~100 KB raw), in-memory cache 60 min + `s-maxage=3600, stale-while-revalidate=86400`, stale on
  failure, `dataDate` + `stale` in the response. The 10 MB upstream exceeds Next's 2 MB data cache,
  so the upstream fetch is `cache: "no-store"` and only our normalized result is cached. Loaded only
  when the dam overlay is on (or the home rule needs it).
- **Units:** release/inflow shown as m³/s (= ล้าน ลบ.ม./วัน × 11.574) with ล้าน ลบ.ม./วัน underneath.
- **Home card only when actionable:** user within 10 km of a dam path AND (dam storage > 80 % OR the
  nearest downstream station to the user has situation ≥ 4 "น้ำมาก"). Title "เขื่อนเหนือน้ำของคุณ".
- MVP = 35 large dams + Chao Phraya barrage. No trends/history (needs a series source), no
  medium dams, no inundation, no arrival time, no push alerts.

## Where Claude disagrees with Fable
1. Bands: Fable's guessed colours/labels replaced by ThaiWater's published `setting.scale`.
2. "Towns along the path": Fable suggested amphoe centroids (new dataset); Claude uses the 801 river
   stations already in the feed (they come with live levels, which is what users need) + province
   capitals we already have.
3. Barrage release colour: from station C.13 `situation_level`, not a hard-coded channel capacity.

## Tasks (1 Codex dispatch each unless noted; Claude verifies diff + Verify + headless Chrome)
1. **Spike (Claude):** HydroRIVERS Asia download size/format, NEXT_DOWN walk for ภูมิพล reaches
   นครสวรรค์ → C.13 → Bangkok; decide shapefile reader (npm `shapefile` dev dependency vs GDAL).
   Verify: printed path length + stations matched. If it fails → BLOCKED, re-plan (OSM fallback).
   **Result (2026-09-29, DONE):** HydroRIVERS_v10_as_shp.zip 91 MB → 457 MB unzipped in `.cache/hydro`
   (gitignored); 253,052 reaches inside 90–112E / 3–24N, read in ~9 s with npm `shapefile` (no GDAL
   installed). 35/35 dams traced: snap = reach with the largest UPLAND_SKM ≥ 200 km² within 5 km
   (fallback ≥ 20 km² for small reservoirs — บางพระ); walk NEXT_DOWN to the sea or 700 km.
   ภูมิพล → 600 km to the Chao Phraya mouth (13.61N 100.56E), 37 stations incl. C.2; สิริกิติ์ → Bangkok,
   42 stations. Station match tolerance raised to 3 km (C.13 missed at 2 km). Task 4 uses these rules.
2. Fixture + `src/lib/dams/thaiwater.ts`: zod parse of `dam` and `waterlevel`, normalize to
   `Dam` / `RiverStation`, bands (official scale), unit conversion, barrage from C.13 (+ tests on a
   trimmed real fixture: missing fields, >100 %, no discharge). Verify: `npx vitest run src/lib/dams`
3. `/api/dams` route + cache + stale-on-failure (+ route tests like /api/pm25), add to
   verify-deploy. Verify: vitest + `curl -s localhost:3457/api/dams | node -e …` (35 dams, stations > 700, < 150 KB)
4. `scripts/dams/build-paths.mjs` (from task 1) → `public/data/dam-paths.geojson` (≤ 150 KB gz) +
   `public/data/dam-downstream.json` (station codes + provinces per dam, ordered by km). Verify:
   script run by Claude, sizes, every dam has a path, ภูมิพล list contains C.2 and C.13.
5. `use-dams-layer.ts`: circle markers (radius by capacity, fill by band), a "ระบายมาก" ring when
   `spilled > 0` OR storage > 100 % OR (storage > 80 % AND release ≥ inflow) — no history needed;
   barrage square coloured by C.13 situation; overlay chip "เขื่อน" + URL `ov=dams`.
   Verify: headless screenshot both themes, 36 markers.
6. Dam card (point-card variant): name, agency, river/basin, storage bar (band colour + %), inflow /
   release tiles, data date, disclaimer. Tap hit-test on dam markers. Verify: headless tap on ภูมิพล.
7. Downstream highlight: "ดูทิศทางน้ำท้ายเขื่อน" → lazy-load paths, draw line with direction
   arrows, fit bounds, list downstream stations (live situation colour) + provinces;
   "กรณีเขื่อนแตก (สมมติ)" block with tel: links. URL `dam=<id>`. Verify: headless, ภูมิพล path visible, list ≥ 5 items.
8. Legend rows (5 dam bands, barrage, release ring, path line "ไม่ใช่พื้นที่น้ำท่วม", 5 river
   situations) + attribution "ข้อมูลน้ำ: คลังข้อมูลน้ำแห่งชาติ (สสน.)". Verify: legend test + headless.
9. Home card rule (`src/lib/dams/near.ts` point-to-path distance + rule, tests) + card on home.
   Verify: vitest + headless with a place on the Ping river below ภูมิพล and a fixture where C.2 is level 4.
10. Regression, push, `npm run verify:deploy https://fahwanni.vercel.app`, live check.

## Risks
- ThaiWater payload 10 MB and schema may change → zod with safe fallbacks, stale cache, RID fallback later.
- HydroRIVERS snapping: dam coords may sit on the reservoir, not the wall → snap to the reach with
  the largest upstream area within 3 km; manual overrides file for bad ones.
- Liability: every surface showing a path repeats "ไม่ใช่ขอบเขตน้ำท่วม".

## Out of scope
Inundation extents, arrival times, dam-break modelling, medium/small dams, storage history/trends,
push notifications.
