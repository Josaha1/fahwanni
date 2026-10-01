# Plan: every dam, flood events, flood-risk areas

Status: APPROVED 2026-10-01.

## Context
User (2026-09-30/10-01): "ต้องการให้เห็นทุกเขื่อน ทุกการแจ้งน้ำท่วม พื้นที่ประสบภัย" (after "ในแม่กลอง สมุทรสงครามก็มีเขื่อน").
Research: Fable; Claude re-checked every source live on 2026-10-01 (HTTP 200 + licence on the catalogue page).
Rule: only sources with published terms.

## Sources (all checked)
| Need | Source | Licence (from the catalogue) | Checked |
|---|---|---|---|
| Dams (medium) | DWR `api.dwr.go.th/twsapi/public/v1.0/MediumSizeWaterResources(Info)` — 97 reservoirs, coordinates, capacity, storage | data.go.th: Creative Commons Attributions (กรมทรัพยากรน้ำ) | 200; storage for some reservoirs is old → always show the date |
| Dams (small) | DWR `SmallSizeWaterResources(Info)` — 687 reservoirs (owners include RID and HII), storage updated 2026-10-01 | Creative Commons Attributions | 200; capacity is often 0 → don't compute % |
| Dam locations not covered above | OpenStreetMap `waterway=dam` ~1,463 points (snapshot at build time, Overpass) | ODbL | 200 (needs a User-Agent) |
| Flood events | GDACS `eventlist=FL&country=Thailand` | GDACS Terms of Use (already used for storms) | 200, 3 events since 2025 |
| Disaster events | HDX `tha-glide-events` (ADRC GLIDE), 109 events, updated 2026-09-30 | CC BY-IGO | package_search OK |
| Risk areas | DDPM `floodrisk_rg` FeatureServer, 80,386 village points, flood-risk level | catalog.disaster.go.th: Creative Commons Attributions | 200 count=80386; data from 2024 → label it "ความเสี่ยงจากประวัติ" |
**Not available as open data:** daily announcements of ประกาศเขตพื้นที่ประสบสาธารณภัย (only annual statistics); RID's ~400 medium dams
(no documented API; some may be in the DWR small list); Copernicus EMS (no activations for Thailand).

## What the user sees
- Map, water mode: layer **"เขื่อน/อ่างทั้งหมด"** (clustered): the 35 RID dams as now + DWR reservoirs (latest storage + date if any) +
  OSM dam points (name/location only, "ไม่มีข้อมูลน้ำรายวัน"). Tapping one opens a card. Search finds every dam by name.
- /water + map: **"เหตุการณ์น้ำท่วม/ภัยพิบัติ"** from GDACS + GLIDE (date, provinces, alert level, source link), newest first.
- Map: layer **"พื้นที่เสี่ยงน้ำท่วม (ปภ.)"** — village points with risk level, loaded per viewport, from zoom ≥ 9, clearly labelled as historical risk, not a current flood.

## Tasks (one at a time; Codex quota resets 5 Oct — Claude writes until then)
A1. `src/lib/dams/dwr.ts` + test + fixture: normalise DWR Info + observations → `{ code, name, lat, lon, capacityMcm|null, storageMcm|null,
    pct|null (only when capacity > 0), measuredAt|null, size, owner }`, drop rows without coordinates or with lat/lon outside Thailand.
    Verify: `npx vitest run --no-file-parallelism src/lib/dams/dwr.test.ts`
A2. `/api/dams-all`: RID 35 + DWR, dedupe against RID (name + < 2 km), cache 6 h + stale; attribution field.
    Verify: route test with mocks + `curl localhost:3457/api/dams-all | jq '.total'` (≈ 35 + 700+)
A3. `scripts/osm/build-dams.mjs` → `public/data/osm-dams.json` (Overpass with User-Agent, retry; build-time only, never at runtime),
    drop points within 1 km of RID/DWR. Verify: `node scripts/osm/build-dams.mjs && node -e "…length"` (≈ 1,000–1,500)
A4. Map layer + clustering + card + legend + attribution "DWR CC BY · © OpenStreetMap ODbL" + layers-dialog switch + search over every dam.
    Verify: vitest/typecheck/lint/i18n + headless screenshot zoom 6/10
B1. `/api/flood-events`: GDACS FL (reuse `src/lib/storms/gdacs.ts`) + GLIDE geojson (HDX), last 60 days, cache 30 min.
    Verify: route test + `curl localhost:3457/api/flood-events | jq '.items|length'`
B2. /water "เหตุการณ์น้ำท่วม/ภัยพิบัติ" section (hidden when empty) + map markers. Verify: component test + screenshot
C1. `/api/flood-risk?bbox=` proxy to DDPM FeatureServer (outSR=4326, resultRecordCount ≤ 2000, cache 1 day, bbox size limit) + map layer
    from zoom 9. Verify: route test + `curl "localhost:3457/api/flood-risk?bbox=100.4,13.6,100.7,13.8" | jq '.features|length'`
D1. README sources + memory data-source-rule (DWR/GLIDE/DDPM licences) + verify-deploy adds the 3 new APIs; push; verify:deploy; live screenshots.

## Watch out
- DWR medium storage is sometimes old → always show `measuredAt`; never write "วันนี้".
- Small reservoirs with capacity 0 → no %, show only the volume in million m³.
- The DDPM server has flaky DNS → stale cache + a "not available right now" message, never a blank screen.
- Don't let these layers hurt map performance: clustering, plus the risk layer loads only at zoom ≥ 9.
- `public/data/osm-dams.json` is a derived database → ODbL attribution required.
