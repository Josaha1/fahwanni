# ฟ้าวันนี้

เว็บแอปพยากรณ์อากาศสำหรับใช้ในชีวิตประจำวัน เน้นประเทศไทย แสดงข้อมูลอากาศและคำแนะนำที่อ่านง่าย รองรับภาษาไทยและอังกฤษ โดยไม่ต้องสมัครบัญชี ข้อมูลเมืองโปรดและการตั้งค่าเก็บไว้ในเบราว์เซอร์ของผู้ใช้

## ความสามารถ

- อากาศปัจจุบัน พยากรณ์รายชั่วโมง 24 ชั่วโมง และรายวัน 10 วัน
- ค่าฝุ่น PM2.5 และคุณภาพอากาศ พร้อมคำแนะนำเรื่องฝน แดด ความร้อน และการใช้ชีวิตประจำวัน
- ค้นหาจังหวัดไทยได้ทันที ค้นหาสถานที่อื่นผ่าน Open-Meteo และใช้ตำแหน่ง GPS
- บันทึกเมืองโปรด แชร์พยากรณ์ และแสดงข้อมูลล่าสุดที่บันทึกไว้เมื่อออฟไลน์
- เลือกภาษาไทย/อังกฤษ ธีมอัตโนมัติ/สว่าง/มืด และติดตั้งเป็นแอปบนอุปกรณ์ที่รองรับ
- แท็บแผนที่: เรดาร์ฝนย้อนหลัง 2 ชม. พร้อมบอกระยะฝนใกล้สุด เส้นลมเคลื่อนไหว แผนที่ 3 มิติ เส้นทางพายุ และแผ่นดินไหว
- แบนเนอร์พายุ (JMA/GDACS) และประกาศเตือนภัยของกรมอุตุนิยมวิทยา
- ไอคอนสภาพอากาศเคลื่อนไหวที่เรนเดอร์ด้วย Blender (`scripts/blender`)
- ช่วงเวลาที่ดีที่สุดสำหรับออกไปข้างนอก/ออกกำลังกาย, สรุป 7 วัน, ฤดูกาล, เทียบกับเมื่อวาน, วันหยุดยาว, ข้างขึ้นข้างแรม
- คลื่นลมทะเล (เฉพาะพื้นที่ชายฝั่ง), โหมดเกษตรกร, ภาพรวมเมืองโปรด
- แชร์เป็นรูปภาพ, อ่านให้ฟัง และโหมดตัวอักษรใหญ่

## แหล่งข้อมูลและเงื่อนไขการใช้

| ข้อมูล | แหล่ง | หมายเหตุ |
| --- | --- | --- |
| พยากรณ์อากาศ, PM2.5 | Google Weather API, Air Quality API | ต้องใช้ API key (ดูด้านล่าง) |
| เรดาร์ฝน | RainViewer | ฟรีสำหรับการใช้งานส่วนบุคคล/การศึกษา ต้องใส่เครดิต เคยประกาศว่าจะปิด API — แอปจะแสดง "เรดาร์ไม่พร้อมใช้งาน" ถ้าหยุดให้บริการ |
| ลม, คลื่น, ความชื้นดิน, ค้นหาสถานที่ | Open-Meteo | CC BY 4.0 ฟรีเฉพาะการใช้งานที่ไม่แสวงกำไร |
| แผนที่ฐาน / ภูมิประเทศ 3D | OpenFreeMap (OSM), AWS Terrain Tiles | ต้องใส่เครดิต |
| พายุ | JMA (ญี่ปุ่น), GDACS | JSON ของ JMA ไม่มีเอกสารทางการ อาจเปลี่ยนรูปแบบ |
| ประกาศเตือนภัย | กรมอุตุนิยมวิทยา (data.tmd.go.th) | |
| แผ่นดินไหว | USGS | public domain |
| ปริมาณน้ำในเขื่อน (+ ย้อนหลังถึง 2554) | กรมชลประทาน (app.rid.go.th/reservoir/api) | รายงานวันละครั้ง |
| ฝน 24 ชม. จากสถานี | กรมอุตุนิยมวิทยา (data.tmd.go.th WeatherToday) | รายงานวันละครั้ง ถึง 07:00 น. |
| ปริมาณน้ำไหลผ่านแม่น้ำ (แบบจำลอง) | GloFAS ผ่าน Open-Meteo Flood API | CC BY 4.0 · แบบจำลอง 5 กม. ไม่ใช่ค่าวัดจริง ไม่ใช้จุดที่อยู่ใต้เขื่อนใหญ่ |
| น้ำขึ้นน้ำลงปากเจ้าพระยา (แบบจำลอง) | Open-Meteo Marine | CC BY 4.0 · ไม่ใช่ตารางน้ำทางการของกรมอุทกศาสตร์ |
| ระดับน้ำที่สถานีจริง (ย้อนหลัง) | [สสน. HII open data](https://tiservice.hii.or.th/opendata/data_catalog/water_level/) | CC BY-NC · รายเดือน ล่าช้า 1–2 เดือน |
| เส้นทางน้ำท้ายเขื่อน | HydroRIVERS | CC BY 4.0 |
| น้ำท่วมจากดาวเทียม | NASA LANCE / GIBS (VIIRS, MODIS สำรอง) | ข้อมูลสาธารณะ ต้องใส่เครดิต · รายวัน ล่าช้า ~1 วัน ใต้เมฆมองไม่เห็น |
| ภาพเมฆดาวเทียม Himawari | JMA ผ่าน NASA GIBS | ภาพอินฟราเรด · อัปเดตทุก 10 นาที โดยทั่วไปล่าช้า ~1 ชม. |
| ฝนจากดาวเทียม IMERG | NASA GPM ผ่าน NASA GIBS | อัตราฝนทุก 30 นาที โดยทั่วไปล่าช้า ~6 ชม. |
| จุดความร้อนจากดาวเทียม | NASA FIRMS/GIBS (VIIRS NOAA-20) | ข้อมูลสาธารณะ ต้องใส่เครดิต · รายวัน ล่าช้า ~1 วัน ไม่ใช่ทุกจุดคือไฟป่า |
| พื้นที่ที่เคยมีน้ำขัง 1984–2021 | EC JRC/Google Global Surface Water | CC BY · ภาพการเกิดน้ำในอดีต ไม่ใช่การพยากรณ์ |
| อ่างเก็บน้ำกลาง/เล็ก 784 แห่ง | กรมทรัพยากรน้ำ `api.dwr.go.th/twsapi` (data.go.th) | CC BY · ข้อมูลบางแห่งเก่า แสดงวันที่เสมอ · เซิร์ฟเวอร์ไม่ส่ง intermediate cert จึงแนบ Sectigo DV R36 ไว้ใน `src/lib/net` |
| ตำแหน่งเขื่อน/ฝาย | OpenStreetMap `waterway=dam` (snapshot `node scripts/osm/build-dams.mjs`) | ODbL · © OpenStreetMap contributors |
| เหตุการณ์น้ำท่วม/ภัยพิบัติ | GDACS (flood) + ADRC GLIDE ผ่าน HDX `tha-glide-events` | GDACS Terms of Use · CC BY-IGO · ไม่ใช่ประกาศทางการของไทย |
| หมู่บ้านเสี่ยงน้ำท่วม | ปภ. `floodrisk_rg` (catalog.disaster.go.th) | CC BY · ข้อมูลปี 2567 ความเสี่ยงจากประวัติ |
| ดวงดาว แสงทอง สุริยุปราคา | `astronomy-engine` คำนวณในเครื่อง (ไม่ใช้ API) + ตารางฝนดาวตก IMO | MIT |
| เอลนีโญ / ลานีญา | NOAA CPC Oceanic Niño Index (`oni.ascii.txt`) | public domain |
| ตรวจวัดจริงที่สนามบิน | aviationweather.gov METAR (34 สนามบินไทย; รายชื่อจาก OurAirports) | public domain · ผ่าน `/api/metar` (ไม่มี CORS) |
| อุณหภูมิน้ำทะเล + ปะการังฟอกขาว | NOAA Coral Reef Watch v3.1 5 กม. (ERDDAP pacioos) | ใช้ได้ไม่จำกัด อ้างอิง NOAA CRW |
| กล้องสดใกล้คุณ | Windy Webcams API v3 | ต้องมี `WINDY_WEBCAMS_KEY` (ฟรี) · ห้ามเก็บภาพ ต้องลิงก์กลับ Windy.com |
| พิกัดเขื่อน | Wikidata (CC0), OpenStreetMap (ODbL) | |

แอปใช้เฉพาะแหล่งที่ประกาศเงื่อนไขการใช้ไว้ — ไม่ใช้ข้อมูลสด ThaiWater (สสน.) และภาพ CCTV ของ กฟผ. จนกว่าจะได้รับอนุญาต (ร่างหนังสืออยู่ที่ `docs/permissions/data-requests.md`)

ถ้าจะหารายได้จากแอป ต้องเปลี่ยน RainViewer/Open-Meteo เป็นแผนเชิงพาณิชย์ ตรวจแหล่งข้อมูลทั้งหมดได้ด้วย `npm run check:sources`

Google `publicAlerts` ตอบ 404 สำหรับประเทศไทย คำเตือนในแอปจึงมาจากการคำนวณจากพยากรณ์ (`src/lib/advise.ts`) และประกาศของกรมอุตุฯ

วันหยุดใน `src/lib/holidays.ts`: ปี 2569 ตรวจแล้ว ส่วนปี 2570 เป็นข้อมูลเบื้องต้น ต้องตรวจอีกครั้งเมื่อ ครม. ประกาศ

## เริ่มใช้งาน

ต้องมี Node.js และ API key ของ Google Maps Platform สำหรับเรียก Weather API และ Air Quality API จากเซิร์ฟเวอร์

```sh
npm install
cp .env.example .env.local
```

ใส่คีย์ใน `.env.local`:

```dotenv
GOOGLE_MAPS_API_KEY=your_api_key_here
```

ไฟล์ `.env.local` เป็นข้อมูลลับ อย่า commit หรือใส่คีย์จริงใน README คีย์นี้ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ต้องสร้าง service account และไม่ต้องใช้ตัวแปร `NEXT_PUBLIC_`

### ตั้งค่า Google Cloud

1. สร้างโปรเจกต์และเปิด Billing ใน Google Cloud Console จากนั้นสร้าง **API key** ในหน้า Credentials (ไม่ใช่ service account)
2. เปิดใช้ **Weather API** และ **Air Quality API** ในโปรเจกต์เดียวกัน
3. ตั้ง **API restrictions** ของคีย์เป็น **Restrict key** แล้วเลือกเฉพาะ **Weather API** และ **Air Quality API**
4. ตั้ง **Application restrictions** เป็น **None** เพราะแอปใช้คีย์จากเซิร์ฟเวอร์ ไม่ได้ส่งคีย์ไปที่เบราว์เซอร์
5. ในหน้า Quotas ตั้งเพดาน **10 คำขอต่อนาทีต่อ SKU** สำหรับ Current Conditions, Forecast Hours, Forecast Days, Public Alerts และ Air Quality และตั้งเพดานรายวันประมาณ **300 คำขอต่อ SKU** ถ้าหน้า Quotas ของ SKU นั้นรองรับ
6. ตั้ง **budget alert** ใน Billing เพื่อรับแจ้งเตือนเมื่อค่าใช้จ่ายถึงเกณฑ์ที่กำหนด ตรวจสอบค่าใช้จ่ายและโควตาจริงของโปรเจกต์ก่อนเปิดให้ผู้อื่นใช้

คำขอ `publicAlerts` อาจคืน 404 สำหรับประเทศไทย จึงแสดงคำเตือนที่คำนวณจากพยากรณ์ผ่าน advice engine เมื่อไม่มีประกาศจาก API คำเตือนเหล่านี้ไม่ใช่ประกาศทางการ ควรตรวจสอบ [กรมอุตุนิยมวิทยา](https://www.tmd.go.th) สำหรับประกาศล่าสุด

## คำสั่ง

| คำสั่ง | ใช้ทำอะไร |
| --- | --- |
| `npm run dev` | เปิดเซิร์ฟเวอร์พัฒนา |
| `npm run build` | สร้างแอปสำหรับ production |
| `npm test` | รัน Vitest ในโหมดพัฒนา |
| `npx vitest run` | รันเทสต์หนึ่งรอบ |
| `npm run lint` | ตรวจ ESLint |
| `npm run typecheck` | ตรวจ TypeScript |
| `node scripts/i18n-check.mjs` | ตรวจข้อความที่ยังไม่มีคำแปลอังกฤษ |
| `npm run check:sources` | ตรวจว่าแหล่งข้อมูลภายนอกทั้งหมดยังตอบกลับ |
| `node scripts/blender/build.mjs` | เรนเดอร์ไอคอนเคลื่อนไหวใหม่ (ต้องมี Blender 4.5 ใน `~/Applications`) |
| `node scripts/airports/build.mjs` | อัปเดตรายชื่อสนามบินไทยที่มี METAR (OurAirports) |
| `node scripts/osm/build-dams.mjs` | อัปเดตตำแหน่งเขื่อนจาก OpenStreetMap (Overpass, ใช้ตอน build เท่านั้น) |
| `node scripts/blender/build-dam.mjs` | สร้างโมเดลเขื่อน 3 มิติ `public/models/dam.glb` (Blender 4.5, headless) — ไฟล์ glb commit ไว้ใน repo เพราะ Vercel รัน Blender ไม่ได้ |

## CI และการรายงานข้อผิดพลาด

`.github/workflows/ci.yml` ตรวจ typecheck, lint, Vitest และคำแปลเมื่อ push หรือเปิด pull request ส่วน `.github/workflows/verify-deploy.yml` ตรวจเว็บที่ deploy ทุก 6 ชั่วโมงและสั่งรันเองได้

เมื่อหน้าแอปเกิดข้อผิดพลาดฝั่งเบราว์เซอร์ แอปส่งข้อความที่ตัดข้อมูลอ่อนไหวออกแล้วไปยัง `/api/log` เพื่อช่วยตรวจปัญหา โดยจำกัดขนาดและความถี่ของคำขอ

## โหมดประหยัดบนแผนที่

เปิดได้ในหน้าต่างชั้นข้อมูล แอปเปิดให้อัตโนมัติเมื่ออุปกรณ์ขอลดภาพเคลื่อนไหว เปิด Save-Data หรือมีหน่วยความจำ/แกนประมวลผลไม่เกิน 4 โหมดนี้ลดภาพเคลื่อนไหวและไม่ใช้แผนที่ 3 มิติ ผู้ใช้สลับโหมดเองได้

## Deploy บน Vercel

หมุนเวียน Google API key ก่อน deploy จากนั้น import รีโป `github.com/Josaha1/fahwanni` ใน Vercel ระบบจะตรวจพบ Next.js อัตโนมัติ กำหนด Environment Variable `GOOGLE_MAPS_API_KEY` สำหรับทั้ง Production และ Preview แล้ว deploy ใหม่หลังเพิ่มหรือเปลี่ยนคีย์ อย่าใส่คีย์ในตัวแปร `NEXT_PUBLIC_` หรือ commit `.env.local`

Region ตั้งเป็น `sin1` (Singapore) ใน `vercel.json` ไฟล์ภาพที่เรนเดอร์ด้วย Blender ถูก commit ไว้แล้ว เพราะ Vercel รัน Blender ไม่ได้ ส่วน `public/vendor` สร้างจากแพ็กเกจ MapLibre ระหว่าง `prebuild` หลัง deploy ตรวจ URL ด้วย `npm run verify:deploy -- https://<deployment-url>`

## โครงสร้างโปรเจกต์

| ตำแหน่ง | หน้าที่ |
| --- | --- |
| `src/app/` | หน้าแอป layout และ API routes สำหรับ weather, air และ geocode |
| `src/components/` | ส่วนแสดงผลพยากรณ์ การค้นหา และแผงตั้งค่า |
| `src/hooks/` | โหลดข้อมูลพยากรณ์และจัดการเมืองโปรดในเบราว์เซอร์ |
| `src/lib/` | เรียกและแปลงข้อมูล API คำนวณคำแนะนำ แคช และข้อมูลจังหวัด |
| `src/i18n/` | ข้อความภาษาไทย/อังกฤษและตัวช่วยเลือกภาษา |
| `public/` | ไอคอน manifest และ service worker สำหรับ PWA |
| `test/` | เทสต์ service worker |
| `scripts/` | สคริปต์ตรวจคำแปล |
