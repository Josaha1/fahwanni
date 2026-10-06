/* Cache visited app pages and static assets for offline use. */

importScripts("/sw-routing.js");

const CACHE = "fah-v6";
const DATA_CACHE = "fah-data-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/")).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name !== CACHE && name !== DATA_CACHE).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  let route = null;
  try { route = self.fahRoute(event.request, self.location.origin); } catch { route = null; }
  if (!route) return;
  event.respondWith(route === "static" ? cacheFirst(event.request) : networkFirst(event.request, route === "data" ? DATA_CACHE : CACHE));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Weather icons and satellite tiles may be opaque when requested across origins.
  if (res.ok || res.type === "opaque") await cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected && res.type === "basic") await cache.put(request, cacheName === DATA_CACHE ? await stamped(res.clone()) : res.clone()).catch(() => {});
    return res;
  } catch (error) {
    // The map rewrites its query (?lat=…&z=…) as you pan, so a reload asks for a URL that was never cached;
    // the page reads its view from the URL itself, so any cached copy of the same path works.
    const hit = await cache.match(request) ?? (request.mode === "navigate" ? await cache.match(request, { ignoreSearch: true }) : undefined);
    if (hit) return hit;
    throw error;
  }
}

// A saved data response carries the time it was saved, so an offline screen can say how old it is.
async function stamped(res) {
  const headers = new Headers(res.headers);
  headers.set("x-fah-cached-at", new Date().toISOString());
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers });
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-cache") event.waitUntil(Promise.all([caches.delete(CACHE), caches.delete(DATA_CACHE)]));
  if (event.data && event.data.type === "warm-cache" && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(event.data.urls
      .filter((url) => self.fahWarmable(url, self.location.origin))
      .map(async (url) => {
        try {
          const request = new Request(url, { mode: new URL(url, self.location.origin).origin === self.location.origin ? "same-origin" : "no-cors" });
          if (await cache.match(request)) return;
          const res = await fetch(request);
          if (res.ok || res.type === "opaque") await cache.put(request, res);
        } catch {}
      }))).catch(() => {}));
  }
});
