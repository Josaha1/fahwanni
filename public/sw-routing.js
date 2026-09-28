/*
 * Which requests the Lookrak service worker may answer from its cache. Kept in its own file so it
 * can be unit-tested. Everything not listed goes straight to the network, untouched.
 *   "static" — content-hashed build assets and icons: cache first.
 *   "page"   — full-page loads of the Today screen: network first, cached copy when offline.
 */
self.lookrakRoute = function lookrakRoute(request, origin) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== origin) return null;
  if (url.pathname.startsWith("/_next/static/")) return "static";
  if (url.pathname.startsWith("/emoji/")) return "static";
  if (url.pathname.startsWith("/mascots/")) return "static";
  if (/^\/(icon-192|icon-512|icon-maskable-512|apple-touch-icon)\.png$/.test(url.pathname)) return "static";
  const rsc = url.searchParams.has("_rsc") || (request.headers && request.headers.get("RSC"));
  if (request.mode === "navigate" && !rsc && (url.pathname === "/app/today" || url.pathname === "/app")) return "page";
  return null;
};
