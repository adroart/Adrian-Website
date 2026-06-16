# Pricing tool

Internal quoting engine plus a customer-facing price-range explorer, over one
shared, fully adjustable model. Realizes the "Pricing Calculator" plan.

## Where it lives

- **Engine + model** — `utils/pricing/`
  - `types.ts` — the model and input/output shapes
  - `engine.ts` — pure calculation, unit conversion, customer range, calibration
  - `config.ts` — `DEFAULT_CONFIG` (the tunable starting values) + localStorage cache
  - `api.ts` — client bridge to the backend (server authoritative, cache fallback)
  - `derive.ts` — build calculator inputs from a real `Artwork`
  - `currency.ts` — approximate USD→other display rates for the explorer
- **Internal calculator** — `components/PricingCalculator.tsx` at `/admin/pricing`
  (behind `AdminLayout` auth). Tabs: Calculator · Settings · Reference.
  Controls in `components/pricing/controls.tsx`, settings in `PricingSettings.tsx`.
- **Customer explorer** — `components/pricing/PricingExplorer.tsx`, rendered on the
  Multidimensional Art page behind `LAUNCH_FLAGS.pricingExplorer` (off until tuned).
- **Backend** — `functions/api/pricing/` (`config.js`, `quotes.js`, `quotes/[id].js`),
  helpers in `functions/api/_lib/pricing.js`, schema in `migrations/007_pricing.sql`.
  `GET /api/pricing/config` is public; everything else is admin-only.

## The factors

Size (interpolated anchor curve) · layer count (multiplier tiers) · finish
(natural / painted / painted+crystals) · crystal budget · lighting (size-tiered) ·
frame · climate protection · crating/shipping prep · projection mapping (quoted
separately, not in the total) · design value · negotiation margin. Frame, climate,
and crating take a per-piece override. Everything is editable in Settings and
persists to D1 (with localStorage as an offline cache).

## Needs Adrian (morning)

1. **Apply the migration** so the backend tables exist:
   `npx wrangler d1 migrations apply adrian-website --remote`
   Until then the tools fall back to the local cache / bundled defaults — nothing
   breaks, but tuning won't sync across devices and the public explorer can't read
   a shared config.
2. **Tune and validate the model.** The default anchors and multipliers are
   estimates from the plan — no real art-pricing data was available to calibrate
   against ("New Prices" was empty; "Guide Pricing" is the Qigong DVD list, a
   different project). In `/admin/pricing`: use "Start from a piece" to load real
   works, set Settings to match your intuition, save 10–15 pieces to Reference,
   enter what you actually charged, and use the calibration card to recenter.
3. **Flip the public explorer on** once the ranges read true:
   set `LAUNCH_FLAGS.pricingExplorer` to `true`.

## Notes

- Currency rates in `currency.ts` are static and clearly labeled approximate;
  update them when they drift, or wire a live source later.
- The model is one JSON blob in `pricing_config` (singleton row), so the schema
  can evolve in TypeScript without new migrations.
