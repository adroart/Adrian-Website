# Account-Based Admin System Design

## Goal

Use one Better Auth identity for collectors and administrators. Verified users may use customer account features. Only verified emails listed in `ADMIN_EMAILS` may use admin UI or APIs. High-risk artwork registry actions additionally require a short-lived registry unlock.

## Chosen architecture

The detailed delivery brief is the approved product design. Three implementation options were considered:

1. Keep the signed `admin_session` cookie and add Better Auth beside it. This preserves old code but leaves two identities and does not meet the unified account goal.
2. Replace all admin access with Better Auth and reuse `UPLOAD_SECRET` for sensitive registry actions. This unifies identity but keeps the root upload credential coupled to registry recovery.
3. Use Better Auth for all normal identity and a separate, identity-bound registry unlock for sensitive actions. This is the selected option because it meets every stated trust boundary and gives a safe transition from `UPLOAD_SECRET`.

## Identity and sign-in

`lib/account/auth.server.js` remains the single Better Auth configuration. Google is enabled only when both Google variables exist. Email code and email/password remain available. Email codes use hashed storage. Password reset uses the Better Auth email-code reset flow and revokes existing sessions after reset.

The browser sign-in surface presents Google first when configured, then password, account creation, email code, and password recovery. It handles returned Better Auth errors and thrown transport errors. A validated internal return path is passed through password, email-code, and Google flows. External URLs and non-site paths fall back to `/` or `/admin` as appropriate.

Provider linking follows verified-email identity. Google is the only trusted social provider for implicit linking. Password signup does not become an identity proof until its email is verified. Unverified sessions may create harmless account-local data, but they cannot relink orders, claim artwork by email, or become administrators.

## Server authorization

`functions/api/_lib/auth.js` provides `verifyRequest`, `requireUser`, and `requireAdmin`.

`requireAdmin` requires all of the following:

- a valid Better Auth session
- `emailVerified === true`
- a non-empty normalized email
- case-insensitive membership in comma-separated `ADMIN_EMAILS`

Missing or empty `ADMIN_EMAILS` denies everyone. Guests receive 401. Signed-in users who fail verification or allowlisting receive 403. Unsafe cookie-authenticated requests also require an exact same-origin `Origin` header. Private responses use `Cache-Control: no-store`.

Every admin and privileged endpoint imports the central helper. Keystatic remains outside this boundary because its write authority is GitHub OAuth and repository permission. That separate boundary is documented rather than merged.

## Registry unlock

`POST /api/admin/registry-unlock` accepts the step-up secret only over a same-origin request from an authorized administrator. It checks `REGISTRY_STEP_UP_SECRET` with constant-time comparison. During transition only, if the new variable is absent, the server may fall back to `UPLOAD_SECRET`; the new variable takes precedence as soon as it exists.

On success the server issues a signed cookie containing administrator user ID, normalized email, issue time, and expiry. The cookie is HttpOnly, Secure in HTTPS, SameSite Strict, scoped to `/api/admin`, and expires after about ten minutes. The signature uses a server secret with domain separation. Verification requires the current Better Auth administrator identity to match the cookie identity. No plaintext registry secret is stored in browser storage, D1, logs, responses, or persistent React state.

The unlock is required for ownership-code reveal, registry issuance or replay that returns a code, plate activation, fabrication package recovery, R2 recovery verification, claim evidence, and backup or replacement. Sign-out clears the unlock before ending the Better Auth session. Existing registry audit behavior is preserved and records the authenticated administrator where the audit schema applies.

## Customer account repair

The obsolete `/account/*` redirect is removed so Cloudflare serves the React routes. The existing legacy `clerk_user_id` database column stays unchanged to avoid migration risk, while runtime helpers and imports use vendor-neutral auth names. The obsolete Clerk webhook and its sole runtime dependency are removed after source inspection confirms no active code depends on them. Checkout no longer depends on `CLERK_SECRET_KEY` before recognizing a Better Auth session.

## UI behavior

`/admin/login` reuses the account sign-in surface and preserves the requested admin return path. `AdminLayout` verifies authorization with `/api/admin/verify`, distinguishes 401 from 403, shows the signed-in but unauthorized message, and signs out through Better Auth while clearing the registry unlock.

The registry desk holds the typed step-up value only in the active input long enough to exchange it for the HttpOnly cookie, then clears it. Later sensitive calls send no secret body. A lock action clears the unlock cookie.

## Testing and delivery

Focused Node tests cover auth configuration, verified-email and allowlist decisions, return paths, error normalization, password recovery, endpoint authorization, same-origin rejection, no-store responses, registry unlock expiry and binding, sign-out clearing, route redirects, and Clerk webhook removal. Existing registry suites are updated to use Better Auth admin identities and unlock cookies.

Verification includes unit tests, invoice tests, type checking, production build, local Wrangler Pages runtime smoke tests, preview deployment, and safe preview smoke checks. Real Google and email delivery smoke tests are performed only when the preview environment has the required variables and OAuth redirect configured. Secret values are never displayed.

