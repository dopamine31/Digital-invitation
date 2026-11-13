/* Service Worker — Digital Invitation Studio
 * Strategi aman:
 *  - Aset statis (/_next/static, ikon, gambar): cache-first
 *  - Navigasi: network-first dengan fallback /offline (halaman privat /app, /admin, /api TIDAK PERNAH di-cache)
 */
const VERSION = "dis-v1";
const STATIC = `${VERSION}-static`;
const PRECACHE = ["/offline", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

const PRIVATE = [/^\/app/, /^\/admin/, /^\/api\//, /^\/login/, /^\/register/];

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (PRIVATE.some((r) => r.test(url.pathname))) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname.startsWith("/images")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok) caches.open(STATIC).then((c) => c.put(req, copy));
      return res;
    })));
  }
});
