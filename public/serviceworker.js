const CACHE = "toolsforspotify-offline-v3";
const offlineFallbackPage = "offline";
const offlineData = ["small.css", "darkmode.css", "script.js", "Raleway.woff", "documentation", "manifest.json"];

self.addEventListener("install", function (event) {
  console.log("[toolsforspotify] Install Event processing");
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      var cachePages = offlineData.concat(offlineFallbackPage);
      console.log("[toolsforspotify] Cached offline page during install");
      return cache.addAll(cachePages);
    })
  );
});

self.addEventListener('activate', function (event) {
  console.log("[toolsforspotify] Checking for old caches..");
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if(cacheName != CACHE) {
            console.log("[toolsforspotify] deleting cache " + cacheName)
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith((async () => {
    if (!event.request.url.endsWith(".woff")) {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse) {
          return networkResponse;
        }
      } catch (error) {
        console.error("[toolsforspotify] Network request Failed. Serving offline page " + error);
      }
    }
    const cacheResponse = await caches.match(event.request);
    if (cacheResponse) {
      return cacheResponse;
    }
    const fallback = await caches.match(offlineFallbackPage);
    if (fallback) {
      return fallback;
    }
    console.log("uhoh..");
    return;
  })());
});

self.addEventListener("refreshOffline", function () {
  const offlinePageRequest = new Request(offlineFallbackPage);
  return fetch(offlineFallbackPage).then(function (response) {
    return caches.open(CACHE).then(function (cache) {
      console.log("[toolsforspotify] Offline page updated from refreshOffline event: " + response.url);
      return cache.put(offlinePageRequest, response);
    });
  });
});
