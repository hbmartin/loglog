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
 * The files the build emitted under /assets/ that offline navigation needs,
 * injected by the same plugin. Fonts are deliberately not among them; see
 * assetUrls in vite.config.ts for why.
 *
 * These are pre-cached rather than filled in lazily on first request. Because
 * the cache name changes per deploy, activate throws away the generation the
 * previous worker had accumulated - and that generation was the only offline
 * copy of the code. Caching just the shell would leave the first offline load
 * after a deploy with an index.html whose script tags resolve to nothing: a
 * blank page, on the one screen holding the user's only copy of their data.
 *
 * Read through `typeof` rather than referenced bare, because public/ is copied
 * verbatim and `vite dev` serves this file with the marker still in it. A bare
 * undeclared identifier throws while the file is being evaluated, before a
 * single listener is registered, so a stale registration on the dev origin
 * would silently stop updating itself. An empty list is the honest answer
 * there: unstamped, there is no build output to pre-cache.
 */
const BUILD_ASSETS = typeof __BUILD_ASSETS__ === "undefined" ? [] : __BUILD_ASSETS__;

/** What the offline navigation fallback reads. */
const SHELL = "/index.html";

/** The same document under the URL the browser actually asked for. */
const SHELL_ALIAS = "/";

const OPTIONAL_SHELL = ["/manifest.json", "/favicon.ico"];

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

/**
 * The same response with its `redirected` flag cleared.
 *
 * respondWith() answers a navigation with a network error if the response it
 * is handed has that flag set, and Cache.put preserves it. Cloudflare's asset
 * handler defaults html_handling to "auto-trailing-slash", which redirects
 * /index.html to /, so the one entry the offline fallback depends on is
 * exactly the one likely to carry it. Rebuilding from the body is the only
 * way to drop it; the copy is identical otherwise.
 */
async function withoutRedirect(response) {
  if (!response.redirected) {
    return response;
  }
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Fetches `url` and writes it to `cache`, rejecting anything that came back
 * as the SPA fallback rather than as the file asked for. `expectHtml` is for
 * the shell entries, which are index.html and so answer HTML legitimately.
 *
 * cache.add() does the same fetch and put in one call, and checks only the
 * status line. An /assets/ URL the edge cannot resolve - a request that raced
 * a deploy, say - answers index.html with a 200, and add() would write that
 * HTML into the cache keyed by the .js URL: the exact poisoning
 * isNavigationFallback exists to prevent, arriving down the path that now
 * caches almost everything.
 */
async function precache(cache, url, expectHtml) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  if (!expectHtml && isNavigationFallback(response)) {
    throw new Error(`${url} answered with the SPA fallback rather than the file itself`);
  }
  await cache.put(url, await withoutRedirect(response));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        // All or nothing. A partial cache is not a smaller offline promise,
        // it is a broken one: activate below deletes the previous generation,
        // which held the only other copy of whatever failed here, and then
        // claims every client - so the first offline navigation gets a shell
        // whose imports resolve to nothing, with nothing recorded and no
        // retry until the next deploy. Failing instead discards this worker
        // before activate ever runs, leaving the previous worker and its
        // complete cache serving, and the browser tries again on the next
        // update check.
        await Promise.all([
          precache(cache, SHELL, true),
          ...BUILD_ASSETS.map((url) => precache(cache, url, false)),
        ]);

        // Nothing offline reads these - the fallback matches SHELL, not "/" -
        // so a missing favicon must not hold back a deploy.
        await Promise.allSettled([
          precache(cache, SHELL_ALIAS, true),
          ...OPTIONAL_SHELL.map((url) => precache(cache, url, false)),
        ]);
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
          // Stripped here as well as on the install path: a navigation the
          // origin answered through a redirect would otherwise refresh the
          // shell entry with a copy respondWith later refuses to serve.
          const copy = response.clone();
          caches
            .open(CACHE_VERSION)
            .then(async (cache) => cache.put(SHELL, await withoutRedirect(copy)));
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
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
