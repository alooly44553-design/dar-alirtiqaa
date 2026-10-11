const CACHE_NAME = "dar-alirtiqaa-v1.0.3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./app.webmanifest",
  "./icon.svg",
  "./logo.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("dar-alirtiqaa-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache cross-origin requests (including Supabase/API responses).
  if (url.origin !== self.location.origin) return;

  // Only app-shell files are eligible for caching. Do not cache arbitrary
  // pages, query-string URLs, form submissions, or dynamic application data.
  const shellUrl = new URL("./", self.location.href);
  const appShellUrls = new Set(APP_SHELL.map(path => new URL(path, shellUrl).href));
  if (url.search || !appShellUrls.has(url.href)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) || Response.error();
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
