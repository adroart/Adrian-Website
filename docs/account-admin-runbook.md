# Account and Admin Production Runbook

Customer accounts and administrator access use one Better Auth identity.
Administrative access is not a separate password or cookie. It requires a
verified account whose normalized email appears in `ADMIN_EMAILS`.

## Required Cloudflare Pages variables

Configure these runtime values for production and any preview used for account
testing. Never commit their values.

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters for Better Auth |
| `BETTER_AUTH_URL` | Canonical origin, `https://adrianrasmussen.com` in production |
| `RESEND_API_KEY` | Sends sign-in and password recovery codes |
| `RESEND_FROM_EMAIL` | Verified sender address for account email |
| `ADMIN_EMAILS` | Comma-separated verified email allowlist for administrators |
| `REGISTRY_STEP_UP_SECRET` | Separate high-entropy secret for sensitive registry actions |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth client secret |

The server advertises Google sign-in only when both Google variables exist.
Email delivery fails closed when Resend is unavailable. Missing or empty
`ADMIN_EMAILS` denies all administrator access.

## Google OAuth callback

Add this production redirect URI to the Google OAuth web client:

```text
https://adrianrasmussen.com/api/auth/callback/google
```

For a preview smoke test, add that preview's exact HTTPS origin with the same
path, then remove it when the preview is no longer needed. Keep
`BETTER_AUTH_URL` aligned with the origin being tested.

## Safe transition from the old admin credential

1. Provision `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, email delivery variables,
   and `ADMIN_EMAILS`.
2. Sign in with an allowlisted address and confirm `/api/admin/verify` returns
   the administrator identity.
3. Provision `REGISTRY_STEP_UP_SECRET` and confirm registry unlock, explicit
   lock, expiry, and logout behavior.
4. Remove stale `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, and Clerk publishable
   variables after confirming no other deployment consumes them.
5. Retire `UPLOAD_SECRET` only after checking whether file upload or another
   unrelated deployment still needs it. The registry uses it only as a
   transition fallback when `REGISTRY_STEP_UP_SECRET` is entirely absent.

The retired `/api/admin/login` route returns `410 Gone`. There is no supported
`admin_session` login flow.

## Verification checklist

- A guest receives 401 from `/api/admin/verify`.
- A signed-in non-admin receives 403.
- An allowlisted account must have a verified email before access is granted.
- Cross-origin administrator mutations are rejected.
- Sensitive registry operations remain locked until the current administrator
  completes step-up, and the unlock expires after ten minutes.
- Password recovery revokes existing sessions.
- An unverified account cannot relink orders or claim artwork.
- Private account and administrator responses include `Cache-Control: no-store`.

## Keystatic boundary

Keystatic remains a separate GitHub-authenticated content editor. Better Auth
administrator status does not grant Keystatic access, and Keystatic GitHub
authorization does not grant account or registry administrator access.
