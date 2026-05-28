# TODO — Adrian-Website

Living list of outstanding work on the artist portfolio + shop. See `CLAUDE.md` for the project's intent and constraints.

## Soon

- [ ] **Oracle accounts branch decision.** `origin/claude/oracle-energy-birthdate-4HS3f` carries Clerk + D1 + Hologenetic profile + today/year energy panels. Today/year cards on `main` are placeholder. Either merge that branch into `main`, or accept the placeholder state as permanent now that the oracle work lives in mandalacodes. Mandalacodes already has its own Clerk swap merged (2026-05-28); double-Clerk-app or shared-app is the choice point.

## Future

- [ ] **Shop launch.** `LAUNCH_FLAGS.shopEnabled` is `false`. "Add to Cart" routes to `/inquire`. Price IDs still placeholder. When ready: real Stripe price IDs, flip the flag.

## Operational notes (not TODOs — context for future-you)

- The QR Function at `functions/qr/[number].js` redirects scanned plaques to `mandalacodes.com/universal-language/:n`. Treat it as permanent infrastructure — printed plaques out in the world depend on it.

- Oracle code (`OracleGateway`, `UniversalLanguageCard`, oracle data files, vite OG plugin) was intentionally left in place when mandalacodes split off. It can be removed in a future PR after the redirect has been live long enough to confirm no traffic still relies on the in-site oracle pages.

- `/atlas` and `/atlas/*` hard-redirect to `mandalacodes.com/atlas`. The atlas implementation was removed from Adrian-Website on 2026-05-23 (PR #111 + #112).
