# Plan: keep radar (and map data) fresh

Status: APPROVED (2026-09-29)

## Context
User (2026-09-29): "แล้วทำไมแผนที่ อัปเดตเมื่อ 575 นาทีที่แล้ว".
Claude's investigation (2026-09-29 02:35 UTC):
- Live `/api/radar` returned `generatedAt 01:30Z`, newest frame 01:30Z, twice in a row; RainViewer
  upstream at the same moment: generated 02:35Z, newest frame 02:30Z → server copy ≥ 65 min stale.
  `fetchRadar` uses `next: { revalidate: 300 }`; the shared fetch cache keeps serving the old copy
  when background revalidation fails, and the route has no freshness check.
- Client: `useMapData` fetches `/api/radar`, `/api/wind`, `/api/storms`, `/api/quakes` once on mount;
  only `nowIso` ticks every 60 s. A map left open / PWA resumed overnight keeps midnight's frames
  while "อัปเดตเมื่อ {n} นาทีที่แล้ว" grows (575 min). The service worker does not cache `/api/*`.

## Decisions
- Server: if the manifest's newest frame is older than 20 min, refetch once with `cache: "no-store"`;
  keep whichever is newer; response carries `stale: true` when the newest frame is still > 30 min old.
- Client: refresh radar every 5 min while visible and immediately on `visibilitychange` → visible /
  `online` when the last fetch is > 5 min old; wind/storms/quakes/pm25 (if loaded) refresh on return
  when > 60 min old. Keep the selected timeline position relative to "now" (stay on "now" if it was).
- Label: > 30 min → "เรดาร์ล่าช้า {n} นาที" in warning style (not a normal "อัปเดตเมื่อ").

## Tasks
1. `fetchRadar` freshness check + `stale` flag (+ tests with fake clock/fetch).
   Verify: `npx vitest run src/lib/radar`
2. `useMapData` periodic + visibility/online refresh, timeline stays on now (+ unit test of the
   refresh-decision helper). Verify: vitest + headless: fake timers advance 6 min → second `/api/radar` request
3. Stale label + i18n. Verify: headless with a routed stale manifest shows "เรดาร์ล่าช้า"
4. Push + `npm run verify:deploy https://fahwanni.vercel.app` + live `/api/radar` newest frame < 20 min old.
