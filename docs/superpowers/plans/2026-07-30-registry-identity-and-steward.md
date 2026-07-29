# Registry Identity and Steward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the registry independent of Stripe, make every QR display server-derived physical identity, and make first and contested steward registration work for unique, numbered, static-catalog and admin-created artworks.

**Architecture:** The permanent public code is the sole client-visible identity key. Public and steward APIs resolve artwork and edition from D1, then join the static or draft artwork catalog server-side. Commerce remains elsewhere on the site and is not queried by registry routes.

**Tech Stack:** React 18, TypeScript, React Router, Cloudflare Pages Functions, D1, Node test runner, Playwright.

---

## Scope boundary

This plan removes registry fulfillment and Stripe coupling, fixes edition creation,
adds a public identity endpoint, repairs first and contested stewardship, and
preserves scan context through sign-in. It does not build the Maintenance desk,
acquisition records, recovery hardening, or vector conversion.

## File structure

- Modify `tests/living-legacy.test.ts`: repair the draft lookup fixture and add exact-code claim behavior.
- Modify `functions/api/_lib/artworkCatalog.js`: explicit unique/numbered validation and public identity projection.
- Modify `functions/api/admin/artworks.js`: require explicit edition intent.
- Modify `functions/api/admin/pieces.js`: reject blank or ambiguous editions.
- Modify `components/AdminPieces.tsx`: remove fulfillment UI and require edition intent.
- Modify `components/AdminPlateWizard.tsx`: remove fulfillment UI and require edition intent.
- Modify `utils/plateWizard.ts`: end the workflow at activation.
- Delete `functions/api/admin/piece-fulfillments.js`: remove commerce from registry runtime.
- Create `utils/publicRegistry.ts`: strict public identity types and validation.
- Create `functions/api/registry/[publicCode].js`: allowlisted server-derived public identity.
- Modify `functions/qr/[number].js`: redirect with public code only.
- Modify `components/WorksPage.tsx`: fetch and render public identity for every plate.
- Modify `functions/api/keeper/piece.js`: query and update by public code.
- Modify `functions/api/keeper/bind.js`: bind by public code and remove fulfillment writes.
- Modify `components/legacy/KeeperPanel.tsx`: register and contest by public code.
- Modify `components/account/SignInTrigger.tsx`: preserve a safe return destination.
- Create `tests/public-registry-identity.test.ts`: endpoint privacy and identity behavior.
- Update focused registry, admin, auth, and browser tests.

### Task 1: Restore a green registry baseline

**Files:**
- Modify: `tests/living-legacy.test.ts`
- Test: `tests/living-legacy.test.ts`

- [ ] **Step 1: Extend the fake D1 fixture for draft artwork lookup**

Add handling for the exact query introduced by `resolveArtwork()`:

```ts
if (sql.includes('FROM registry_artworks WHERE id = ?1')) {
  return statement({ first: async () => null });
}
```

- [ ] **Step 2: Run the previously failing test**

Run: `npx tsx --test --experimental-test-module-mocks --test-name-pattern "rejects unknown artworks" tests/living-legacy.test.ts`

Expected: PASS.

- [ ] **Step 3: Run the complete unit suite**

Run: `npm run test:unit`

Expected: all tests pass with zero failures.

- [ ] **Step 4: Commit**

```bash
git add tests/living-legacy.test.ts
git commit -m "test: restore registry issuance baseline"
```

### Task 2: Remove commerce from the registry lifecycle

**Files:**
- Modify: `functions/api/keeper/bind.js`
- Modify: `components/AdminPieces.tsx`
- Modify: `components/AdminPlateWizard.tsx`
- Modify: `utils/plateWizard.ts`
- Delete: `functions/api/admin/piece-fulfillments.js`
- Modify: `tests/living-legacy.test.ts`
- Modify: `tests/admin-plate-wizard.test.ts`
- Modify: `tests/privileged-endpoints.test.ts`

- [ ] **Step 1: Write a runtime-decoupling test**

Add a test that reads the registry runtime sources and rejects commerce references:

```ts
for (const path of [
  'functions/api/keeper/bind.js',
  'components/AdminPieces.tsx',
  'components/AdminPlateWizard.tsx',
  'utils/plateWizard.ts',
]) {
  const body = source(path);
  assert.doesNotMatch(body, /stripe_order|order_items|piece-fulfillments/);
}
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/admin-plate-wizard.test.ts tests/privileged-endpoints.test.ts`

Expected: FAIL because fulfillment is still part of the wizard and endpoint matrix.

- [ ] **Step 3: Remove fulfillment from first binding**

Delete `fulfillmentClaimStatement`, `repairFulfillmentClaim`, and every
`piece_fulfillments` statement from `functions/api/keeper/bind.js`. Keep one
atomic batch containing the guarded `keeper_pieces` update, `first_bound`
lineage event and claim evidence.

- [ ] **Step 4: End the wizard at activation**

Use the following stage contract in `utils/plateWizard.ts`:

```ts
export const PLATE_WIZARD_STAGES = [
  'issue', 'fabricate', 'backup', 'recovery', 'activate',
] as const;
```

Remove assignment, correction, shipment state and `/api/admin/piece-fulfillments`
requests from both admin components. An active plate is complete.

- [ ] **Step 5: Retire the registry fulfillment endpoint**

Delete `functions/api/admin/piece-fulfillments.js` and remove it from privileged
endpoint tests and local Vite mocks. Do not alter shop checkout, invoices,
orders, Stripe webhook code, or applied migrations 011 and 012.

- [ ] **Step 6: Run tests**

Run: `npm run test:unit`

Expected: PASS with no registry source querying commerce tables.

- [ ] **Step 7: Commit**

```bash
git add functions/api/keeper/bind.js components/AdminPieces.tsx components/AdminPlateWizard.tsx utils/plateWizard.ts tests vite.config.ts
git rm functions/api/admin/piece-fulfillments.js
git commit -m "refactor: make artwork registry commerce neutral"
```

### Task 3: Require explicit edition intent

**Files:**
- Modify: `functions/api/_lib/artworkCatalog.js`
- Modify: `functions/api/admin/artworks.js`
- Modify: `functions/api/admin/pieces.js`
- Modify: `components/AdminPieces.tsx`
- Modify: `components/AdminPlateWizard.tsx`
- Modify: `tests/registry-artworks.test.ts`
- Modify: `tests/living-legacy.test.ts`
- Modify: `tests/admin-registry-ui.test.ts`

- [ ] **Step 1: Write failing validation tests**

Cover the exact rules:

```ts
assert.equal(validateDraftInput({ id: 'UL-905', title: 'Study' }).error, 'edition_required');
assert.equal(validateDraftInput({ id: 'UL-905', title: 'Study', editionKind: 'unique' }).error, 'unique_confirmation_required');
assert.deepEqual(
  validateDraftInput({ id: 'UL-905', title: 'Study', editionKind: 'unique', uniqueConfirmed: true }),
  { id: 'UL-905', title: 'Study', series: null, editionSize: null, editionKind: 'unique' },
);
assert.equal(validateDraftInput({ id: 'UL-905', title: 'Study', editionKind: 'numbered' }).error, 'edition_size_required');
```

Add issuance cases proving unique requires `editionNumber: 0` plus
`uniqueConfirmed: true`, while numbered requires `1..editionSize`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-artworks.test.ts tests/living-legacy.test.ts`

Expected: FAIL because blank currently becomes unique/zero.

- [ ] **Step 3: Implement the explicit server contract**

Normalize draft input to:

```ts
type EditionIntent =
  | { editionKind: 'unique'; editionSize: null; uniqueConfirmed: true }
  | { editionKind: 'numbered'; editionSize: number };
```

For issuance, reject a missing `editionNumber`. Require `uniqueConfirmed === true`
for edition zero when resolved `editionSize` is null. Reject zero for numbered
artworks and reject values above their edition size.

- [ ] **Step 4: Replace blank edition UI**

Add Unique and Numbered choices to both admin entry points. Unique requires a
checkbox labeled `This is a unique, non-numbered work`. Numbered requires an
integer input and displays its known edition size.

- [ ] **Step 5: Run tests and type checking**

Run: `npm run test:unit && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/api/_lib/artworkCatalog.js functions/api/admin/artworks.js functions/api/admin/pieces.js components/AdminPieces.tsx components/AdminPlateWizard.tsx tests
git commit -m "fix: require explicit artwork edition identity"
```

### Task 4: Add a server-derived public identity endpoint

**Files:**
- Create: `utils/publicRegistry.ts`
- Create: `functions/api/registry/[publicCode].js`
- Modify: `functions/qr/[number].js`
- Create: `tests/public-registry-identity.test.ts`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Assert the exact public response shape:

```ts
assert.deepEqual(response.identity, {
  artworkId: 'UL-162',
  title: 'Adornments of Time - 63',
  series: 'Universal Language',
  edition: { kind: 'numbered', number: 1, size: 1, label: '1 of 1' },
  publicCode: 'AR-STCBHMPP',
  artistName: 'Adrian Rasmussen',
  plateStatus: 'active',
  publicProvenance: [],
});
```

Also assert malformed/unknown codes return 404, unavailable D1 returns 503,
edition inconsistencies return 409, and serialized output contains none of:
`amount`, `currency`, `keeper`, `email`, `ownership`, `recovery`, `ciphertext`,
`nonce`, `audit`.

- [ ] **Step 2: Run tests and confirm the route is missing**

Run: `npx tsx --test --experimental-test-module-mocks tests/public-registry-identity.test.ts`

Expected: FAIL with missing module.

- [ ] **Step 3: Implement strict public projection**

Define the shared shape in `utils/publicRegistry.ts` and make the endpoint query
only the public code, artwork ID, edition and plate status. Resolve title, series,
edition size and public provenance server-side. Build the response from an
allowlist, never by spreading a D1 row.

- [ ] **Step 4: Remove edition from the QR redirect**

Change the redirect to:

```js
const destination = `/works/${encodeURIComponent(row.piece_id)}`
  + `?instance=${encodeURIComponent(row.public_code)}&ref=qr`;
```

No client query parameter controls displayed edition.

- [ ] **Step 5: Run tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add utils/publicRegistry.ts functions/api/registry functions/qr tests
git commit -m "feat: add public plate identity endpoint"
```

### Task 5: Render exact identity on every scanned work

**Files:**
- Modify: `components/WorksPage.tsx`
- Modify: `components/legacy/KeeperPanel.tsx`
- Modify: `tests/e2e.spec.ts`
- Create: `tests/public-registry-ui.test.ts`

- [ ] **Step 1: Write failing UI contract tests**

Require `WorksPage` to fetch `/api/registry/${instance}`, display the returned
public code and edition label, and distinguish temporary failure from not found.
Require `KeeperPanel` to receive a verified public identity rather than an
`Artwork` plus optional edition.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/public-registry-ui.test.ts`

Expected: FAIL because the identity endpoint is not used.

- [ ] **Step 3: Implement the public identity state**

For a valid `instance`, fetch with `cache: 'no-store'`. Render the exact title,
artwork ID, edition label, public code, artist, plate status and selected public
provenance from the response before any optional steward content. Preserve the
existing catalog artwork presentation below it.

- [ ] **Step 4: Add failure states**

Use distinct copy and retry behavior for `404 identity not found` and
`503 registry temporarily unavailable`. Never fall back to query-string edition.

- [ ] **Step 5: Add a browser regression**

Mock the endpoint, change or remove query parameters, and prove the rendered
identity continues to match the server response on desktop and Mobile Chrome.

- [ ] **Step 6: Run tests**

Run: `npm run test:unit && npm run test:e2e`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add components/WorksPage.tsx components/legacy/KeeperPanel.tsx tests
git commit -m "feat: show exact identity from every artwork QR"
```

### Task 6: Bind and update stewardship by public code

**Files:**
- Modify: `functions/api/keeper/piece.js`
- Modify: `functions/api/keeper/bind.js`
- Modify: `components/legacy/KeeperPanel.tsx`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Write failing first-bind tests**

Use edition 1 and a draft-created artwork. Send only:

```ts
{
  publicCode: 'AR-STCBHMPP',
  ownershipCode: 'XXXX-XXXX-XXXX-XXXX'
}
```

Assert the server derives `piece_id` and `edition_number`, binds the exact row,
and ignores or rejects forged client artwork/edition fields.

- [ ] **Step 2: Write the status regression**

For an existing row with `keeper_user_id = NULL`, require:

```ts
assert.deepEqual(body, { ok: true, kept: false, keptByYou: false, ...identity });
```

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks --test-name-pattern "public code|first steward|unclaimed" tests/living-legacy.test.ts`

Expected: FAIL under the current artwork/edition client contract.

- [ ] **Step 4: Implement public-code selection**

Make GET use `?publicCode=AR-…`, PUT use `{ publicCode,
currentDisplayLocation }`, and bind use `{ publicCode, ownershipCode, note? }`.
Select by `public_code`, then use the selected D1 row's artwork and edition for
all verifier, lineage and contested-claim behavior.

- [ ] **Step 5: Correct `kept` semantics**

Return `kept: Boolean(row.keeper_user_id)` and compute `keptByYou` only when a
current steward exists.

- [ ] **Step 6: Run tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/api/keeper components/legacy/KeeperPanel.tsx tests/living-legacy.test.ts
git commit -m "fix: register exact plates by public code"
```

### Task 7: Preserve sign-in context and expose contested claims

**Files:**
- Modify: `components/account/SignInTrigger.tsx`
- Modify: `components/account/SignInModal.tsx`
- Modify: `components/legacy/KeeperPanel.tsx`
- Modify: `components/WorksPage.tsx`
- Modify: `tests/account-auth.test.ts`
- Modify: `tests/e2e.spec.ts`

- [ ] **Step 1: Write failing component and browser tests**

Cover scan, choose registration, sign in, return to the same public code with
`claim=1`, and reopen the form. Assert the Ownership Code never appears in the
URL. Cover kept-by-other state exposing `Request stewardship` and rendering a
pending message after HTTP 202.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/account-auth.test.ts && npm run test:e2e -- --grep "steward"`

Expected: FAIL because `SignInTrigger` cannot receive a destination and contested
UI is hidden.

- [ ] **Step 3: Forward a safe destination**

Add `destination?: string` to `SignInTrigger` and pass it into `SignInModal`.
Use the current work URL plus `claim=1`; continue relying on
`safeAuthDestination` to reject external or malformed destinations.

- [ ] **Step 4: Implement contested-claim UI**

Show the same labeled Ownership Code form under `Request stewardship` when
another steward exists. Treat `202 { status: 'claim_requested' }` as pending,
leave the current steward unchanged and display the returned waiting-period copy.

- [ ] **Step 5: Finish accessibility details**

Give Ownership Code and location inputs explicit labels, connect errors with
`aria-describedby`, announce server outcomes, and keep the arrival-hidden region
`inert` until visible.

- [ ] **Step 6: Run full verification**

Run: `npm run test:unit && npm run typecheck && npm run build && npm run test:e2e`

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add components/account components/legacy components/WorksPage.tsx tests
git commit -m "feat: complete steward registration journey"
```

### Task 8: Integrated registry rehearsal

**Files:**
- Modify: `docs/lineage-plate-runbook.md`

- [ ] **Step 1: Document the Stripe-neutral lifecycle**

Replace assignment/shipment prerequisites with creator-entered acquisition and
steward registration language. Keep shop instructions in their own documentation.

- [ ] **Step 2: Run one local end-to-end rehearsal**

Create a draft unique work and a numbered work, issue each, activate mocked
plates, scan their public codes, register the first steward and open a contested
claim. Record the expected visible identity at each stage.

- [ ] **Step 3: Run final verification**

Run: `git diff --check && npm run test:unit && npm run typecheck && npm run build && npm run test:e2e`

Expected: zero failures.

- [ ] **Step 4: Commit**

```bash
git add docs/lineage-plate-runbook.md
git commit -m "docs: record creator-managed registry rehearsal"
```
