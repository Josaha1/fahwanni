/* Forecast and map pages, build assets, app icons, and weather icons use the offline cache. */
self.fahRoute = function fahRoute(request, origin) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin === "https://maps.gstatic.com") {
    return url.pathname.startsWith("/weather/") ? "static" : null;
  }
  if (url.origin !== origin) return null;
  if (["/api/dams", "/api/rain-risk", "/api/tmd-warnings", "/api/dams-trend", "/api/dams-history", "/api/rivers", "/api/satellite", "/data/dam-paths.geojson", "/data/dam-downstream.json"].includes(url.pathname)) return "data";
  if (url.pathname.startsWith("/api/")) return null;
  if (url.pathname.startsWith("/_next/static/")) return "static";
  if (url.pathname.startsWith("/vendor/maplibre/")) return "static";
  if (/^\/map\/relief-(?:light|dark)\.webp$/.test(url.pathname)) return "static";
  if (/^\/anim\/(?:[a-z]+-(?:day|night)|typhoon-calm)\.webp$/.test(url.pathname)) return "static";
  if (/^\/icon[^/]*\.png$/.test(url.pathname) || url.pathname === "/apple-touch-icon.png" || url.pathname === "/manifest.webmanifest") return "static";
  const rsc = url.searchParams.has("_rsc") || (request.headers && request.headers.get("RSC"));
  if ((url.pathname === "/" || url.pathname === "/map" || url.pathname === "/water") && request.mode === "navigate" && !rsc) return "page";
  return null;
};

self.fahWarmable = function fahWarmable(url, origin) {
  if (typeof url !== "string") return false;
  try {
    return self.fahRoute({ method: "GET", url: new URL(url, origin).href }, origin) === "static";
  } catch {
    return false;
  }
};
