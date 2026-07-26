# Artwork Registry — activation checklist

> **Status 2026-07-26.** Steps 1–5 are DONE and verified directly against
> Cloudflare (not just recorded). Both keys were generated without ever being
> displayed, installed into Cloudflare Pages production, and escrowed at
> `~/.infisical-backups/adrian-website/` (mode 0600).
>
> | Step | State |
> |---|---|
> | 1. Master encryption key + active version | done — active key is **V3** (2026-07-26), escrowed at generation and mirrored to Infisical `prod`. V2 is burned, see below. |
> | 2. Registry step-up secret | done — verified present; this is the unlock you type in the admin |
> | 3. Admin allowlist + private desk flag | done (both admin emails, desk on, public steward surface still off) |
> | 4. Encrypted backup bucket | done — `adrian-artwork-registry-backup` exists |
> | 5. Database migrations | done — live database reports "No migrations to apply"; 260/260 tests pass |
> | 6. Redeploy | done via direct upload — but **CI is broken, see below**. |
> | 7. Google Drive sync | not started — needs interactive Google sign-in (you only) |
> | 8. Stripe reversal webhooks | blocked — `STRIPE_WEBHOOK_SECRET` is absent from Pages production, and the event list is dashboard-only (you only) |
> | 9. Proof-before-engraving gate | not started — run after the deploy is green |
>
> Settings 1–3 do not reach the live site until the next deployment.
> Step 3's values were stored as encrypted secrets rather than plaintext
> dashboard variables, because there is no command-line path for Pages plaintext
> variables; they read identically at runtime.
>
> ## ⚠ Cloudflare CI cannot build `main`
>
> **Every** Git-triggered production build of `main` fails, and has since at
> least `6a7461c` (4 days ago). Preview builds on branches succeed from the same
> commits, and `npm run build` is clean locally at the exact failing commit, so
> this is a Pages build-environment fault, not a code defect.
>
> An earlier note in this file called it a "duplicate build trigger." That was
> wrong — the successful rows were branch previews, not a second production
> build. Corrected here so the mistake isn't inherited.
>
> **Consequence:** pushing to `main` no longer updates the live site. Until this
> is fixed, deploy with a direct upload, which does build the Functions bundle:
>
> ```bash
> npm run build
> npx wrangler pages deploy dist --project-name adrian-website --branch main
> ```
>
> To diagnose the CI itself, open the failing build's log in the dashboard
> (Workers & Pages → adrian-website → the `Failure` row). Likely candidates are a
> Node version mismatch or a missing build-time environment variable — neither is
> visible from the CLI.
>
> ## Master key — rotated to V2 on 2026-07-26 (escrow gap closed)
>
> **What was wrong.** `OWNERSHIP_CODE_KEY_V1` was live in Cloudflare with no
> escrow copy anywhere. The only key file on disk was
> `SUPERSEDED-do-not-use-OWNERSHIP_CODE_KEY_V1.txt`, a retired key. A Pages
> secret is write-only once set, so the value actually encrypting codes could
> never be read back. Had it been lost or overwritten, every Ownership Code
> would have become permanently undecryptable — the escrow *is* the recovery
> path.
>
> **Why rotating was safe.** The live database held `0` pieces and `0` encrypted
> codes, so there was nothing to re-encrypt and nothing to lose. Rotating after
> the first plate is engraved would not be free.
>
> **What was done.** A new 32-byte key was generated directly into
> `~/.infisical-backups/adrian-website/OWNERSHIP_CODE_KEY_V2.txt` (mode 0600) and
> piped into Cloudflare from that file, so the value was never displayed, never
> entered a chat, and never reached shell history. Verified 44 base64 chars →
> 32 bytes with a clean roundtrip, matching the app's own `cryptoConfigured`
> check. `OWNERSHIP_CODE_ACTIVE_KEY_VERSION` was set to `2`.
>
> `OWNERSHIP_CODE_KEY_V1` is deliberately retained: a retired key must outlive
> every code it ever wrote. Never delete a versioned key.
>
> ### V2 is burned — do not activate it
>
> While mirroring V2 into Infisical, the Infisical CLI echoed the key value in
> plaintext in its success table, putting it into an assistant transcript. The
> key guarded nothing at the time (0 pieces, 0 codes) and is unusable without the
> Cloudflare account, so the practical risk was low — but a master key that has
> appeared in plaintext must never become the long-lived one.
>
> **Never set `OWNERSHIP_CODE_ACTIVE_KEY_VERSION` to 2.** `OWNERSHIP_CODE_KEY_V2`
> is retained only so no version number is ever reused. It encrypted nothing.
>
> **Lesson for any future rotation:** the Infisical CLI prints the value it just
> wrote. Always redirect its output to `/dev/null` and verify by listing secret
> *names* instead. Wrangler's `secret put` does not echo values.
>
> ### Active key: V3
>
> Generated 2026-07-26 straight into
> `~/.infisical-backups/adrian-website/OWNERSHIP_CODE_KEY_V3.txt` (mode 0600),
> validated as 32 bytes with a clean roundtrip, and pushed to both Cloudflare
> Pages and Infisical `prod` with all command output suppressed. The value was
> never displayed. Confirmed live at runtime: `POST /api/admin/pieces` returns
> `401 unauthorized` rather than `503 ownership_code_crypto_not_configured`,
> which proves the Function resolved version 3 and accepted the key.
>
> **Remaining manual step.** Copy the contents of
> `OWNERSHIP_CODE_KEY_V3.txt` into your password manager. It now exists in three
> places (laptop escrow, Cloudflare, Infisical), so this is defence in depth
> rather than the single-point-of-failure it was before. Then confirm with the
> restore/decrypt drill in `docs/lineage-plate-runbook.md`.
>
> **Housekeeping.** Pages production contains a malformed secret whose *name* is
> a base64 string (`sntt…7jQ=`) — a value pasted into the name field by an
> earlier session. It is inert but should be removed:
> `npx wrangler pages secret delete 'snttEiUHmtsP21x8sU/GpQXDyQbGoREbVC8jZ/UM7jQ=' --project-name adrian-website`

The code for the whole system (QR mint, Ownership Code, laser-etch files,
encrypted recovery, R2 backup, activation, fulfillment, the guided wizard, the
offline master ledger, and Google Drive sync) is built, tested, and on the
branch. This file is the one-time **account provisioning** that only you can do,
in order. None of it can be done by an agent: it needs your Cloudflare account,
your Google account, and a master key that must be generated by you and never
pass through a chat, log, or shell history.

The deeper canary/restore/qualification procedure lives in
`docs/lineage-plate-runbook.md`. This is the ordered command list; run the
runbook's "Prototype qualification" and "Prove restoration" gates before you
engrave a real plate.

Two ways to store secrets, pick the one you use:

- **Cloudflare directly** — `npx wrangler pages secret put NAME --project-name adrian-website`
- **Infisical** (this repo has `.infisical.json`) — add the same NAMEs to your
  Infisical project's **production** environment; the names below are identical.

Plaintext (non-secret) variables like `ARTWORK_REGISTRY_ADMIN_ENABLED` are set in
the Cloudflare Pages dashboard under **Settings → Environment variables**, not
with `secret put`.

---

## 1. Generate the master encryption key (on your own machine)

```bash
openssl rand -base64 32
```

Keep this output off screenshots, tickets, chat, and shell history. Store it in
**two** places: Cloudflare (below) and a separate escrow (password manager or
institutional vault) with the key version and recovery notes.

```bash
npx wrangler pages secret put OWNERSHIP_CODE_KEY_V1 --project-name adrian-website
# paste the value when prompted
```

Set the non-secret active version (dashboard → Environment variables):

```text
OWNERSHIP_CODE_ACTIVE_KEY_VERSION = 1
```

Never delete a versioned key while any row still uses it.

## 2. Registry step-up secret

```bash
openssl rand -base64 48
npx wrangler pages secret put REGISTRY_STEP_UP_SECRET --project-name adrian-website
```

As soon as this exists (even empty) the registry stops falling back to
`UPLOAD_SECRET`. This is the "private registry unlock" you type in the admin.

## 3. Admin allowlist and the private staging flag

Dashboard → Environment variables:

```text
ADMIN_EMAILS = your-verified-email@example.com
ARTWORK_REGISTRY_ADMIN_ENABLED = true
```

`ADMIN_EMAILS` is who can even reach the admin. `ARTWORK_REGISTRY_ADMIN_ENABLED`
turns on the private plate desk without exposing the public steward surface
(keep `LAUNCH_FLAGS.livingLegacy` = `false` in source until the runbook's public
launch gate).

## 4. Create the encrypted backup bucket

The binding `ARTWORK_REGISTRY_BACKUP` is already declared in `wrangler.toml`.
Create the bucket once:

```bash
npx wrangler r2 bucket create adrian-artwork-registry-backup
```

## 5. Apply the database migrations

```bash
# test locally first
npx wrangler d1 migrations apply adrian-website --local
npm run test:unit && npm run build

# then production
npx wrangler d1 migrations apply adrian-website --remote
```

Migrations are additive only; there is no down-migration for issued identities.
Take a dated D1 export first (runbook step 4).

## 6. Google Drive sync (optional — automatic offline-ledger capture)

Reuses your existing sign-in OAuth client. You only add a Drive-scoped refresh
token. Easiest path, no code:

1. Google Cloud Console → the OAuth client used for sign-in → **enable the
   Google Drive API** for that project, and add
   `https://developers.google.com/oauthplayground` as an **Authorized redirect
   URI**.
2. Open <https://developers.google.com/oauthplayground>. Gear icon → check **Use
   your own OAuth credentials** → paste `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.
3. In "Input your own scopes" enter `https://www.googleapis.com/auth/drive.file`
   → **Authorize APIs** → sign in with the Google account that owns the target
   Drive and grant it.
4. **Exchange authorization code for tokens** → copy the **refresh token**.
5. Store it:

   ```bash
   npx wrangler pages secret put GOOGLE_DRIVE_REFRESH_TOKEN --project-name adrian-website
   ```

6. Optional target folder (dashboard → Environment variables):

   ```text
   GOOGLE_DRIVE_FOLDER_ID = <folder id from the folder URL>
   ```

`drive.file` scope lets the app manage only the one file it creates. Once set,
the desk and wizard sync `registry-ledger.jsonl` automatically after every
issue, activation, and shipment, and Drive keeps its own revision history.

## 7. Stripe reversal webhooks (for the shipment gate)

In the Stripe Dashboard, add these to your existing signed webhook endpoint so a
refunded or disputed order can no longer be marked shipped:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `charge.refunded` (incl. partial)
- `charge.dispute.created`
- `payment_intent.canceled`
- `payment_intent.payment_failed`

Confirm `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` are set.

---

## 8. Prove it before engraving

Do not fabricate a production plate until, per `docs/lineage-plate-runbook.md`:

- [ ] a labeled **canary** plate issues and its R2 backup shows **Verified**;
- [ ] a scratch **restore + decrypt** drill passes with the escrowed key
      (D1 export + R2 envelope + key together);
- [ ] the real engraved metal passes the phone-scan and physical checks;
- [ ] you have downloaded (or Drive-synced) the offline ledger and run
      `npm run ledger verify` on it.

Everything after that — issuing, etching, activating, assigning, shipping,
claiming — is the day-to-day flow the wizard walks you through.
