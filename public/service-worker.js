const CACHE = "paeds-path-shell-v2";
const APP_ROOT = new URL("./", self.registration.scope).toString();
const CORE = [
  APP_ROOT,
  new URL("manifest.webmanifest", APP_ROOT).toString(),
  new URL("apple-touch-icon.png", APP_ROOT).toString(),
  new URL("icon-192.png", APP_ROOT).toString(),
  new URL("icon-512.png", APP_ROOT).toString(),
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(APP_ROOT, copy));
      }
      return response;
    }).catch(async () => (await caches.match(APP_ROOT)) || Response.error()));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  })));
});
