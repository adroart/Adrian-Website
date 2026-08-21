# Finish setup — Adrian Rasmussen Artwork Registry (drop-in guide)

Paste this into an AI assistant that has access to your authenticated terminal,
or follow it yourself. It provisions the live registry so the guided wizard and
the QR system function on adrianrasmussen.com.

- **Repo:** `technicianofthesacred/Adrian-Website` (branch `main`)
- **Cloudflare Pages project:** `adrian-website`
- **Non-destructive:** the new features are additive and fail closed; nothing on
  the public site changes until these are set.
- Steps marked **[YOU ONLY]** cannot be done by any AI — they need your own key
  generation or a browser consent click. Never paste a generated key or token
  into a chat.
- **After any variable change, REDEPLOY** — Cloudflare Pages Functions only read
  new values on a fresh deployment.

## Links you'll use

- Cloudflare dashboard → your project: <https://dash.cloudflare.com> → **Workers & Pages → adrian-website**
- Variables: **adrian-website → Settings → Variables and Secrets** (Production)
- R2 buckets: **adrian-website account → R2**
- Wrangler CLI (for migrations + bucket): `npm i -g wrangler && wrangler login`
- Infisical (only if you sync secrets through it): <https://app.infisical.com> — workspace `5f69e389-68a2-45a6-95f0-205ff96a3de8`
- Google Cloud credentials: <https://console.cloud.google.com/apis/credentials>
- Enable Drive API: <https://console.cloud.google.com/apis/library/drive.googleapis.com>
- Google OAuth Playground: <https://developers.google.com/oauthplayground>
- Stripe webhooks: <https://dashboard.stripe.com/webhooks>

## Where values go

Set everything in **Cloudflare → adrian-website → Settings → Variables and
Secrets (Production)**. Mark the sensitive ones **Encrypt (Secret)**:

| Variable | Type | Value |
|---|---|---|
| `OWNERSHIP_CODE_KEY_V1` | Secret | 32-byte base64 key (step 1) |
| `OWNERSHIP_CODE_ACTIVE_KEY_VERSION` | Plaintext | `1` |
| `REGISTRY_STEP_UP_SECRET` | Secret | your unlock value (step 2) |
| `REGISTRY_RECOVERY_EXPORT_KEY` | Secret | 32-byte base64 key, must be DIFFERENT from OWNERSHIP_CODE_KEY_V1, escrowed outside Cloudflare (step 3) |
| `REGISTRY_RECOVERY_EXPORT_KEY_ID` | Plaintext | short label like `rk1` (step 3) |
| `ADMIN_EMAILS` | Plaintext | `sccsclothing@gmail.com,technicianofthesacred@gmail.com` |
| `ARTWORK_REGISTRY_ADMIN_ENABLED` | Plaintext | `true` |
| `GOOGLE_DRIVE_REFRESH_TOKEN` | Secret | drive.file refresh token (step 7, optional) |
| `GOOGLE_DRIVE_FOLDER_ID` | Plaintext | target folder id (optional) |

If you manage secrets through Infisical, add the same names to your **production**
environment there instead; Cloudflare production is what the live site reads.

---

## Step 1 — [YOU ONLY] Master encryption key

On your own trusted machine:

```bash
openssl rand -base64 32
```

Store the output in **two** places: (a) Cloudflare as `OWNERSHIP_CODE_KEY_V1`,
(b) your password manager / vault — this escrow copy is what lets you decrypt
codes forever, even if you ever leave Cloudflare. Then set:

```bash
npx wrangler pages secret put OWNERSHIP_CODE_KEY_V1 --project-name adrian-website
# paste the value when prompted
```

Also add plaintext `OWNERSHIP_CODE_ACTIVE_KEY_VERSION = 1`. Never delete a
versioned key while any code still uses it. Do not paste this value into any chat.

## Step 2 — Registry unlock secret

```bash
openssl rand -base64 48
npx wrangler pages secret put REGISTRY_STEP_UP_SECRET --project-name adrian-website
```

Save it in your password manager. This is what you type into "Private registry
unlock" in the admin. Changing it later is safe and affects no stored codes.

## Step 3 — Admin allowlist + enable the private desk

In Variables and Secrets (Production), plaintext:

```text
ADMIN_EMAILS = sccsclothing@gmail.com,technicianofthesacred@gmail.com
ARTWORK_REGISTRY_ADMIN_ENABLED = true
```

Both accounts must sign in with a **verified** email. Leave
`LAUNCH_FLAGS.livingLegacy = false` in code until the public-launch gate.

## Step 4 — Create the R2 backup bucket

Dashboard: **R2 → Create bucket → `adrian-artwork-registry-backup`**, or:

```bash
npx wrangler r2 bucket create adrian-artwork-registry-backup
```

The binding `ARTWORK_REGISTRY_BACKUP` is already in `wrangler.toml`.

## Step 5 — Apply the database migrations (needs wrangler login)

```bash
# test locally first
npx wrangler d1 migrations apply adrian-website --local
npm run test:unit && npm run build

# then production
npx wrangler d1 migrations apply adrian-website --remote
```

Additive only; no down-migrations. Take a dated D1 export first if you have data.

## Step 6 — Redeploy

Cloudflare → **adrian-website → Deployments → Retry deployment** (or push any
commit). Variable changes only take effect on a fresh deploy.

## Step 7 — [YOU ONLY] Google Drive sync (optional, automatic ledger capture)

1. Enable the Drive API for your OAuth project (link above).
2. Google Cloud → Credentials → your **sign-in OAuth client** → add
   `https://developers.google.com/oauthplayground` as an Authorized redirect URI.
3. Open the OAuth Playground → gear icon → **Use your own OAuth credentials** →
   paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Scope: `https://www.googleapis.com/auth/drive.file` → **Authorize APIs** →
   sign in with the Google account that owns the target Drive → grant.
5. **Exchange authorization code for tokens** → copy the **refresh token**.
6. Set secret `GOOGLE_DRIVE_REFRESH_TOKEN` (+ optional `GOOGLE_DRIVE_FOLDER_ID`).
7. Redeploy.

## Step 8 — Stripe reversal webhooks

Stripe → Webhooks → your endpoint → add: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
`charge.refunded`, `charge.dispute.created`, `payment_intent.canceled`,
`payment_intent.payment_failed`. Confirm `STRIPE_WEBHOOK_SECRET` and
`STRIPE_SECRET_KEY` are set.

---

## Step 9 — Smoke test (prove it functions)

1. <https://adrianrasmussen.com/qr> loads — the deploy is live.
2. Sign in at <https://adrianrasmussen.com/admin> with an `ADMIN_EMAILS` account.
3. Open the wizard: <https://adrianrasmussen.com/admin/pieces/wizard>
4. Type `REGISTRY_STEP_UP_SECRET` in **Private registry unlock** → it opens.
5. Issue a **canary** plate (a test artwork + edition) → download the 3 files →
   confirm backup shows **Verified** → **Verify R2 recovery** passes.
6. Open its QR `https://adrianrasmussen.com/qr/AR-XXXXXXXX` → resolves to
   `/works/…`.
7. **Download offline ledger** → `npm run ledger verify ./registry-ledger.jsonl`.

Do **not** engrave a real plate until the canary + restore/decrypt drill in
`docs/lineage-plate-runbook.md` pass.

## Reference

- `docs/registry-activation-checklist.md` — the same steps, condensed
- `docs/lineage-plate-runbook.md` — canary, restore proof, prototype qualification
- `docs/registry-master-reference.md` — how the whole system works
