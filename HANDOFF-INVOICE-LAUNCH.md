# Invoice Creator Launch Handoff

Date: 2026-06-05

## Current State

The invoice creator has been built into the Adrian Website repo.

Routes:
- Admin creator: `/admin/invoices`
- Public invoice: `/invoice/:token`

Live URLs after deploy:
- Admin: `https://adrianrasmussen.com/admin/invoices`
- Public invoices: `https://adrianrasmussen.com/invoice/<token>`

Local dev:
- `npm run dev`
- `http://localhost:5555/admin/invoices`

## What Is Done

- Added Cloudflare D1 schema for reusable payment presets and invoices.
- Created the remote D1 database `adrian-website`.
- Enabled the D1 `DB` binding in `wrangler.toml`.
- Applied migrations remotely:
  - `001_init.sql`
  - `002_invoices.sql`
- Added admin APIs for payment presets and invoices.
- Added public invoice lookup by token.
- Added admin UI for creating invoices.
- Added public A4 invoice page with light-mode print/PDF styling.
- Payment methods are now:
  - Wise
  - Crypto
  - Bank transfer
- New invoices preselect all active payment options by default.

## What You Do In VS Code

Open the repo:

```bash
code "/Users/adrianrasmussen/Documents/Files/2 Areas/Coding/Adrian-Website"
```

Useful files:
- `components/AdminInvoices.tsx` admin invoice creator UI
- `components/PublicInvoice.tsx` public printable invoice page
- `functions/api/_lib/invoices.js` invoice validation and serialization
- `functions/api/admin/payment-presets.js` payment option API
- `functions/api/admin/invoices.js` invoice API
- `migrations/002_invoices.sql` invoice database schema
- `wrangler.toml` Cloudflare bindings

## After Deploy, Fill In Payment Details

Go to:

```text
https://adrianrasmussen.com/admin/invoices
```

Create or edit payment options:

Wise:
- Label: `Wise`
- Method: `Wise`
- Currency: your preferred invoice currency
- Instructions: how the client should pay
- Details: account/reference notes
- Link: your Wise payment link, if you want a clickable button

Crypto:
- Label: `Crypto`
- Method: `Crypto`
- Instructions: which coins/networks are accepted
- Details: wallet address, network, reference instructions
- Link: optional hosted crypto payment link

Bank transfer:
- Label: `Bank transfer`
- Method: `Bank`
- Details: account name, bank, account number, routing/BSB/SWIFT/IBAN as needed
- Link: usually blank

## How To Send An Invoice

1. Go to `/admin/invoices`.
2. Add client name, email, job title, job description, and amount.
3. Choose the payment schedule:
   - One payment
   - Half now, half before shipping
   - Design deposit, ready to cut, ready to ship
4. Select the current step.
5. Check `Total due today`.
6. Click `Save`.
7. Click `Send / copy link`.
8. Send the copied link to the client by email, WhatsApp, DM, or whatever channel you use.

The client can open the link, choose Wise/Crypto/Bank transfer, and use `Print / save PDF`.

## Live Deployment Notes

Cloudflare Pages deploys from `main`.

If the code has not deployed yet:

```bash
git checkout main
git pull
git merge claude/remove-oracle
git push origin main
```

If Cloudflare Pages asks about environment bindings, confirm:
- D1 binding name: `DB`
- D1 database name: `adrian-website`
- D1 database id: `d0e93f04-203c-4dbd-945a-e14a9a364dd5`

Admin login uses a verified Better Auth account whose email is included in the
`ADMIN_EMAILS` Pages environment variable. If admin login fails on production,
check the account session, email verification, and allowlist configuration.
`UPLOAD_SECRET` does not grant ordinary administrator access.

## Verification Commands

```bash
node --test tests/invoice-utils.test.mjs
npx tsx --test tests/invoice-ui.test.ts
npm run typecheck
npm run build
```
