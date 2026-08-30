# loglog

A poop tracker for dogs (or hairless apes).

Pick a dog, tap a score on the **[Purina Fecal Scoring Chart](https://www.purinainstitute.com/)**
(1–7, where 2–3 is ideal), optionally note the color and whether there was blood, mucus or worms, and
it's logged with a timestamp. Export the lot as CSV when the vet asks what's been going on.

**Everything stays on your device.** There is no backend, no account, and no network call — the data
lives in your browser's `localStorage` and never leaves it. It installs to a home screen and works
with no signal, which is where you'll actually be using it.

That also means: **clearing your browser data deletes your logs.** Export a CSV if you care about them.

## Screens

- `/` — the dogs you're tracking, each showing time since the last log and its score. Add a dog inline.
- `/dog/$dogId` — the 1–7 grader, color swatches, flags, a 7-day trend summary, and full history.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000

pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm build        # typecheck + static build into dist/
pnpm preview      # serve the built output (needed to exercise the service worker)
```

The service worker is registered in production builds only, so offline behaviour must be tested via
`pnpm build && pnpm preview`, not `pnpm dev`.

## Deploying to Cloudflare

`wrangler.json` declares an **assets-only Worker** — there is no Worker script, because there is no
server. `not_found_handling: "single-page-application"` is what makes `/dog/<id>` survive a hard
refresh.

```bash
pnpm wrangler login
pnpm run deploy   # build + wrangler deploy
```

## Stack

React 19 · TanStack Router (file-based) · Tailwind CSS 4 · shadcn/ui on Base UI · Vite (Rolldown) ·
Zod · Vitest

Note that the shadcn components here use the **`base-vega` style built on Base UI, not Radix** —
composition is the `render={<El/>}` prop, never `asChild`.

## Project structure

```text
index.html          # SPA entry; pre-paint theme script, manifest + icon links
src/
  main.tsx          # createRoot + service worker registration
  routes/           # file-based routes (routeTree.gen.ts is generated)
  lib/
    types.ts        # Dog, PoopLog, Store
    storage.ts      # localStorage + useSyncExternalStore, zod-validated on read
    purina.ts       # the 1-7 scale, color swatches, flag labels
    csv.ts          # RFC 4180 export with formula-injection escaping
    trend.ts        # 7-day summary + relative timestamps
    theme.ts        # theme keys, shared with the pre-paint script in index.html
  components/ui/    # shadcn/ui (Base UI primitives)
public/
  sw.js             # offline shell + immutable asset cache
  manifest.json     # PWA manifest
  _headers          # Cloudflare cache-control
```
