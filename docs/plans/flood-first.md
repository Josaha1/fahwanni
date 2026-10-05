# Plan: flood-first app — น้ำท่วมตอนนี้ / การระบายน้ำ / ฝนสะสม (Thailand only, real data only)

Status: APPROVED 2026-10-05 (merged with Fable's second report). Replaces the what-if parts of `docs/plans/3d-flood-cams.md`.

## Context
User (2026-10-05): "ไม่ต้องการระดับน้ำสมมุติ ต้องการระดับน้ำจริงๆที่มีรายงานปัจจุบันเลย และต้องการปรับ UX/UI ทั้งหมด … ตอนนี้ต้องการเกี่ยวกับ
เรื่องน้ำท่วมเป็นหลัก" → chose "Remove simulation, hide the rest"; then "ออกแบบให้เลย เจาะลึกสถานการณ์น้ำท่วม/การระบายน้ำ/ฝนตกสะสม
เจาะเฉพาะประเทศไทย". Design: Fable (IA, wording, flags) + Claude (three pillars, code facts). Rule: published terms, no sign-ups.

## Honest data position (checked 2026-10-05)
- No free, licensed, CURRENT river water level exists: HII open data (CC BY-NC) newest month is July 2026 (Aug–Sep folders
  empty); ThaiWater live needs the HII letter (draft in `docs/permissions/data-requests.md`, not sent); RID hydro pages have no terms.
- So the app shows **real reported data** we may use: RID 35 dams (daily inflow/release/storage), DWR 784 reservoirs, NASA VIIRS
  satellite flood (observed, ~1 day), GDACS + GLIDE events, TMD warnings + 24 h station rain, RainViewer radar, DDPM risk villages;
  **models clearly tagged "แบบจำลอง"**: GloFAS rivers, tide, Open-Meteo rain forecast/accumulation.
- Wording: never "ระดับน้ำ" for rivers (we have none) → "ปริมาณน้ำ/การระบาย"; every number = value · source · date/time.

## Merged after Fable's second report (adopted)
- Routes: `/` = ท่วมตอนนี้ (new FloodHome) · `/water` = ระบายน้ำ (existing page reordered; keeps old links working, no redirect)
  · `/rain` = ฝน (existing WeatherApp + new rain pillar on top, non-rain cards flagged off) · `/map`. (Replaces `/dams` and `/forecast` below.)
- Every pillar: ภาพรวมประเทศ (3 numbers) → ใกล้ฉัน → จังหวัด chip (default = nearest province, `?province=` in URL).
- "ฝนรอบเขื่อน (ไม่ใช่ทั้งลุ่มน้ำ)" — no basin polygons, so never claim catchment totals.
- Old map links with hidden layers (pm25/heat/temp…) open rain + toast "ชั้นข้อมูลนี้ปิดไว้ชั่วคราวช่วงน้ำท่วม".
- Never write "ปลอดภัย"; use "ไม่พบ" for absence. Downstream provinces "โดยประมาณ", max 4.
- Shared `<SourceTime>` chip; `freshnessRows` moves to `src/lib/freshness.ts` and is reused on all pages.
- Bump app version so installed PWAs don't keep the old home; reset the menu-tip key; check EN tab labels at 390 px.

## New structure (4 tabs, 390 px first)
**น้ำท่วม `/`** — "สถานการณ์น้ำท่วมตอนนี้"
- Top: TMD warning card (or "ไม่มีประกาศเตือนภัย · กรมอุตุฯ {time}" — absence is information) + emergency 1784 inside warnings.
- **ใกล้บ้านคุณ** (answers "น้ำจะท่วมบ้านฉันไหม"), four fixed rows: ดาวเทียมเห็นน้ำท่วมในรัศมี 30 กม. (ใช่ / ไม่เห็น / เมฆบัง — by
  sampling NASA flood tile pixels around the place) · หมู่บ้านเสี่ยง ปภ. ใกล้คุณ · ฝน 24 ชม. สถานีใกล้สุด (TMD) · เขื่อนต้นน้ำระบาย
  (name, m³/s, ↑↓ vs yesterday) → "ดูบนแผนที่".
- **ทั้งประเทศ**: provinces with flood events in the last 14 days (GLIDE/GDACS places), satellite-flood count by region (from
  the same pixel sampling over a coarse national grid, cached server-side 6 h), active TMD warnings by region.
- Then: เหตุการณ์ 90 วัน, มีอะไรใหม่/ติดตาม, quiet note "ยังไม่มีระดับน้ำแม่น้ำแบบเรียลไทม์ — ใช้ข้อมูลเขื่อนรายวันและดาวเทียมแทน",
  ข้อมูลล่าสุด, footer with emergency numbers.

**ระบายน้ำ `/dams`** — "การระบายน้ำจากเขื่อน"
- National summary: total release today vs yesterday (35 RID dams), dams > 80 % / > 100 %, dams releasing more than inflow.
- **เขื่อนที่ปล่อยน้ำมาก** (top by release, with downstream provinces from the existing dam-route data).
- Full table (sortable: release / inflow / % / change 7 d), region filter; near-me first.
- Drill-down `/dams/[id]`: 7-day release & inflow & storage chart (add inflow to the trend API), last year / 2554 same day,
  downstream provinces + route on map, observed river point fed by this dam (summed release), DWR reservoirs nearby.

**ฝน `/rain`** — "ฝนตกสะสม"
- Observed: TMD 24 h station rain — top stations nationally, by region, nearest to you (with time).
- Radar now (thumbnail → map).
- Model (tagged): accumulated rain 1 / 3 / 7 days at your place and **over each big dam's area** (mean of the model grid within
  30 km of the dam) → "ฝนที่จะตกเหนือเขื่อน x ใน 3 วัน ≈ y มม." (links rain → drainage).
- Link "พยากรณ์อากาศรายวัน" → `/forecast` (the current weather home, trimmed to rain-relevant cards).

**แผนที่ `/map`** — opens water mode; on by default: dams, satellite flood, flood events, radar; off but listed: DDPM risk villages,
DWR/OSM reservoirs, JRC historical water, rain accumulation (แบบจำลอง), dam routes, 3D buildings, 3D terrain. Weather mode keeps
rain only. Map + search clamped to Thailand.

## Hidden for now (feature flags, code kept) — `src/lib/features.ts`, `FOCUS = "flood"`
PM2.5 (card + map layer), airport METAR, marine/sea/coral, farm card + farmer mode setting, long weekend, sun/moon/night sky,
quake card + overlay, El Niño badge, favourites comparison table, heat/temp/cloud/Himawari primaries, wind/storm/fire/IMERG overlays,
share-image AQI. Restoring = `FOCUS = "full"`.

## Deleted
What-if simulation (flood-sim lib, depth layer, panel, flood probe/card, en/flood.ts sim keys). 3D buildings stay.

## Tasks (Codex, one at a time; Claude verifies with diff, Verify, regression, 390 px screenshots)
1. Delete the simulation — Verify: `grep -rn "flood-sim\|floodDepth\|FloodDepth" src | wc -l` = 0; typecheck; `npx vitest run src/lib/map`.
2. `src/lib/features.ts` + flags on home cards, map layers/primaries, settings, share images — Verify: vitest features + components; typecheck; lint.
3. Routes + 4-tab nav: `/` FloodHome, `/dams`, `/dams/[id]`, `/rain`, `/forecast`, `/water` → 308 to `/`; bottom-nav (incl. new-dot logic),
   metadata, menu tip key reset, today-brief link, SW/version bump — Verify: build; `curl -sI /water` → 308 Location /; i18n.
4. `SourceLine` + `staleness(date, kind, now)` (dams > 2 d, rain > 36 h, satellite > 3 d → amber "ข้อมูลเก่า") on every number — Verify: vitest water.
5. Satellite-flood sampling:
   **Decided by Claude (Codex asked for a Thailand mask):** province polygons from geoBoundaries `gbOpen/THA/ADM1` simplified
   (77 provinces, ODbL via OpenStreetMap, file `public/data/th-provinces-adm1.geojson`, server-only use); a flood pixel counts for the
   province whose polygon contains it; pixels outside all 77 polygons (neighbouring countries, sea) are ignored. Attribution: geoBoundaries / © OpenStreetMap.
   pure lib reading NASA GIBS flood tile pixels (CORS *) → near-me verdict (+ cloud/no-data) and a server
   `/api/flood-now` national grid summary by region (6 h cache) — Verify: lib tests with fixture tiles; curl.
6. **Decided by Claude (Codex asked):** `/api/rain-risk` drops stations ≤ 35 mm, so `RainRisk` gains `all: [{id,nameTh,nameEn,provinceTh,lat,lon,rainMm}]`
   (every reporting station with valid TH coordinates, incl. 0 mm); `stations` (heavy only) unchanged. Nearest station + task 8 use `all`.
   FloodHome (`/`): warnings, ใกล้บ้านคุณ, ทั้งประเทศ, events, note, freshness, footer — Verify: Playwright 390 px: warning/near-me/map CTA within 760 px.
7. **Decided by Claude (routes merged after Fable's 2nd report):** the dams pillar is the existing `/water` page (top section added), drill-down = `/water/dam/[id]`; no `/dams` route.
   Dams page + drill-down; trend API adds inflow — Verify: vitest dams; Playwright `/dams` and `/dams/200101`.
8. Rain page: TMD stations national/region/near, radar thumb, model accumulation 1/3/7 d at place + per dam area — Verify: lib tests; Playwright `/rain`.
9. Map defaults (water mode, default layers, rain-only weather mode) + Thailand clamp (map bounds, geocoding TH only) — Verify: map-state/url-state tests (`?layer=pm25` → rain; empty URL → water mode).
10. Share flood summary (text + image), i18n sweep, README, verify-deploy paths (/dams, /rain, /forecast, /api/flood-now), push, live screenshots, memory.

## Out of scope
New data sources (ThaiWater letter is yours to send), shelters (no licensed source), visual restyle, settings toggle for focus.
