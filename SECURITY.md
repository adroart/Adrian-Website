# Security notes — backend API hardening

This file records the 2026-06-16 security pass on the Cloudflare Pages Functions
backend (`functions/api/**`) + D1 store, what was fixed in code, and what still
needs an owner action (secret / config / deploy / DB change) that code can't do.

## Current account and admin boundary

- Better Auth is the single customer and administrator identity.
- Administrator access requires a verified email in the fail-closed
  `ADMIN_EMAILS` allowlist. Unsafe requests also require an exact same-origin
  `Origin` header.
- Sensitive artwork registry actions require a ten-minute signed unlock bound
  to the current administrator. Its secret is `REGISTRY_STEP_UP_SECRET`, with
  transitional `UPLOAD_SECRET` fallback only when the new binding is absent.
- Password recovery revokes existing sessions. Sign-in and recovery codes are
  stored as hashes and are never logged.
- Google sign-in is exposed only when both Google OAuth variables are present.
- Keystatic keeps its separate GitHub authentication boundary.

See `docs/account-admin-runbook.md` for production configuration and transition
steps.

## Earlier hardening history

- **The shared-password admin flow is retired.** `/api/admin/login` now returns
  `410 Gone`, and runtime authorization uses the account boundary above.
- **Stripe webhook signature compare is constant-time** (`_lib/stripe.js`),
  parsing the hex signature to bytes — no `===` timing oracle.
- **`/api/viewings/:token/request` is idempotent + throttled.** A viewing that's
  already `requested`/has an invoice returns that result instead of creating a
  duplicate draft invoice and re-emailing the studio. Per token+IP rate limit.
- **Public email/cost endpoints throttled:** `/api/inquire`, `/api/subscribe`
  (and the existing `/api/checkout` limiter) via `_lib/ratelimit.js`.
- **Clerk→Better Auth cleanup:** removed the orphaned `functions/api/clerk/webhook.js`;
  `/api/checkout` authed-customer attach now gates on `env.DB` (was the defunct
  `CLERK_SECRET_KEY`); removed dead `deleteUserByClerkId`.
- **Lazy user bridge row (`ensureUser`):** cart/collections/profile/orders no
  longer 409 when `/api/auth/sync-user` wasn't called — the row is upserted.
- **`/api/delete-file` validates the R2 key** (no traversal / junk keys).
- **Currency normalized to uppercase** on order writes/reads (matches invoices/atlas).
- **`atlasSale` retry backoff shortened** (1s/5s/15s) so retries finish inside
  the `waitUntil` window instead of being silently killed.
- **Better Auth `trustedOrigins`** only includes localhost in dev.
- **Admin invoice/viewing lists** accept `?offset=` for pagination.
- **`.wrangler/` untracked + gitignored** (local emulator R2/D1 state).

## Rate limiting is best-effort (per-isolate)

`_lib/ratelimit.js` is an in-memory fixed-window limiter. Cloudflare runs many
isolates, each with its own map, and isolates recycle — so it blunts casual
abuse but is not a global guarantee. For durable, global limits bind a **KV
namespace or Durable Object** in `wrangler.toml` and back the limiter with it.

## Still requires an owner action (NOT done in code)

1. **Rotate the `sk_live_` secret** flagged compromised in
   `todo/plans/clerk-production-launch.md` (pasted in plaintext 2026-06-09).
   Confirm it's revoked + replaced in Stripe and in Cloudflare Pages env.
2. **Provision the account and admin variables** listed in
   `docs/account-admin-runbook.md`, including a separate high-entropy
   `REGISTRY_STEP_UP_SECRET`.
3. **Unset stale env vars** in Cloudflare Pages: `CLERK_SECRET_KEY`,
   `CLERK_WEBHOOK_SECRET` (the webhook is gone).
4. **Review the remaining `stripe` server SDK dependency** before removing it.
   The unused `svix` dependency has been removed.
5. **Durable rate limiting** — add a KV/DO binding if abuse becomes real.
6. **DB CHECK constraints** on `orders.status`/`invoices.status`/currency would
   need a table rebuild migration (SQLite can't `ALTER ... ADD CHECK`); deferred
   as it touches the shared live D1.
7. **Shared D1 schema** (`atlas_*` copied between adrian-website and mandalacodes)
   has no single source of truth — keep the two repos' migrations in sync by hand.

## Could not verify here
- `npm audit` / dependency CVEs and a production build — no network/node_modules
  in this environment.
- Live runtime values (secret strength, whether `sk_live_` was rotated) — only
  visible in the Cloudflare/Stripe dashboards.
