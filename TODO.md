# TODO — Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints.

## Soon

- [ ] **Decide whether to strip Bali from About bio + Writings stories.** 2026-05-29 pass removed Bali from all business copy and SEO (inquiry success messages, shipping notices, footer, meta tags, JSON-LD address). Left autobiographical mentions in `components/About.tsx` (lines ~107, 229, 239) and personal stories (`content/stories/light-codes.md`, `content/stories/path-tea.md`) per scope choice. Revisit if a buyer reading the About page is still too "Bali-coded" — or accept as life-story context. Standing rule is saved in [feedback_no_business_location.md](../../.claude/projects/-Users-adrianrasmussen-Documents-Files-2-Areas-Coding-Adrian-Website/memory/feedback_no_business_location.md).

- [ ] **Watch for SEO ranking shift after Bali removal.** Removing `addressLocality: Bali` from JSON-LD will drop the site from "Bali artist" local-search results that Google had indexed. Expected and intended. Worth a glance at Cloudflare Analytics search-term data over the next month to confirm nothing important relied on it.

- [ ] **Oracle accounts branch decision.** `origin/claude/oracle-energy-birthdate-4HS3f` carries Clerk + D1 + Hologenetic profile + today/year energy panels. Today/year cards on `main` are placeholder. Either merge that branch into `main`, or accept the placeholder state as permanent now that the oracle work lives in mandalacodes. Mandalacodes already has its own Clerk swap merged (2026-05-28); double-Clerk-app or shared-app is the choice point.

## Future

- [ ] **Shop launch.** `LAUNCH_FLAGS.shopEnabled` is `false`. "Add to Cart" routes to `/inquire`. Price IDs still placeholder. When ready: real Stripe price IDs, flip the flag.

- [ ] **Mandala Codes split — Phase 2 cleanup.** The oracle reader components, oracle data files, and inline-redirect components are still in place as planned (see Operational notes below). Once mandalacodes.com is visibly sale-ready (deck purchase path live) and the redirects have been live long enough to confirm no traffic still relies on the in-site oracle pages, remove the oracle reader (`UniversalLanguageCard`, `UniversalLanguageIndex`, `OracleSystems`, `OracleProfile`, `OracleCardEntrance`, `components/oracle/`) and any oracle-only data files (`synthesisData`, expanded readings, `profilePositions`, `trigrams`) that nothing else imports. Optionally add a small "Experience this in Mandala Codes" cross-link on each Universal Language piece page. Full scope in [`docs/phase-2-mandala-split.md`](docs/phase-2-mandala-split.md).

## Operational notes (not TODOs — context for future-you)

- The QR Function at `functions/qr/[number].js` redirects scanned plaques to `mandalacodes.com/universal-language/:n`. Treat it as permanent infrastructure — printed plaques out in the world depend on it.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic still relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).
