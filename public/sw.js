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

/*
 * Every file the build emitted under /assets/, injected by the same plugin.
 *
 * These are pre-cached rather than filled in lazily on first request. Because
 * the cache name changes per deploy, activate throws away the generation the
 * previous worker had accumulated - and that generation was the only offline
 * copy of the code. Caching just the shell would leave the first offline load
 * after a deploy with an index.html whose script tags resolve to nothing: a
 * blank page, on the one screen holding the user's only copy of their data.
 */
const BUILD_ASSETS = __BUILD_ASSETS__;

const OPTIONAL_SHELL = ["/", "/manifest.json", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        // Offline navigation depends on this entry, so installation must fail
        // if it cannot be cached. The rest is best-effort: one asset that
        // fails to fetch should not leave the user with no worker at all.
        await cache.add("/index.html");
        await Promise.allSettled([...OPTIONAL_SHELL, ...BUILD_ASSETS].map((url) => cache.add(url)));
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

/**
 * True when the origin answered a request for a build asset with the SPA
 * fallback instead of the asset.
 *
 * wrangler.json sets not_found_handling to "single-page-application", so a
 * chunk that no longer exists - one a tab left open across a deploy is still
 * importing - comes back as index.html with a 200. Writing that into the
 * cache under a .js URL poisons the entry for the life of the cache: every
 * later request is served HTML and the import fails on its MIME type, with no
 * network round trip left to notice the file is simply gone.
 */
function isNavigationFallback(response) {
  const type = response.headers.get("content-type") ?? "";
  return type.split(";")[0].trim().toLowerCase() === "text/html";
}

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
            if (isNavigationFallback(response)) {
              // The asset is gone, whatever the status line says. A real 404
              // lets the import reject as a missing module rather than as a
              // confusing MIME-type error, and keeps the HTML out of the cache.
              return new Response(null, { status: 404, statusText: "Not Found" });
            }
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
