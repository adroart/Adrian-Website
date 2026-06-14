# Auth: keep Clerk, or move? (Clerk vs Better Auth vs others)

Written 2026-06-15. Decision input for "is there something better than Clerk?"
Recommendation up front: **keep Clerk.** GitHub OAuth is the wrong fit for this
audience. Better Auth is the only alternative worth a second look, and only if
Clerk's per-user pricing ever becomes a real cost — not for any capability gap.

## What we actually have today

A complete, working customer-account system, all built and now verified live in
dev (see the CSP fix below — it was silently broken in production until now):

- `lib/account/AccountProvider.tsx` — single ClerkProvider, bridges Clerk hooks
  into `AccountContext`. Stub/guest mode when accounts are off.
- `functions/api/_lib/clerk.js` — server-side Clerk JWT verification
  (`verifyRequest` / `requireUser`) against Clerk JWKS.
- 13 API endpoints guarded by `requireUser()`: cart get/put, collections CRUD,
  orders list/claim, profile get/put/delete, auth sync-user, checkout.
- D1 user table + Stripe Customer sync on first sign-in.
- Shared identity across adrianrasmussen.com + mandalacodes.com (one Clerk app
  pool + one shared D1), deliberately NOT using paid satellite domains.
- UI: AuthButton in header, /account dashboard, orders, collections, the
  Save-to-collection button (now mounted on PiecePage, Store, gallery cards).

The cost of switching is therefore **a rewrite of all of the above**, not a
config change. That framing dominates everything below.

## Why GitHub OAuth is a dead end here

GitHub login authenticates developers. The people buying a wooden sculpture do
not have, and will not create, a GitHub account to do so. Adding "Sign in with
GitHub" would lower conversion, not raise it. It's a fine choice for a dev tool;
it's the wrong choice for an art collector storefront. Rule it out.

(Note: Clerk already offers Apple + Google + email out of the box, which is the
correct provider set for this audience — visible in the live sign-in modal.)

## The real contenders

| Option | Hosting | Cost model | Fit for this stack | Switching cost |
|---|---|---|---|---|
| **Clerk (current)** | Hosted | Free to 10k MAU, then per-MAU | Already integrated, CF + D1 + Stripe wired | n/a |
| **Better Auth** | Self-host on CF Workers + D1 | Free (you run it) | Strong: built for edge/Workers, owns D1 | High: rewrite provider + 13 endpoints + JWT verify |
| **Supabase Auth** | Hosted (Supabase) | Free tier, then per-MAU | Weak: pulls in a second backend (Supabase) next to D1 | High + new infra dependency |
| **Auth.js / NextAuth** | Self-host | Free | Weak: built around Next.js; this is Vite + CF Pages | High + impedance mismatch |
| **Roll your own** | Self-host | Free | Don't. Email verification, session rotation, OAuth dance, bot defense, account recovery are a lot of security surface. | Very high + ongoing maintenance |

## Better Auth — the only one worth keeping on the radar

What it would buy:
- **No per-MAU cost ever** — it's a library you run on your own Workers + D1.
- **Data ownership** — sessions and users live in your D1, no third party.
- **No Clerk DNS/launch checklist** — no per-domain Clerk production instance,
  no 5 CNAMEs per site, no Clerk dashboard.

What it would cost:
- Rewrite `AccountProvider` (Clerk hooks → Better Auth client).
- Rewrite `functions/api/_lib/clerk.js` verification + every `requireUser()`.
- Rebuild the hosted UI (sign-in modal, user button, account management) that
  Clerk gives for free — Better Auth ships primitives, not a polished modal.
- Re-implement the cross-site shared identity that currently "just works" via
  one Clerk pool + shared D1.
- Own the security surface Clerk currently owns (rotation, recovery, bot
  protection, breach response).

Realistic estimate: multiple focused days, with **no new user-facing
capability** at the end — the win is purely cost + ownership.

## The verdict

Keep Clerk unless one of these triggers fires:
1. **Cost** — approaching the 10k-MAU free ceiling, or the per-MAU bill becomes
   material. (For a personal art storefront, this is unlikely for a long time.)
2. **Data-sovereignty requirement** — a hard need to hold all user data in D1
   with no third party. (Not a current requirement.)
3. **Clerk friction** — if the per-domain production launch ritual proves more
   painful than a one-time migration. (It's a one-time setup, so usually not.)

Until then, the highest-leverage auth work is **not** switching providers — it's
finishing the Clerk production launch (DNS, secret rotation, Google OAuth) in
`todo/plans/clerk-production-launch.md`, which makes login real for actual users.

## Footnote: the bug this evaluation surfaced

While surveying, found that `public/_headers` CSP did **not** allowlist Clerk's
hosts at all — so Clerk's script was blocked and accounts were silently broken
in production (the header ships from `public/_headers` to every page). Fixed by
adding Clerk's frontend-API, `*.clerk.com`, `img.clerk.com`, Cloudflare
challenges, and `clerk-telemetry.com` across script/connect/frame/img/worker
directives. Verified in dev: Clerk now loads, the sign-in modal opens, the
Save-to-collection flow works. This was orthogonal to the provider choice but
was the actual thing breaking "login across the site."
