# Handoff

## State

Pricing tool built end to end on branch `claude/beautiful-goodall-zz2t1x`. Type-checks clean, builds green.

Works:
- Engine `utils/pricing/{types,engine,config,api,derive,currency}.ts`. Pure calc, unit conversion, customer range, calibration insights.
- Internal calculator `/admin/pricing` (`components/PricingCalculator.tsx`, behind `AdminLayout` auth): Calculator / Settings / Reference tabs. All factors: size curve, layer slider (1–20, live multiplier), finish, crystal budget, lighting, frame, climate, crating, projection (quoted separately), design value, 15% margin, metric/imperial. "Start from a piece" loads real artworks.
- Customer explorer `components/pricing/PricingExplorer.tsx` on Multidimensional Art page, gated by `LAUNCH_FLAGS.pricingExplorer` (false). Currency selector USD/EUR/GBP/AUD/CAD.
- Backend `functions/api/pricing/{config.js,quotes.js,quotes/[id].js}`, helpers `_lib/pricing.js`, schema `migrations/007_pricing.sql`. GET config public; rest admin-only. localStorage = offline cache/fallback.
- Quote → Invoice handoff: calculator stashes to sessionStorage, `AdminInvoices` prefills draft.

Stubbed / placeholder:
- `DEFAULT_CONFIG` anchors/multipliers are plan estimates, not calibrated to real sales (no real data available: "New Prices" empty, "Guide Pricing" is an unrelated Qigong DVD list).
- Currency rates in `currency.ts` are static, hand-set, labeled approximate.

Untested:
- Backend endpoints not run against live D1 (migration not applied; no network to D1 here). Logic reviewed, not executed.
- No automated tests for the engine.
- Calculator/explorer not manually exercised in a browser this session (typecheck + production build only).

## Next

- Open a PR for `claude/beautiful-goodall-zz2t1x` if Adrian wants one (not yet requested): use the github MCP tools once reconnected.
- Adrian: apply migration — `npx wrangler d1 migrations apply adrian-website --remote`
- Adrian: tune the model at `/admin/pricing` (Settings), save 10–15 real pieces to Reference with actual prices, then use the calibration card to recenter.
- Adrian: set `LAUNCH_FLAGS.pricingExplorer` to `true` once ranges read true.
- Optional: add a unit test for `utils/pricing/engine.ts` (`calculatePricing`, `interpolateSize`, `customerRange`, `calibrationInsights`).
- Optional: run the app locally (`npm run dev`, port 5555) and click through `/admin/pricing` + the explorer.
