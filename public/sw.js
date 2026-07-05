// Minimal offline cache: network-first for same-origin GETs, cache fallback.
// Enough to make the app open offline after the first visit.
//
// Network-first (not cache-first) matters here: index.html references
// content-hashed asset filenames that change every deploy. A cache-first
// strategy would serve a stale HTML shell forever after a redeploy — the
// browser only re-installs this worker when *this file's* bytes change, so
// a cached index.html pointing at a since-deleted hashed bundle would 404
// silently and blank the page. Network-first always prefers the live
// deploy and only drops to cache when the network genuinely fails (offline).
const CACHE = "cozy-sprites-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/index.html"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
