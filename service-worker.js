const CACHE_NAME = "mutabaa-cache-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles/base.css",
  "./src/app.js",
  "./src/models.js",
  "./src/state-manager.js",
  "./src/storage.js",
  "./src/utils.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          cacheResponse(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          const cachedResponse = await cache.match("./index.html");
          return cachedResponse || Response.error();
        })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    cacheResponse(request, response.clone());
    return response;
  } catch (error) {
    return Response.error();
  }
}

async function cacheResponse(request, response) {
  if (!response || response.status !== 200 || response.type === "opaque") {
    return;
  }
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response);
}
