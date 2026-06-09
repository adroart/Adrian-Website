# Clerk production launch — go-live checklist

## TL;DR — what's actually urgent
Only ONE thing is time-sensitive: **rotate the exposed `sk_live_` secret (§ B), ~2 min.** Everything else here is launch-day work with no clock on it — do it when you decide to open real-user login. Dev login is already live and fine for testing now.

Priority order when you DO launch: B (rotate) → A (DNS + Google) → C (hand Claude the keys) → D (mandalacodes) → Apple (optional, skippable).

Context: shared dev Clerk login is **already live** on adrianrasmussen.com + mandalacodes.com (one dev app, one shared D1 `adrian-website`). This plan covers swapping from the dev instance (`pk_test_`/`sk_test_`) to **production** for real users.

**Decision locked 2026-06-09:** NO Clerk satellite domains (paid). Each site gets its own free Clerk production instance, both pointed at the same shared D1 — so it stays one collector identity + one set of data across both sites, for free. The only thing skipped is automatic cross-domain session sharing, which Adrian has repeatedly chosen not to pay for.

## A. adrianrasmussen.com production instance

Production instance already created ("Adrian Rasmussen Art"), primary domain `adrianrasmussen.com`. Remaining:

- [ ] **DNS — add 5 CNAME records in Cloudflare** for adrianrasmussen.com. Production stays dark (no SSL) until all 5 verify:
  - `clerk` → `frontend-api.clerk.services`
  - `accounts` → `accounts.clerk.services`
  - `clkmail` → `mail.r8pq428q2g3r.clerk.services`
  - `clk._domainkey` → `dkim1.r8pq428q2g3r.clerk.services`
  - `clk2._domainkey` → `dkim2.r8pq428q2g3r.clerk.services`
- [ ] **Google OAuth (production needs own credentials)** — console.cloud.google.com → APIs & Services → Credentials → create OAuth 2.0 Web client → add Authorized Redirect URI `https://clerk.adrianrasmussen.com/v1/oauth_callback` → paste Client ID + Secret into Clerk → Configure → SSO connections → Google.
- [ ] **Apple sign-in (optional, $99/yr Apple Developer)** — Services ID + Sign in with Apple key; deferred, not blocking launch. Email + Google cover launch.

## B. ⚠️ Rotate the exposed secret key — DO FIRST

The production `sk_live_…` was pasted in plaintext in chat on 2026-06-09, so it is compromised. In Clerk → production → API keys → Secret keys: **create a new secret key, then delete the exposed one.** Use only the new key below.

## C. Hand off to Claude (autonomous once B + DNS done)

Once DNS verifies and the secret is rotated, give Claude the **new** `sk_live_` + the `pk_live_`. Claude then does autonomously (same flow as the dev launch):
- Update `.env.production` (publishable key) in **both** repos to `pk_live_`.
- Swap `CLERK_SECRET_KEY` to the new `sk_live_` on **both** Cloudflare Pages projects.
- Commit → PR → merge → verify live bundles carry the prod key.

Publishable key (public, safe): `pk_live_Y2xlcmsuYWRyaWFucmFzbXVzc2VuLmNvbSQ`

## D. mandalacodes.com own production instance

- [ ] Create a **separate free Clerk production instance** for mandalacodes.com (own primary domain + own DNS CNAMEs + own Google OAuth client with redirect `https://clerk.mandalacodes.com/v1/oauth_callback`).
- [ ] Point it at the **same shared D1** (`adrian-website`, id `d0e93f04-203c-4dbd-945a-e14a9a364dd5`) so collectors and data stay unified.
- [ ] Hand Claude that instance's `pk_live_`/`sk_live_` to wire mandalacodes' `.env.production` + Pages secret.

No code changes needed for any of this — Clerk's hosted modal auto-renders whichever providers each instance enables.
