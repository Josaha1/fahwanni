/* Lookrak service worker: shows pushed reminders and routes taps. */

importScripts("/sw-routing.js");

// Bump when the caching rules change; older caches are deleted on activate.
const CACHE = "lookrak-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith("lookrak-") && n !== CACHE).map((n) => caches.delete(n)));
  await self.clients.claim();
})()));

/* Offline: open the Today screen from the last copy when there is no connection. */
self.addEventListener("fetch", (event) => {
  let route = null;
  try { route = self.lookrakRoute(event.request, self.location.origin); } catch { route = null; }
  if (!route) return;
  event.respondWith(route === "static" ? cacheFirst(event.request) : networkFirst(event.request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    // Only a real signed-in page: a redirect to /login must never replace the offline copy.
    if (res.ok && !res.redirected && res.type === "basic") cache.put("/app/today", res.clone()).catch(() => {});
    return res;
  } catch (error) {
    const hit = await cache.match("/app/today");
    if (hit) return hit;
    throw error;
  }
}

/* Signing out clears the offline copy so the next person on this phone never sees it. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear-cache") event.waitUntil(caches.delete(CACHE));
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "ลูกรัก", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "ลูกรัก";
  const options = {
    body: data.body || "",
    tag: data.tag,
    renotify: Boolean(data.tag) && data.kind === "dose",
    requireInteraction: data.kind === "dose",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    lang: "th",
    data: { url: data.url || "/app/today", eventId: data.eventId, actionToken: data.actionToken, kind: data.kind },
    // Buttons render on Android/desktop; iOS ignores them and opens data.url instead.
    actions: data.kind === "dose" && data.actionToken
      ? [{ action: "given", title: "✓ ให้แล้ว" }, { action: "snooze", title: "⏰ เลื่อน 15 นาที" }]
      : [],
  };
  const badge = typeof data.badge === "number" && self.navigator.setAppBadge
    ? (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {})
    : Promise.resolve();
  event.waitUntil(Promise.all([self.registration.showNotification(title, options), badge]));
});

async function openUrl(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if ("focus" in client) {
      await client.focus();
      if ("navigate" in client && client.url !== target) await client.navigate(target).catch(() => {});
      return;
    }
  }
  await self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  event.notification.close();
  if ((event.action === "given" || event.action === "snooze") && data.eventId && data.actionToken) {
    event.waitUntil(
      fetch("/api/dose-events/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: data.eventId, action: event.action, token: data.actionToken }),
      }).then((res) => {
        if (!res.ok) return openUrl(data.url);
        return self.registration.showNotification(event.action === "given" ? "✓ บันทึกว่าให้ยาแล้ว" : "⏰ จะเตือนอีกครั้งใน 15 นาที", {
          tag: data.eventId ? `dose-${data.eventId}` : undefined,
          icon: "/icon-192.png",
          body: "",
          data: { url: "/app/today" },
        });
      }).catch(() => openUrl(data.url)),
    );
    return;
  }
  event.waitUntil(openUrl(data.url || "/app/today"));
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // Re-subscribe with the same key; the app re-posts it to the server on next open.
  const options = event.oldSubscription && event.oldSubscription.options;
  if (!options) return;
  event.waitUntil(self.registration.pushManager.subscribe(options).then((sub) =>
    fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) }),
  ).catch(() => {}));
});
