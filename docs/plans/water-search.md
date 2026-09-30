# Plan: water search finds rivers (and the dams on them)

Status: APPROVED 2026-09-30 (user chose "Search by river too").

## Context
User: "ตรงค้นหาเขื่อนหรือแม่น้ำ ค้นหา แม่น้ำแม่กลอง ไม่เจอ". Claude found three causes in `src/lib/water/find.ts`:
1. There is no Mae Klong river point. It was dropped on purpose in water-v3 (`scripts/rivers/build-points.mjs:20`) because the flow
   there is controlled by the ศรีนครินทร์/วชิราลงกรณ dams, which GloFAS doesn't model. The same is true for น่าน, ป่าสัก and บางปะกง.
2. Search matches only dam names and river-point names. It doesn't know which river each dam is on.
3. `normalize` strips only "เขื่อน", not "แม่น้ำ"/"River", so even "แม่น้ำเจ้าพระยา" finds nothing today.

## Task S1 (one Codex dispatch)
Files: `src/lib/water/find.ts` (+ `find.test.ts`), new `src/lib/water/rivers.ts`, `src/components/map/ui/water-panel.tsx`
(`WaterFinder`), `src/i18n/en/*.ts`.

1. `normalize`: also strip a leading "แม่น้ำ", "ลำน้ำ", "น้ำ " (only as a whole prefix word), and in English a
   trailing/leading "river"/"the"; collapse spaces. "แม่น้ำเจ้าพระยา" → "เจ้าพระยา", "Mae Klong River" → "mae klong".
2. `src/lib/water/rivers.ts` — a static river table (Claude supplied the data; ids = RID dam ids):
   | river (th / en, aliases) | dam ids | has point |
   |---|---|---|
   | ปิง / Ping | 200101 ภูมิพล, 100104 แม่กวงอุดมธารา, 200103 แม่งัดสมบูรณ์ชล | ping-chiangmai |
   | วัง / Wang | 100105 กิ่วลม, 100106 กิ่วคอหมา | wang-lampang |
   | ยม / Yom | 100108 แม่มอก | yom-sukhothai |
   | น่าน / Nan | 200102 สิริกิติ์, 100107 แควน้อยบำรุงแดน | — |
   | เจ้าพระยา / Chao Phraya | 200101, 200102, 100107, 100301 | chaophraya-* (3) |
   | ป่าสัก / Pa Sak | 100301 ป่าสักชลสิทธิ์ | — |
   | สะแกกรัง / Sakae Krang | 100302 ทับเสลา | — |
   | ท่าจีน / Tha Chin (alias สุพรรณบุรี river? no — alias "แม่น้ำสุพรรณ") | 100303 กระเสียว | — |
   | แม่กลอง / Mae Klong (aliases แควใหญ่/Khwae Yai, แควน้อย/Khwae Noi) | 200401 ศรีนครินทร์, 200402 วชิราลงกรณ | — |
   | ชี / Chi | 200205 อุบลรัตน์, 200204 จุฬาภรณ์, 100206 ลำปาว | chi-yasothon |
   | มูล / Mun (alias Moon) | 100207 ลำตะคอง, 100208 ลำพระเพลิง, 100209 มูลบน, 100210 ลำแชะ, 100211 ลำนางรอง, 200212 สิรินธร | mun-ubon |
   | โขง / Mekong (alias Khong) | 100201 ห้วยหลวง, 100202 น้ำอูน, 200203 น้ำพุง | mekong-nongkhai |
   | สงคราม / Songkhram | 100202, 200203 | — |
   | บางปะกง / Bang Pakong | 100501 ขุนด่านปราการชล, 100502 คลองสียัด, 100514 นฤบดินทรจินดา | — |
   | เพชรบุรี / Phetchaburi | 200601 แก่งกระจาน | — |
   | ปราณบุรี / Pran Buri | 100602 ปราณบุรี | — |
   | ตาปี / Tapi (alias พุมดวง/Phum Duang) | 200603 รัชชประภา | tapi-suratthani |
   | ปัตตานี / Pattani | 200604 บางลาง | pattani-yala |
   Rivers dropped for being dam-controlled (น่าน, ป่าสัก, แม่กลอง, บางปะกง) carry `noPointReason: "dam-controlled"`.
3. `findWater` returns, besides dam/river-point hits, a `river` group when the query matches a river name/alias:
   `{ kind: "riverGroup", river, points: [...ids], dams: [...ids], noPointReason? }`. Order: river points of that
   river, then its dams (same name-start > contains ranking for the rest). Existing hits keep working (limit applies per list).
4. `WaterFinder` UI: for a river group, show a small header "แม่น้ำแม่กลอง" then its points and dams as the existing chips
   (tap = select as now). If the river has no point: one muted line "ยังไม่มีจุดวัดแม่น้ำนี้ในแอป — ปริมาณน้ำขึ้นกับการปล่อยน้ำของเขื่อน
   ดูที่เขื่อนด้านล่าง" (for dam-controlled) above the dam chips. Keep "ไม่พบชื่อนี้" for true misses.
5. Tests: "แม่น้ำแม่กลอง" → group with 200401, 200402 + noPointReason; "แม่น้ำเจ้าพระยา" → 3 points + 4 dams;
   "Mae Klong River" (en) same; "ภูมิพล" still a direct dam hit first; "แควน้อย" → both Mae Klong group and the dam
   แควน้อยบำรุงแดน; empty/unknown → [].
Verify: `npx vitest run --no-file-parallelism src/lib/water && npm run typecheck && npm run lint && node scripts/i18n-check.mjs`
Claude then checks headless on /map?mode=water: type "แม่น้ำแม่กลอง" → shows ศรีนครินทร์ + วชิราลงกรณ and the no-point line.

## Out of scope
Adding river points back; searching on /water (the finder lives only in the map water sheet today).
