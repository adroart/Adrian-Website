# Accounts provisioning — prompt for the next agent

The unified-accounts feature (Clerk + D1 + Stripe webhook + Hologenetic Profile sync + synced cart + order history + saved collections) is code-complete in `main` and gated off via `LAUNCH_FLAGS.accounts: false` plus a commented-out D1 binding in `wrangler.toml`. What remains is the external-service provisioning + flipping one flag.

The detailed per-step checklist lives in [oracle-accounts-implementation.md](oracle-accounts-implementation.md). The prompt below is a self-contained brief you can paste into a fresh Claude Code session (or hand to a teammate) to drive that work.

---

## Prompt

> I want to finish turning on unified accounts on the Adrian Rasmussen Art site. All the code is already merged to `main` (PR #107). What's left is the external-services provisioning + flipping one launch flag.
>
> Full per-step checklist with rationale lives at `todo/oracle-accounts-implementation.md` under **"Adrian to provision"** and the **Verification** section. Read that first.
>
> Concretely:
>
> 1. **Clerk** — I'll go to clerk.com and create an application called "Adrian Rasmussen Art". Walk me through which sign-in methods to enable (we want magic-link email + Google + Apple) and which environment variables go where in Cloudflare Pages. The three keys are `VITE_CLERK_PUBLISHABLE_KEY` (build variable), `CLERK_SECRET_KEY` (Function secret), `CLERK_WEBHOOK_SECRET` (Function secret). Then help me configure the Clerk webhook to point at `/api/clerk/webhook` for `user.created`, `user.updated`, `user.deleted`.
>
> 2. **D1** — once I have wrangler logged in, run `wrangler d1 create adrian-website`, paste me the database_id from its output, then update `wrangler.toml`: replace `paste-database-id-here` with the real id AND uncomment the four-line `[[d1_databases]]` block. Then run `wrangler d1 migrations apply adrian-website --remote` against `migrations/001_init.sql`. Confirm the seven tables exist (users, profiles, orders, order_items, cart_items, collections, collection_items).
>
> 3. **Stripe webhook** — in the Stripe dashboard, add an endpoint at `https://<production-domain>/api/stripe/webhook` listening to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Help me set its signing secret as `STRIPE_WEBHOOK_SECRET` (Function secret) in Cloudflare Pages.
>
> 4. **Smoke test on the preview deploy before flipping the flag**:
>    - Sign up via the new sign-in button in the header; confirm a row appears in D1 `users` with a populated `stripe_customer_id` (the `sync-user` Function ran).
>    - Save a Hologenetic Profile at `/oracle/profile` and confirm the row in D1 `profiles`. Sign out and back in on a second browser; confirm it syncs across devices.
>    - Run a Stripe test-mode checkout while signed in; confirm the order shows up at `/account/orders` after the webhook fires.
>    - Save an oracle card to a collection via the "Save to a collection" button on a Universal Language card page; confirm at `/account/collections`.
>
> 5. **Flip the flag**: edit `launchFlags.ts` to set `accounts: true`, commit, push to a new branch, open a PR, get green CI, merge.
>
> 6. **Optional polish** (only if time): expand `public/data/cities-index.json` by running `npx tsx scripts/build-cities-index.ts cities15000.txt` against a fresh GeoNames extract. Currently 92 cities, which is undersized for global users.
>
> Don't change any behavior of the existing features. The `hologeneticProfile` flag is already on, so today/year energy panels and the profile graph are live. Accounts are the only thing gated by an off flag.
>
> Report blockers if any provisioning step needs me to make a decision (e.g. choosing a Clerk plan, picking a D1 region).
