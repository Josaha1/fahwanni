const today = new Date();
const tenDaysAgo = new Date(today);
tenDaysAgo.setUTCDate(tenDaysAgo.getUTCDate() - 10);
const date = (value) => value.toISOString().slice(0, 10);

async function request(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = await response.arrayBuffer();
  return { status: response.status, bytes: body.byteLength, body };
}

async function rainViewer() {
  const manifest = await request("https://api.rainviewer.com/public/weather-maps.json");
  if (manifest.status < 200 || manifest.status >= 300) return manifest;

  const data = JSON.parse(new TextDecoder().decode(manifest.body));
  const frame = data.radar?.past?.at(-1);
  if (!data.host || !frame?.path) throw new Error("RainViewer manifest has no past radar frame");

  const tile = await request(`${data.host}${frame.path}/256/6/49/29/2/1_1.png`);
  return { status: tile.status, bytes: manifest.bytes + tile.bytes };
}

const checks = [
  ["RainViewer", rainViewer],
  ["JMA", () => request("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json")],
  ["GDACS", () => request(`https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC&fromDate=${date(tenDaysAgo)}&toDate=${date(today)}`)],
  ["OpenFreeMap", () => request("https://tiles.openfreemap.org/styles/positron")],
  ["Terrarium", () => request("https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/49/29.png")],
  ["TMD", () => request("https://data.tmd.go.th/api/WeatherWarningNews/v2/?uid=api&ukey=api12345")],
  ["Open-Meteo", () => request("https://api.open-meteo.com/v1/forecast?latitude=13.7,18.8&longitude=100.5,99.0&hourly=wind_speed_10m,wind_direction_10m&forecast_hours=2")],
];

const results = await Promise.all(checks.map(async ([name, check]) => {
  const start = performance.now();
  try {
    const result = await check();
    return { name, ...result, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { name, status: "ERR", bytes: 0, ms: Math.round(performance.now() - start), error };
  }
}));

console.log("name         status  bytes     ms");
for (const { name, status, bytes, ms, error } of results) {
  console.log(`${name.padEnd(12)} ${String(status).padEnd(7)} ${String(bytes).padEnd(9)} ${ms}`);
  if (error) console.error(`${name}: ${error.message}`);
}

if (results.some(({ status }) => typeof status !== "number" || status < 200 || status >= 300)) process.exitCode = 1;
