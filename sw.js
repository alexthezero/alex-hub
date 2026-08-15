const CACHE = "alex-hq-v27";
const APP = ["./", "./index.html", "./styles.css?v=20", "./field.css?v=7", "./app.js?v=17", "./manifest.webmanifest", "./icon.svg", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./assets/fonts/IBMPlexSansCondensed-Regular.woff2", "./assets/fonts/IBMPlexSansCondensed-SemiBold.woff2", "./assets/fonts/IBMPlexMono-Regular.woff2", "./assets/fonts/IBMPlexMono-SemiBold.woff2"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./") : undefined))));
});
