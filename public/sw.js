/* Cache the last weather page and static assets for offline use. */

importScripts("/sw-routing.js");

const CACHE = "fah-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add("/")).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  let route = null;
  try { route = self.fahRoute(event.request, self.location.origin); } catch { route = null; }
  if (!route) return;
  event.respondWith(route === "static" ? cacheFirst(event.request) : networkFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  // Weather icons may be opaque when requested across origins.
  if (res.ok || res.type === "opaque") await cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && !res.redirected && res.type === "basic") await cache.put("/", res.clone()).catch(() => {});
    return res;
  } catch (error) {
    const hit = await cache.match("/");
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-cache") event.waitUntil(caches.delete(CACHE));
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
