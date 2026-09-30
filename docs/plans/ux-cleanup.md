# Plan: UX/IA cleanup + free NASA satellite data + keep-alive

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "ปรับ UX/UI ใหม่ให้เข้ากับเมนูตอนนี้ด้วย" · "ปรับ ux/ui ให้ใหม่หน่อย บางส่วนก็เกินๆขาดๆ" (after asking for more
recommendations and for data that needs no permission letter). The app grew feature by feature; live screenshots at
390×844 (Claude, today) show:
- Map water sheet: 30 buttons, scrollHeight 1,128 px, legend clipped in peek; much of it duplicates /water.
- Map weather sheet: 31 buttons; the 5-option layer picker wraps ("ดัชนีความร้อน", "ฝุ่น PM2.5" on 2 lines).
- /water ≈ 3,500 px: each river ≈ one screen; disclaimers repeated per river; empty boxes (no warnings / first visit /
  nothing watched) take full cards.
- Home: the water card sits ABOVE "ตอนนี้", its first line is truncated; 4 share buttons in a row.
- Water info in 3 places; emergency numbers in 3 places.
Goal: one job per screen, controls in one place, lists in one place, disclaimers once — structure only, no restyle.

## Decisions (Fable, checked by Claude)
- **Home** = my weather today + ONE water line: water card moves below "ตอนนี้", 2 lines max (nearest river status
  with "(แบบจำลอง)" + one line for a warning or a dam releasing heavily), whole card links to /water. Share row → one
  "แชร์" menu (LINE / แชร์ลิงก์ / รูปภาพ) + "อ่านให้ฟัง".
- **/water** = follow water: warnings and "มีอะไรใหม่" only when non-empty (one line each); ที่ติดตาม above rivers,
  hidden when empty; rivers and dams as compact rows (dot · name · km · status + arrow · value · ☆ · ⌄), nearest river
  expanded, others expand on tap; data date once per section header; ONE footer with emergency numbers, sources, GloFAS
  and 2554 disclaimers; heavy-rain section collapses to one line when empty. Target ≤ ~1,600 px.
- **Map** = explore + controls: a new **ชั้นข้อมูล dialog** (opened by the rail button; same `<dialog>` pattern as the
  legend) holds everything layer-related:
  - weather mode: ชั้นหลัก as a 2-column 44 px tile grid (ฝน, อุณหภูมิ, ดัชนีความร้อน, ฝุ่น PM2.5, เมฆ, + ดาวเทียม from N2),
    ซ้อนทับ switches (เรดาร์ฝน, ลม, พายุ, แผ่นดินไหว), แผนที่ (3D, เต็มจอ), "อ่านแผนที่ ›".
  - water mode: แสดงเขื่อน radios (ทั้งหมด / >80% / ระบายมาก / ติดตาม), ซ้อนทับ switches (เส้นทางน้ำทุกเขื่อน, ฝนตอนนี้
    (เรดาร์), ฝนสะสม 3 วัน [แบบจำลอง], น้ำท่วมจากดาวเทียม from N1), "อ่านแผนที่ ›".
  The sheet keeps: time bar / compact day stepper, legend strip, summary, tapped-feature card, a few context lines,
  ข้อมูลล่าสุด. Weather sheet ~12 buttons (from 31); water sheet drops filter chips, toggles, rain list, emergency
  numbers, hint.
- **Water peek** shows: ▶ ‹ วันนี้ · อ. 29 ก.ย. › (one compact stepper, aria-live) · dam legend strip · summary counts.
- **Rail (phone)**: ชั้นข้อมูล + แชร์ (menu: มุมมองนี้ / ภาพแผนที่). "เพิ่มเติม" row removed (3D/fullscreen → dialog).
- **Cards**: dam card first fold = storage, release/inflow, date, [เส้นทางน้ำ]; the rest (sparkline, last year/2554,
  provinces, dam-break) under "รายละเอียดเพิ่มเติม"; river card drops its own footer — one water-mode footer line.

## Free water data (user: "หาวิธีดึงข้อมูลน้ำจากแหล่งข้อมูลอื่นๆที่ฟรีได้มั้ย") — all checked live today
**Usable now, no request, published terms:**
| Source | What | Freshness | Check |
|---|---|---|---|
| NASA GIBS `VIIRS/MODIS_Combined_Flood_1/2/3-Day` | observed flood water from satellite | daily (latest = yesterday); gaps under cloud | tile over TH 200, CORS * |
| NASA GIBS `Himawari_AHI_Band13_Clean_Infrared` | satellite clouds / storm tops | every 10 min, ~1 h behind | 200 |
| NASA GIBS `IMERG_Precipitation_Rate_30min` | satellite rain rate incl. sea & neighbours | every 30 min, ~6 h behind | 200 |
| Open-Meteo Marine `sea_level_height_msl` | tide model at the Chao Phraya mouth (13.46 N, 100.63 E) | hourly forecast; today 2.7 m range, high ~06:00 | 200 (model, CC BY) |
| Open-Meteo Flood (GloFAS) | river discharge — already used (11 points) | daily | in use |
| HII open data on data.go.th (CC BY-NC) | real station water level / rain per station | monthly, 1–2 months late (latest 2026-07) | files listed |
| Provincial open data on data.go.th (Open Data Common / CC BY) | medium reservoirs, local gauges | static CSV, monthly/yearly | listed |
| OpenStreetMap (ODbL) | canal/klong shapes | static | — |
**Free but needs a sign-up by the user (not a permission letter):**
- Mekong River Commission API (real Mekong gauges Chiang Saen → Nong Khai → Mukdahan; API returned 401 without a key).
- GISTDA flood API (Thai satellite flood extent; free key).
- Google Flood Hub API (waitlist).
**Not usable:** RID `/api/rsvmiddle/public` (medium reservoirs) exists but returns PHP errors and is undocumented;
MWA Chao Phraya level API on data.go.th has "License not specified"; live HII/ThaiWater gauges still need the letter.

## Tasks (1 Codex dispatch each; Claude verifies diff + Verify + screenshots; commit per task)
UX (map tasks strictly in order — they share map-view.tsx / water-panel.tsx):
1. Home water card: below ตอนนี้, 2-line compact, whole card links to `/water`; unify links on `mode=water`.
   Files: weather-app.tsx, water-near-you.tsx. Verify: screenshots light/dark, no truncation on line 1.
2. Share menu on home: one "แชร์" button → menu (LINE / แชร์ลิงก์ / รูปภาพ), focus returns. share-button.tsx.
3. River/dam compact rows: split RiverDetails into row header + body (`expanded`), disclaimers behind a flag.
4. /water restructure per Decisions (empty states, order, single footer). water-page.tsx. Verify: page ≤ ~1,600 px,
   nearest expanded, no empty boxes.
5. Layers dialog (weather groups) + rail wiring; PrimaryPicker `variant="grid"`; remove picker/layers/more from the
   sheet. New layers-dialog.tsx; map-view, map-panel-content, primary-picker, action-rail, globals.css.
6. Layers dialog water groups: move filters + route/radar/rain-accum toggles from WaterPanel into the dialog.
7. Water peek: compact stepper + legend strip + summary first in WaterPanel; peek fits on day 0 and day 7.
8. Water sheet trim: delete rain list, emergency numbers, hint; keep watched, nearest dams, search, freshness.
9. Phone rail share menu (มุมมองนี้ / ภาพแผนที่); delete "เพิ่มเติม".
10. Dam card progressive disclosure; river card footer → one water-mode footer.
New data (plugs into the dialog):
N1. น้ำท่วมจากดาวเทียม (water overlay, default on): GIBS VIIRS Combined Flood 2-Day at yesterday (MODIS fallback),
    badge "สังเกตจากดาวเทียม · ล่าช้า ~1 วัน · ใต้เมฆมองไม่เห็น", legend, freshness row, attribution NASA LANCE/GIBS.
N2. ดาวเทียม (weather primary tile): GIBS Himawari IR at the newest 10-min time (times from a small cached
    `/api/satellite`), label "ภาพดาวเทียม {time} น.", freshness row.
N3. ฝนจากดาวเทียม (IMERG) overlay in the layers dialog, "ล่าช้า ~6 ชม." — fills radar gaps over sea/neighbours.
N4. น้ำขึ้นน้ำลงปากเจ้าพระยา (tide model): `/api/tide` (Open-Meteo Marine, cached 3 h) → a small 48 h tide chart in the
    Bangkok/Chao Phraya river cards and on /water when the place is in the lower Chao Phraya provinces; wording
    "แบบจำลอง · ไม่ใช่ตารางน้ำทางการของกรมอุทกศาสตร์"; high-tide times listed.
N5. ระดับน้ำจริงเดือนก่อน (HII open data, CC BY-NC): offline script pulls last available month for stations near the
    11 river points → "ระดับน้ำที่สถานีจริง (เดือน ก.ค.)" context line + normal range; clearly dated. Lower priority.
(If the user signs up: MRC key → live Mekong gauges at Nong Khai/Mukdahan; GISTDA key → Thai satellite flood layer.)

More recommendations (added at the user's request "มีอะไรแนะนำเพิ่มใส่มาได้เลย"; run after N1–N5, before K1–K4):
R1. **จุดความร้อน (ไฟป่า/เผา)** — NASA GIBS VIIRS thermal anomalies (daily vector tiles, free, no key; tile path/format
    to be confirmed in the task — a first probe 404'd). Overlay in the layers dialog, highlighted in the PM2.5 season
    (Jan–Apr, north) next to the PM2.5 layer: "จุดความร้อนจากดาวเทียม ~1 วัน". Explains *why* PM2.5 is high.
> R1 note (Claude, 2026-09-30): GIBS thermal-anomaly `.mvt` WMTS tiles 404 for every layer/date/zoom; switched to the GIBS **WMS** raster (`wms.cgi`, `BBOX={bbox-epsg-3857}`), 200 + CORS *, verified headless.
R2. **พื้นที่ที่มีน้ำบ่อยในอดีต** — JRC Global Surface Water occurrence tiles (free, CC BY; tile 200 checked) as a context
    overlay in water mode: "พื้นที่ที่เคยมีน้ำขัง 1984–2021 (ไม่ใช่การพยากรณ์)". Helps read the satellite flood layer.
R3. **"วันนี้ต้องรู้"** card at the top of home: 3 short lines — best/worst rain window today, heat band, water status
    (reuses existing advice, rain series, heat index, river status); the detailed cards stay below.
R4. **แนะนำเมนูใหม่** — one-time, dismissible 3-step tip after this release (แท็บน้ำ · ปุ่มชั้นข้อมูล · ดาวเทียม/น้ำท่วม),
    stored in localStorage, never shown again; because this plan moves controls people already know.
R5. **เทียบสถานที่** — favourites compared in one table on home (อุณหภูมิ, ฝน, PM2.5, สถานะน้ำใกล้) — tap a row switches place.
R6. **ความเร็วบนมือถือรุ่นล่าง** — measure the JS each route loads (`next build` output), keep MapLibre and map-only code
    out of the home/water bundles, Lighthouse mobile run on /, /water, /map; fix the top 2 findings.
R7. **เข้าถึงได้ทุกคน** — text alternatives: each chart (river 7-day, 24 h point chart, dam sparkline) gets a short
    `aria-label` summary + a "ดูเป็นตาราง" toggle; the map region gets a one-line spoken summary of what is shown.
Keep-alive (after the above; code tasks):
K1. CI (`.github/workflows/ci.yml`): typecheck, lint, vitest (perf skipped), i18n on push; `verify:deploy` every 6 h.
D1. **เขื่อนหายช่วงเช้า** (added 2026-09-30, user-approved): RID's report for today can list all 35 dams while
    `volume`/`percent_storage` are still null for many (09:23 today: 24 of 35 null, incl. ภูมิพล/สิริกิติ์; the 2026-09-29
    report is complete). `parseRidDams` drops those rows → site showed 11 dams. Fix in `src/lib/dams/client.ts` (+ `rid.ts`):
    when today's parse has fewer dams than rows with a registry id, fetch `…/api/dam/public/{previous day}` (same parser,
    same timeout/revalidate) and add each missing dam from it, keeping that dam's own `date` (the card already shows
    "ข้อมูลวันที่ {date}"). Never replace a dam that has today's value; never go back more than 1 day; if the previous-day
    fetch fails, return today's dams as now. `dataDate` stays today's. Unit tests with fixtures: partial today + full
    yesterday → 35 dams, mixed dates; yesterday fetch fails → today's only; today complete → no second fetch.
    Verify: `npx vitest run --no-file-parallelism src/lib/dams && npm run typecheck && npm run lint`, then Claude checks
    `/api/dams` returns 35 dams with ภูมิพล dated 2026-09-29 while RID is partial.
K2. `error.tsx` + `global-error.tsx` (Thai) + `/api/log` for client errors (no PII, rate-limited).
K3. Lite mode (`src/lib/device.ts`: reduced motion / ≤ 4 GB / ≤ 4 cores / Save-Data) → no wind particles, static
    flow line, no 3D, no cross-fade; normal mode stops the flow animation after 60 s; toggle in the layers dialog.
K4. Geocode 429 guard (the only route without stale-serving).
11. Sweep: orphaned i18n keys, shortcuts help text, legend, attribution (NASA), README sources; regression, push,
    verify:deploy, live screenshots, memory.

## For the user (no code)
Optional free sign-ups: MRC data portal (Mekong gauges), GISTDA API (flood key). Rotate + restrict the Google key (Weather + Air Quality only, daily quota cap), update Vercel + `.env.local`; send
the สสน./กฟผ. letters (real live gauges still need them); optionally 20 min in Vercel Analytics.

## Deferred
Push notifications, 0.5° rain grid, OSM canals, daily water share image, merging dam/river search
into the map search pill, visual restyle.

## Verification
Each task: diff, Verify, full vitest, typecheck, lint, i18n; screenshots at 390×844 + 1280×800, light + dark, both map
modes, peek + half. Final: verify:deploy all 200; live: sheet button counts (weather ≤ ~12, water markedly fewer),
/water ≤ ~1,600 px, home water card below ตอนนี้, NASA flood + satellite layers load.
