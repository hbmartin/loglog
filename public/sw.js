/* loglog service worker: offline shell + immutable asset cache. */

/*
 * Replaced at build time with a fingerprint of the emitted bundle by the
 * loglog:sw-version plugin in vite.config.ts. It has to change per deploy for
 * two reasons: the activate handler below prunes every cache whose name is not
 * this one, so a constant name evicts nothing and each deploy leaves another
 * generation of /assets/* behind until the origin trips its storage quota and
 * the browser drops the whole origin - localStorage, the only copy of the
 * user's logs, included. And a byte difference in this file is what tells the
 * browser there is a new service worker to install at all.
 */
const CACHE_VERSION = "loglog-__CACHE_VERSION__";
const OPTIONAL_SHELL = ["/", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        // Offline navigation depends on this entry, so installation must fail
        // if it cannot be cached. The remaining shell assets are optional.
        await cache.add("/index.html");
        await Promise.allSettled(OPTIONAL_SHELL.map((url) => cache.add(url)));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigations: prefer the network so a deploy is picked up, fall back to the
  // cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html").then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Build output is content-hashed, so a hit is always current.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
