const LERNA_CACHE = "lerna-v18-pwa-shell-v3";
const LERNA_ASSETS = [
  "./YPT++%20v18.html",
  "./assets/ypt-tools-v18.css",
  "./assets/ypt-tools-react-v18.js",
  "./assets/ypt-tools-graph-core-v18.js",
  "./assets/lerna-cloud-sync.js",
  "./assets/lerna-mark.svg",
  "./assets/lerna-icon-192.png",
  "./assets/lerna-icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/favicon.ico",
  "./lerna.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(LERNA_CACHE).then((cache) => cache.addAll(LERNA_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("lerna-") && key !== LERNA_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const clone = response.clone();
        caches.open(LERNA_CACHE).then((cache) => cache.put(request, clone));
        return response;
      });
    }),
  );
});
