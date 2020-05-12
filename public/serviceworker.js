const CACHE = "toolsforspotify-offline";
const offlineFallbackPage = "offline";
const offlineData = ["small.css", "darkmode.css", "script.js", "https://fonts.googleapis.com/css2?family=Raleway&display=swap", "https://fonts.gstatic.com/s/raleway/v14/1Ptug8zYS_SKggPNyC0ITw.woff2", "documentation"];

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

self.addEventListener('fetch', function(event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request).catch(function(error) {
      console.error("[toolsforspotify] Network request Failed. Serving offline page " + error);
      return caches.match(event.request).then(function(response) {
        return response || caches.match(offlineFallbackPage);
      })
    })
  );
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
