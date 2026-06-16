## State

Two features merged or pending merge to `main`:

**Security hardening** (`claude/optimistic-albattani-0cou9s`, PR #124):
- Admin auth: signed/expiring HMAC session cookie, constant-time login + token verify, per-IP rate limit.
- Stripe webhook constant-time signature verify.
- Rate limits on `inquire`, `subscribe`, `admin/login`, `viewings/:token/request`.
- `viewings/:token/request` idempotent (no duplicate invoices/emails).
- Removed orphan `clerk/webhook.js`; lazy `ensureUser` bridge row; `checkout` gates on `env.DB`.
- `delete-file` key validation; currency uppercased; `atlasSale` backoff shortened; `.wrangler/` gitignored.
- Details in `SECURITY.md`. Syntax-checked with `node --check`; not build/smoke-tested yet.

**Pricing tool** (already on `main` via `claude/beautiful-goodall-zz2t1x`):
- Engine `utils/pricing/`, internal calc at `/admin/pricing`, customer explorer (flag-gated).
- Backend `functions/api/pricing/`, migration `007_pricing.sql` (not yet applied remotely).
- `DEFAULT_CONFIG` anchors are estimates; currency rates are static placeholders.

## Next

- **Owner: rotate `sk_live_`** in Stripe dashboard + Cloudflare Pages env (compromised key flagged in `SECURITY.md`).
- **Owner: verify `UPLOAD_SECRET`** is random 32+ chars; rotate if not.
- **Owner: unset** `CLERK_SECRET_KEY` and `CLERK_WEBHOOK_SECRET` in Cloudflare Pages.
- Locally smoke-test admin auth after merge: `npm run dev:full`, POST `/api/admin/login`, confirm `admin_session` cookie + `/api/admin/verify` → `{ok:true}`.
- Apply pricing migration: `npx wrangler d1 migrations apply adrian-website --remote`
- Tune pricing model at `/admin/pricing` (Settings) with real piece prices; set `LAUNCH_FLAGS.pricingExplorer = true` when ready.
