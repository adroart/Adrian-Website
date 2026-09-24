# Media delivery: how images reach the site

Written 2026-09-24 from the repo and from live responses. This replaces the
Cloudinary description in `IMAGE-WORKFLOW-PLAN.md`, which is history now.

## The path of one image

1. **Components build a same-origin URL** with `img()` / `srcset()` in
   `utils/media.ts`: `/media/image/<public-id>?w=800` (optional `h`, `crop`,
   `q`, `gravity`, `format`). Nothing in the browser talks to Cloudinary.
2. **The media Worker answers it.** `workers/media.js`, configured by
   `wrangler.media.toml` (Worker name `adrian-website-media`), is attached to
   the zone routes `adrianrasmussen.com/media/*` and `www.adrianrasmussen.com/media/*`.
   Those routes win over Pages, so on the live domain Pages never sees `/media`.
3. **The bytes come from R2.** Originals live in the R2 bucket
   `adrian-website-media` under the key `image/<public-id>` (moved there from
   Cloudinary in the 2026-09-22 migration, via `scripts/migrate-cloudinary-to-r2.mjs`). A
   request with no size or format query streams the R2 object as is.
4. **Resizing is Cloudflare Image Resizing, called from the Worker.** For a
   sized request the Worker fetches its own raw URL on
   `adrian-website-media.lightcodes.workers.dev` with `cf: { image: {...} }`.
   That is what puts `cf-resized` and `vary: cf-int-resize` on the response.
   No Transform Rule or dashboard rewrite is needed for this. (The zone's rules
   were not read: the wrangler login has no zone scope.)
5. **Every response is cached for a year** (`Cache-Control: immutable`).

## Rules the Worker enforces

- Widths must be in `SIZES`; anything else is served unresized.
- A height is only honoured as a pair listed in `SIZE_PAIRS` (for example
  `1200x630` for social cards). Other heights are dropped.
- Width only: `fit: scale-down` (never upscales). Width and height: `cover`,
  unless `crop=fit` (`contain`) or `crop=scale` (`scale-down`).
- Format follows `format=` if given, otherwise the `Accept` header.

To add a size, add it to `SIZES` or `SIZE_PAIRS` and redeploy the Worker.

## Previews and fallbacks

Pages preview deployments do not sit on the zone route, so there
`functions/media/[[path]].js` (and the `/media/*` line in `public/_redirects`)
302 the browser straight to the Worker on workers.dev. It redirects instead of
proxying because proxying a cold resize through a Pages Function hit error 1102.
The CSP in `public/_headers` allows that workers.dev origin for this reason.

## Deploying

The media Worker is **not** deployed by merging to `main`; Pages only ships the
site. Deploy the Worker by hand:

```bash
npx wrangler deploy --config wrangler.media.toml
```

Check which version is live with
`npx wrangler deployments list --config wrangler.media.toml`.

## Checks

- `tests/media-worker.test.ts`: size and fit rules.
- `tests/media-delivery.test.ts`: the preview redirect.
- `.github/workflows/live-artwork-media.yml` runs
  `scripts/check-live-artwork-media.mjs` against the live site.

## Known gap

The edge cache key is the URL only, so the first format served for a URL
(AVIF, WebP or JPEG, chosen from `Accept`) is what every later client gets.
Measured 2026-09-24: `Accept: image/jpeg` on a `w=1200&h=630` card returned
`image/avif` from cache.
