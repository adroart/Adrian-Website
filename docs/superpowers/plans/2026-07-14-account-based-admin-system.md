# Account-Based Admin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy admin password system with verified Better Auth accounts and a separate short-lived registry unlock while repairing customer account routes and recovery.

**Architecture:** Central server auth helpers validate Better Auth sessions, verified emails, the fail-closed `ADMIN_EMAILS` allowlist, and same-origin mutations. Sensitive registry endpoints additionally validate a signed ten-minute cookie bound to the current administrator. Customer and admin UI share one sign-in surface.

**Tech Stack:** React 18, TypeScript, Better Auth 1.6, Cloudflare Pages Functions, D1, Node test runner, Playwright, Wrangler.

---

### Task 1: Central Better Auth identity and admin authorization

**Files:**
- Create: `functions/api/_lib/auth.js`
- Modify: `functions/api/_lib/clerk.js`
- Modify: `functions/api/_lib/admin.js`
- Modify: `functions/api/admin/verify.js`
- Test: `tests/admin-auth.test.ts`

- [ ] Write failing tests for valid and missing sessions, verified and unverified email, normalized allowlists, missing `ADMIN_EMAILS`, guest 401, non-admin 403, same-origin mutation rejection, and no-store responses.
- [ ] Run `npx tsx --test --experimental-test-module-mocks tests/admin-auth.test.ts` and confirm the new expectations fail.
- [ ] Implement vendor-neutral `verifyRequest`, `requireUser`, `requireAdmin`, return-path validation, and the compatibility re-export.
- [ ] Update `/api/admin/verify` to return the authorized admin identity.
- [ ] Run the focused test until it passes.

### Task 2: Secure Better Auth configuration and recovery

**Files:**
- Modify: `lib/account/auth.server.js`
- Modify: `lib/account/authClient.ts`
- Create: `functions/api/auth/config.js`
- Create: `components/account/ResetPassword.tsx`
- Modify: `components/account/SignInModal.tsx`
- Modify: `App.tsx`
- Test: `tests/account-auth.test.ts`

- [ ] Write failing tests for Google present and absent, Google returned and thrown errors, password signup, email-code login, hashed OTP configuration, provider linking, forgot/reset behavior, session revocation, and safe return paths.
- [ ] Run the focused test and confirm feature-specific failures.
- [ ] Configure verified-email-safe linking, hashed OTPs, reset email delivery, and fail-closed production email sending.
- [ ] Add client wrappers and UI for password recovery, Google-first conditional display, code recovery copy, and validated return paths.
- [ ] Run the focused test and type checking until both pass.

### Task 3: Customer identity bridge and Clerk retirement

**Files:**
- Modify: `functions/api/auth/sync-user.js`
- Modify: `functions/api/checkout.js`
- Modify: protected customer endpoint imports under `functions/api/{profile,cart,collections,orders,keeper}`
- Delete: `functions/api/clerk/webhook.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `public/_redirects`
- Test: `tests/customer-account-security.test.ts`

- [ ] Write failing tests proving unverified password users cannot relink orders or claim email-bound artwork, Better Auth checkout does not depend on Clerk variables, account routes are not redirected, and the Clerk webhook is absent.
- [ ] Run the focused test and confirm the expected failures.
- [ ] Gate email relinking and claiming on verified email, rename runtime imports without renaming legacy database columns, remove the unused webhook and Svix dependency, and remove the account redirect.
- [ ] Run the focused test and existing keeper tests until they pass.

### Task 4: Registry unlock capability

**Files:**
- Modify: `functions/api/_lib/admin.js`
- Create: `functions/api/admin/registry-unlock.js`
- Modify: `functions/api/admin/logout.js`
- Test: `tests/registry-unlock.test.ts`

- [ ] Write failing tests for issuance, expiry, tamper rejection, administrator identity binding, missing secret behavior, `REGISTRY_STEP_UP_SECRET` precedence, transitional `UPLOAD_SECRET` fallback, same-origin enforcement, and clearing.
- [ ] Run the focused test and confirm it fails because the unlock does not exist.
- [ ] Implement constant-time secret validation plus signed HttpOnly, Secure, SameSite Strict, ten-minute unlock cookies.
- [ ] Implement `requireRegistryUnlock` and sign-out clearing without returning or persisting plaintext secrets.
- [ ] Run the focused test until it passes.

### Task 5: Privileged endpoint migration

**Files:**
- Modify: every handler under `functions/api/admin/`
- Modify: `functions/api/book.js`
- Modify: `functions/api/poems.js`
- Modify: `functions/api/upload-music.js`
- Modify: `functions/api/delete-file.js`
- Modify: `functions/api/pricing/config.js`
- Modify: `functions/api/pricing/quotes.js`
- Modify: `functions/api/pricing/quotes/[id].js`
- Test: `tests/privileged-endpoints.test.ts`

- [ ] Write a table-driven failing test that imports every privileged handler category and asserts guest 401, non-admin 403, authorized access, unsafe cross-origin rejection, and no-store private responses.
- [ ] Run the focused test and confirm legacy endpoints fail the matrix.
- [ ] Migrate every endpoint to the central async helper and preserve public GET behavior for book, poems, and pricing config.
- [ ] Pass authenticated administrator identity into existing audit writes where applicable.
- [ ] Run the focused test and invoice suites until they pass.

### Task 6: Sensitive registry endpoint migration and UI

**Files:**
- Modify: `functions/api/admin/pieces.js`
- Modify: `functions/api/admin/pieces/[id]/*.js`
- Modify: `components/AdminPieces.tsx`
- Modify: `components/AdminLayout.tsx`
- Modify: `components/AdminLogin.tsx`
- Test: `tests/living-legacy.test.ts`
- Test: `tests/artwork-package-recovery.test.ts`

- [ ] Update registry tests first so ordinary admins fail sensitive actions until an identity-bound unlock is present, while ordinary registry reads remain available.
- [ ] Run both registry suites and confirm the new unlock expectations fail.
- [ ] Replace plaintext `adminSecret` bodies with the unlock exchange and cookie-only sensitive requests.
- [ ] Reuse the account sign-in UI for `/admin/login`, distinguish unauthorized accounts, preserve the internal return path, and clear the unlock on sign-out.
- [ ] Run registry tests and type checking until they pass.

### Task 7: Documentation and production boundaries

**Files:**
- Modify: `README.md` or current operations documentation
- Modify: `docs/lineage-plate-runbook.md`
- Modify: account/auth documentation identified by the audit
- Test: `tests/account-routes.test.ts`

- [ ] Write failing static checks for required variable names, account routes, no public Clerk webhook, no repeated registry secret bodies, and a documented Keystatic GitHub boundary.
- [ ] Run the focused test and confirm documentation or static failures.
- [ ] Document required variables, transition order, Keystatic separation, local runtime checks, and manual production steps without secret values or em dashes.
- [ ] Run the focused test until it passes.

### Task 8: Full verification, preview, and publication

**Files:**
- Modify only files required by failures found during verification.

- [ ] Run all focused auth, admin, customer, endpoint, route, and registry tests.
- [ ] Run `npm run test:unit`, invoice tests, `npm run typecheck`, and `npm run build`.
- [ ] Apply migrations to local D1 and run `npm run dev:full` with non-production test configuration.
- [ ] Smoke-test account routes, guest 401, non-admin 403, allowlisted admin access, sign-out, cross-origin rejection, and registry unlock in the Wrangler runtime.
- [ ] Run a final independent security review and fix all critical or important findings.
- [ ] Inspect variable names only, deploy a Cloudflare Pages preview, and run safe smoke tests against the exact preview URL.
- [ ] Commit intended files, push `codex/account-admin-system`, open a draft pull request to `main`, and report any manual OAuth or production-variable work.

