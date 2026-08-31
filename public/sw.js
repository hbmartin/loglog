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
 * Guarded on a marker of its own rather than on `typeof __BUILD_ASSETS__`,
 * which names the list twice: the substitution then writes the whole thing
 * into the file twice, in a worker _headers marks no-cache and the browser
 * therefore re-downloads in full on every load.
 *
 * The guard is still a `typeof`, because public/ is copied verbatim and `vite
 * dev` serves this file with the markers still in it. A bare undeclared
 * identifier throws while the file is being evaluated, before a single
 * listener is registered, so a stale registration on the dev origin would
 * silently stop updating itself. Naming the list in the branch that guard does
 * not take is safe - an untaken branch is never evaluated - and an empty list
 * is the honest answer there: unstamped, there is no build output to pre-cache.
 */
const BUILD_ASSETS = typeof __BUILD_STAMPED__ === "undefined" ? [] : __BUILD_ASSETS__;

/**
 * What the offline navigation fallback reads, and the only key the document is
 * cached under. Caching it a second time as "/" - the URL the browser actually
 * asked for - fetches the same bytes twice, because Cloudflare's
 * auto-trailing-slash handling redirects one to the other, and nothing would
 * ever read the second copy: the fallback below matches SHELL, not the
 * request.
 */
const SHELL = "/index.html";

/**
 * Cached beside the shell and served from it, so an app launched offline still
 * has its icon and its manifest. Optional in that a favicon the origin cannot
 * produce must not hold back a deploy - neither file is needed to read a log.
 */
const OPTIONAL_SHELL = ["/manifest.json", "/favicon.ico"];

/**
 * True when a response carries an HTML document.
 *
 * Which is a disqualification everywhere but the shell. wrangler.json sets
 * not_found_handling to "single-page-application", so a request for a file
 * that no longer exists - a chunk a tab left open across a deploy is still
 * importing - comes back as index.html with a 200. Writing that into the cache
 * under a .js URL poisons the entry for the life of the cache: every later
 * request is served HTML and the import fails on its MIME type, with no
 * network round trip left to notice the file is simply gone.
 *
 * On the navigation path it is the requirement rather than the disqualifier:
 * only a document belongs in the shell entry.
 */
function isHtml(response) {
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
  // Everything but the two headers that describe the transfer rather than the
  // content. fetch hands the body over already decoded, so the original
  // Content-Encoding and the compressed Content-Length beside it both describe
  // bytes this copy does not have - and a browser that honours them on a
  // service-worker response fails to decode, or truncates, the one entry the
  // offline fallback exists to serve.
  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");

  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
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
 * HTML into the cache keyed by the .js URL: the exact poisoning isHtml exists
 * to prevent, arriving down the path that now caches almost everything.
 */
async function precache(cache, url, expectHtml) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  if (!expectHtml && isHtml(response)) {
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

        // Served by the fetch handler below, but nothing on screen depends on
        // them, so one the origin cannot produce must not discard the worker
        // and with it the pre-cache that just succeeded.
        await Promise.allSettled(OPTIONAL_SHELL.map((url) => precache(cache, url, false)));
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
          // Only from a response that is plausibly the shell. Unguarded, a
          // Cloudflare 5xx page - or any error page the origin serves as HTML
          // - is written over the good index.html, and every later offline
          // navigation is answered from cache with that error page,
          // permanently, until a successful online navigation replaces it: on
          // the one screen holding the user's only copy of their data. A
          // captive portal answering 200 with its own login page is the case
          // this cannot tell apart, and nothing here can.
          //
          // The redirect strip the install path needs is not repeated: a
          // navigation request carries redirect "manual", so a 3xx arrives as
          // an opaqueredirect with status 0, which `ok` already rejects.
          if (response.ok && isHtml(response)) {
            const copy = response.clone();
            caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put(SHELL, copy))
              // A put that fails leaves the previous entry in place, which is
              // the outcome this branch wants anyway. Unhandled it would be an
              // unhandled rejection on every navigation that hit it.
              .catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(SHELL).then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Build output is content-hashed, and every other entry belongs to a cache
  // the next deploy throws away, so a hit is always current.
  //
  // The optional entries are matched here as well, which is what makes
  // pre-caching them worth a request: reachable from no path at all, they were
  // bytes stored on install for nothing.
  if (url.pathname.startsWith("/assets/") || OPTIONAL_SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (isHtml(response)) {
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
