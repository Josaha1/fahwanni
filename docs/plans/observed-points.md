# Plan: observed points for rivers with no GloFAS point (dam release + real level)

Status: APPROVED 2026-09-30.

## Context
User (2026-09-30): "แม่น้ำแม่กลอง ยังไม่มีจุดวัดแม่น้ำนี้ในแอป ต้องการให้หาจุดวัดให้หน่อย" → chose **"Dam release + real level"**,
then "ต้องการให้ทำที่อื่นๆด้วย". The rivers with no point today (in `src/lib/water/rivers.ts`) get one "observed point" each,
showing (a) the **total release today from the dams upstream** (RID, measured daily) with a 7-day trend, and (b) **last month's
measured water level** at one pinned HII station (open data CC BY-NC, monthly, latest 2026-07). No model, **no status colour**
(there's no climatology to compare against — made-up numbers not allowed). Design: Fable; stations and data checked by Claude.

## Points (Claude checked every station: type = water level, has a 2026-07 CSV)
| id | HII station | dams summed |
|---|---|---|
| maeklong-ratchaburi | RAJ001 โพธาราม 13.63307, 99.81636 | 200401 ศรีนครินทร์, 200402 วชิราลงกรณ |
| nan-phitsanulok | NAN012 เมืองพิษณุโลก 16.864717, 100.24477 | 200102 สิริกิติ์, 100107 แควน้อยบำรุงแดน |
| pasak-ayutthaya | PAS009 นครหลวง 14.40269, 100.58636 | 100301 ป่าสักชลสิทธิ์ |
| bangpakong-chachoengsao | BPK003 บางน้ำเปรี้ยว 13.870314, 101.145744 | 100501, 100502, 100514 |
| sakaekrang-uthaithani | SKG002 เมืองอุทัยธานี 15.37083, 100.04418 | 100302 ทับเสลา |
| thachin-suphanburi | THA005 เมืองสุพรรณบุรี 14.47051, 100.11473 | **none** (the Tha Chin mainly takes water from the Chao Phraya; กระเสียว is a small tributary) → level only |
| songkhram-nakhonphanom | SKM004 ศรีสงคราม 17.674871, 104.28583 | **100202 น้ำอูน only** (น้ำพุง drains into หนองหาร, not the Songkhram) |
| phetchaburi-mueang | PCH001 เมืองเพชรบุรี 13.08563, 99.94397 | 200601 แก่งกระจาน |
| pranburi-mueang | PRN001 ปราณบุรี 12.38992, 99.91118 | 100602 ปราณบุรี |
Also correct `rivers.ts`: สงคราม dams = [100202] (remove 200203).

## Approach
- Config `public/data/observed-points.json`: `{ id, river, nameTh, nameEn, provinceId, lat, lon, dams[], gauge }` (lat/lon = the station's).
- `/api/rivers` returns these as extra rows `kind: "observed"`, `summary: null`, plus `release: null | { today:{date,totalCms,missing[]}, trend,
  dams:[{damId,releaseCms}], days:[{date,totalCms}] }`; existing rows get `kind: "model"`. If GloFAS fails but RID works, it must not 503.
- Daily release: add `release` to `buildTrend` in `src/lib/dams/trend.ts`, move the fetch of the 7 RID reports into `src/lib/dams/trend-source.ts`
  used by both routes. Sum it in pure `src/lib/rivers/observed.ts` (a dam that didn't report goes in `missing`; never treat it as 0).
- HII: `scripts/hii/build-gauges.mjs` reads observed-points.json; a pinned code skips `nearestStation`.
- Wording: row "ระบายจากเขื่อน {n} ลบ.ม./วินาที ↗ · วัดจริง"; detail "น้ำที่เขื่อน{ชื่อ}ระบายเมื่อ {date} — ไม่ใช่ปริมาณน้ำที่ไหลผ่าน{สถานี}";
  missing → "({เขื่อน} ไม่รายงานวันนี้)"; no dams → level only + "ยังไม่มีข้อมูลรายวันสำหรับจุดนี้". Level reuses the existing gauge line, which already shows the month.
- Home water card (`water-near-you.tsx`): skip observed points (the card uses status). Favourites/near: already skip anything without a summary.

## Tasks (Codex, 1 per dispatch; run after the 3D dam task 6, because both touch point-card.tsx)
O1. Config + types + test — `public/data/observed-points.json`, `src/lib/rivers/types.ts`, `src/lib/rivers/observed.test.ts`
    (ids unique and not in river-points, dams exist in the registry, provinceId valid, gauge code format).
    Verify: `npx vitest run --no-file-parallelism src/lib/rivers/observed.test.ts`
O2. Release trend + sum — `src/lib/dams/trend.ts`, new `src/lib/dams/trend-source.ts`, `src/app/api/dams-trend/route.ts`,
    `src/lib/rivers/observed.ts` + tests. Verify: `npx vitest run --no-file-parallelism src/lib/dams src/lib/rivers`
O3. HII pinned stations — `scripts/hii/build-gauges.mjs` (+ gauges test); Claude runs
    `node scripts/hii/build-gauges.mjs --max-requests 15` (needs network). Verify: `node scripts/hii/build-gauges.mjs --check` and the json has all 9 new ids
O4. `/api/rivers` emits the observed rows — `src/app/api/rivers/route.ts` (+ route test with mocks).
    Verify: vitest route test; Claude: `curl localhost:3457/api/rivers` shows 9 observed rows with release/gauge
O5. UI + search — `river-details.tsx` (observed branch instead of the early return at :76; 7-day release chart without a band),
    `point-card.tsx`, `use-river-layer.ts` (neutral marker), `water-page.tsx` + watchlist/whats-new (unit "ระบาย", no "แบบจำลอง" text),
    `water-near-you.tsx` skip, `src/lib/water/rivers.ts` (fill `points`, drop `noPointReason`), i18n EN.
    Verify: `npx vitest run --no-file-parallelism && npm run typecheck && npm run lint && node scripts/i18n-check.mjs`
O6. Headless check by Claude — /water search "แม่น้ำแม่กลอง" → the point shows release + level; map water mode has a neutral marker;
    screenshots light/dark; push → verify:deploy.

## Watch out
- RID morning back-fill: today's date may be yesterday → always print the date.
- Open-Meteo quota: start the dev/prod server only once per check.
- BPK003 is above where Khlong Si Yat joins → the text must say the level ≠ the flow from the dams.

## Out of scope
Status colour for observed points, GloFAS for these rivers, RID real-time gauges / HII live API (need permission), the 3D dam (a separate plan).
