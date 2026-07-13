# Security notes — backend API hardening

This file records the 2026-06-16 security pass on the Cloudflare Pages Functions
backend (`functions/api/**`) + D1 store, what was fixed in code, and what still
needs an owner action (secret / config / deploy / DB change) that code can't do.

## Fixed in code (this branch)

- **Admin auth no longer stores the raw secret in the cookie.** `_lib/admin.js`
  now issues a signed, expiring session token (`base64url(payload).hmac`,
  7-day TTL). Verification and the login password check are constant-time.
  `/api/admin/login` is rate-limited per IP. Old cookies (value == secret) are
  rejected, so any existing admin session must sign in again.
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
2. **Confirm `UPLOAD_SECRET` is high-entropy** (random 32+ chars), not a
   human-memorable password. Rotate if weak. It is the single admin credential.
3. **Unset stale env vars** in Cloudflare Pages: `CLERK_SECRET_KEY`,
   `CLERK_WEBHOOK_SECRET` (the webhook is gone).
4. **(Optional) remove unused deps** `svix`, `stripe` (server SDK) from
   `package.json` — left in place here to avoid `package-lock.json` drift; do it
   with a local `npm install` so the lockfile regenerates.
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
