const CACHE_NAME = "dar-alirtiqaa-v1.1.10";
const ANNOUNCEMENT_SCRIPT = "/education-announcement.js?v=20261020-1";
const ANNOUNCEMENT_SCRIPT = "/education-announcement.js?v=20261021-2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./businesses.html",
  "./operations-templates.html",
  "./education-announcement.html",
  "./education-announcement.js",
  "./app.webmanifest",
  "./icon.svg",
  "./projects-icon.svg",
  "./logo.svg",
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
  if (url.origin !== self.location.origin) return;
  const shellUrl = new URL("./", self.location.href);
  const appShellUrls = new Set(APP_SHELL.map(path => new URL(path, shellUrl).href));

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !/text\/html/i.test(contentType)) return response;
        const html = await response.clone().text();
        if (html.includes("education-announcement.js") || !/<\/body\s*>/i.test(html)) return response;
        const injected = '<script src="' + ANNOUNCEMENT_SCRIPT + '" defer></script>\n</body>';
        const transformedHtml = html.replace(/<\/body\s*>/i, injected);
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");
        headers.delete("etag");
        return new Response(transformedHtml, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      } catch (error) {
        if (url.search || !appShellUrls.has(url.href)) return Response.error();
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  if (url.search || !appShellUrls.has(url.href)) return;
  event.respondWith(caches.open(CACHE_NAME).then(async cache => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(request, response.clone());
    return response;
  }));
});