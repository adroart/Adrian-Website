# Collector Ownership Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development`
> (recommended) or `executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every previously claimed artwork permanently governed, store contested claims in
the canonical registry, and make keeper transfer plus public transfer history one atomic action.

**Architecture:** One migration adds the canonical claim queue, a private mapping for random
per-transfer party references, a database guard against reset-to-bearer, and support for public
`transferred` lineage events. One owner changes the keeper state machine, lineage writer, recovery
boundary, administrator transfer surface, and related tests.

**Tech Stack:** Cloudflare Pages Functions, D1 SQLite, React 18, TypeScript, Node test runner,
Playwright, encrypted registry recovery archives.

---

## Fixed decisions

- A previously claimed piece can never return to direct bearer binding.
- First ownership uses an Ownership Code or intended-recipient invitation, never administrator
  transfer.
- Administrator transfer requires a current keeper and one kind: `sale`, `gift`, `inheritance`, or
  `artist-rebind`.
- Public transfer party references are random, transfer-scoped opaque identifiers. Their private
  mapping to account IDs is recoverable but never public or hashed as personal data.
- Contested claims are stored locally and remain pending for human resolution. Automatic freeing
  and warning escalation stay disabled.
- The frozen legacy site receives no new claim or sale writes from this foundation.

## Exclusive ownership

**Create:**

- `migrations/024_ownership_foundation.sql`
- `functions/api/_lib/claimRequests.js`
- `scripts/preflight-ownership-foundation.ts`
- `tests/ownership-foundation-preflight.test.ts`

**Modify:**

- `functions/api/keeper/bind.js`
- `functions/api/_lib/lineage.js`
- `functions/api/_lib/registryMaintenance.js`
- `functions/api/admin/maintenance/[id]/actions.js`
- `utils/publicLineage.ts`
- `utils/registryRecoveryArchive.ts`
- `functions/api/_lib/registryRecoveryExport.js`
- `utils/adminRegistryMaintenance.ts`
- `components/AdminMaintenance.tsx`
- `tests/living-legacy.test.ts`
- `tests/registry-maintenance.test.ts`
- `tests/public-lineage-history.test.ts`
- `tests/registry-recovery.test.ts`
- `tests/admin-maintenance-ui.test.ts`
- `tests/admin-studio-navigation.spec.ts`
- `tests/steward-registration.spec.ts`
- `tests/collector-phase-zero.test.ts`
- `tests/privileged-endpoints.test.ts`
- `vite.config.ts`

**Delete:**

- `functions/api/_lib/claimBridge.js`

No other agent may edit these files until this plan passes review.

### Task 1: Make previously claimed state irreversible

- [x] **Step 1: Add failing migration and endpoint tests**

In `tests/registry-maintenance.test.ts`, prove:

```sql
UPDATE keeper_pieces
   SET keeper_user_id = NULL, claimed_at = NULL
 WHERE id = 'kp-ever-claimed';
```

aborts after the row has a non-null claim time. A raw direct non-null steward-to-steward update must
also abort. Only the authorized atomic transfer operation may change the keeper. Through the
administrator endpoint, assert `reset_steward` returns `invalid_action` and performs no write.

- [x] **Step 2: Run the focused red test**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/registry-maintenance.test.ts \
  tests/admin-maintenance-ui.test.ts
```

Expected: FAIL because reset is accepted and no database trigger prevents it.

- [x] **Step 3: Add the database guard**

The migration adds a transfer marker to the keeper record plus append-only transfer intents,
private party mappings, and receipts. A previously claimed artwork cannot lose or directly rewrite
its keeper, claim time, or transfer marker. The final receipt validates the exact intent, both
private parties, the maintenance record, and the three-field public lineage event. Its database
gateway alone changes the keeper, claim time, version, display location, lineage anchor, and
transfer marker, then verifies the final state. Any missing or stale component aborts the complete
transaction.

- [x] **Step 4: Remove reset from every runtime and UI contract**

Delete reset request parsing, replay classification, client types, controls, warning copy, and Vite
mock behavior. Keep read compatibility for historical private maintenance events.

- [x] **Step 5: Verify green**

Run the focused command again. Expected: PASS, including proof that an ever-claimed Ownership Code
continues into the contested path.

### Task 2: Store contested claims in canonical D1

- [x] **Step 1: Write failing keeper-bind tests**

Through the public keeper bind endpoint, prove a valid contested attempt:

- retains the current keeper;
- records the requester from the verified session rather than the request body;
- stores an optional note privately with a 500-character ceiling;
- returns the existing `202 claim_requested` response;
- produces one pending request after duplicate retries;
- creates no public lineage event.

Also prove wrong code, unverified email, missing database, self-rescan, rate limit, and failed insert
produce no request.

- [x] **Step 2: Run the focused red test**

```bash
npx tsx --test --experimental-test-module-mocks tests/living-legacy.test.ts
```

Expected: FAIL because the endpoint still depends on the legacy bridge.

- [x] **Step 3: Add the canonical claim-request table**

The migration creates `artwork_claim_requests` with a keeper-piece foreign key, requester account,
normalized requester email, optional note, routed keeper account, pending, approved, or declined status,
created and resolved times, resolver account, and a unique pending request per requester and piece.
Indexes support pending requests by routed keeper, requester account, and normalized email.

- [x] **Step 4: Implement guarded local insertion**

`claimRequests.js` exposes:

```ts
openContestedClaim(env, {
  keeperPieceId,
  expectedKeeperUserId,
  requesterUserId,
  requesterEmail,
  note,
  openedAt,
}): Promise<{
  ok: boolean;
  status?: 'opened' | 'duplicate' | 'rate_limited' | 'self';
  reason?: string;
}>
```

The insert must be guarded by the current keeper account so a concurrent transfer cannot route a
request to a stale person.

- [x] **Step 5: Replace and delete the legacy bridge**

Update keeper bind to call `openContestedClaim`, remove bridge configuration and commentary, delete
the bridge module, and retain the current public response contract.

- [x] **Step 6: Add recovery tests and implementation**

Seed a pending claim, export, decrypt, restore to a fresh schema, and prove the request plus only its
referenced accounts survive. Upgrade older supported archives with an empty claim-request table.

- [x] **Step 7: Verify and commit the claim slice**

This landed in the single reviewed ownership-foundation commit with the inseparable transfer and
recovery changes, rather than as a separate intermediate commit.

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/living-legacy.test.ts \
  tests/registry-recovery.test.ts
npx playwright test tests/steward-registration.spec.ts --project=chromium
npm run typecheck
git diff --check
git add migrations/024_ownership_foundation.sql functions/api/_lib/claimRequests.js \
  functions/api/keeper/bind.js functions/api/_lib/claimBridge.js \
  utils/registryRecoveryArchive.ts functions/api/_lib/registryRecoveryExport.js \
  tests/living-legacy.test.ts tests/registry-recovery.test.ts \
  tests/steward-registration.spec.ts
git commit -m "feat(registry): store contested claims in canonical D1"
```

### Task 3: Append transfer lineage atomically

- [x] **Step 1: Write the failing transfer behavior test**

Extend the transfer request with required `transferKind`. Assert one successful transfer performs
all of the following or none of them:

- changes the keeper;
- advances the keeper version;
- appends one private maintenance event;
- appends one public `transferred` lineage event;
- advances the lineage count and head;
- clears display location;
- retains a non-null governed claim time.

The public payload is exactly:

```ts
{
  fromRef: 'tp-<lowercase UUIDv4>',
  toRef: 'tp-<lowercase UUIDv4>',
  transferKind: 'sale' | 'gift' | 'inheritance' | 'artist-rebind',
}
```

It contains no email, name, reason, note, code, administrator ID, or stable cross-piece person ID.

- [x] **Step 2: Add rollback and replay tests**

Force failure at keeper update, maintenance insert, party mapping insert, lineage insert, anchor
update, and final commit receipt. Also force a zero-row keeper update with stale version and a
zero-row anchor update with stale lineage state. Each case must raise inside the transaction and
leave every surface unchanged. Replay the same idempotency key after a simulated lost response and
assert exactly one private and one public event.

- [x] **Step 3: Run the focused red tests**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/registry-maintenance.test.ts \
  tests/public-lineage-history.test.ts
```

Expected: FAIL because `transferred` is rejected and the maintenance helper writes only two parts.

- [x] **Step 4: Extend the lineage schema and exact validator**

Rebuild the lineage table in the migration so `transferred` is allowed while preserving every row,
foreign key, index, unique constraint, and append-only trigger. Extend the lineage utility to accept
only the exact payload above and the four allowed transfer kinds.

- [x] **Step 5: Add private transfer-party mapping**

The migration creates an append-only private transfer intent, party mapping, and commit receipt.
Each random party reference maps to its transfer, keeper piece, role, and account ID. Add all three
tables to encrypted recovery and referenced-account discovery. None are included in public registry
or ledger exports.

- [x] **Step 6: Extend the atomic maintenance primitive**

The transfer path prepares the next lineage event before writing. One D1 batch contains the guarded
transfer intent, two private party mappings, the private maintenance event, the public lineage event,
and the final receipt. Inserting that receipt invokes the database gateway that changes the keeper,
claim time, version, display location, lineage anchor, and transfer marker, then verifies the final
state. A zero-row intermediate statement cannot be mistaken for a successful transaction.

- [x] **Step 7: Update administrator transfer UI**

Require a transfer-kind choice and explain that the keeper change creates permanent public transfer
history. Do not show or accept random party references.

- [x] **Step 8: Verify and commit the transfer slice**

```bash
npx tsx --test --experimental-test-module-mocks \
  tests/registry-maintenance.test.ts \
  tests/public-lineage-history.test.ts \
  tests/registry-recovery.test.ts \
  tests/admin-maintenance-ui.test.ts
npx playwright test tests/admin-studio-navigation.spec.ts --project=chromium
npm run typecheck
git diff --check
git add migrations/024_ownership_foundation.sql functions/api/_lib/lineage.js \
  functions/api/_lib/registryMaintenance.js functions/api/admin/maintenance/[id]/actions.js \
  utils/publicLineage.ts utils/adminRegistryMaintenance.ts components/AdminMaintenance.tsx \
  utils/registryRecoveryArchive.ts functions/api/_lib/registryRecoveryExport.js \
  tests/registry-maintenance.test.ts tests/public-lineage-history.test.ts \
  tests/registry-recovery.test.ts tests/admin-maintenance-ui.test.ts \
  tests/admin-studio-navigation.spec.ts
git commit -m "fix(registry): make stewardship transfer permanent and atomic"
```

### Task 4: Foundation review and boundary verification

- [x] **Step 1a: Build and test the earlier-damage detector and migration guard**

Reject any half-bound row and any currently unclaimed row that has a `first_bound` lineage event or
a prior non-null keeper in private maintenance history. The migration itself must stop on the same
conditions, even when the standalone detector was not run. Never infer the keeper.

- [ ] **Step 1b: Run the detector against a fresh read-only production copy before deployment**

If it finds damage, stop the production migration and require an explicit reviewed rebind. This is
deployment evidence and remains pending until the production rehearsal.

- [x] **Step 2: Run the full local boundary**

```bash
npm run test:unit
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0.

- [x] **Step 3: Run independent reviews**

Give the complete ownership diff to a fresh spec-compliance reviewer. After every spec issue is
fixed and re-reviewed, give it to a fresh code-quality reviewer. Ownership, lineage, migration,
privacy, and recovery findings must be closed before the phase advances.

- [x] **Step 4: Update the standing progress record**

Record actual passing checks, the removal of reset-to-bearer, the canonical claim queue, the atomic
public transfer event, and the next Phase 1 task. Do not claim production deployment.

- [x] **Step 5: Commit documentation**

```bash
git add todo/plans/the-collector-journey.md todo/plans/the-collector-build.md \
  todo/plans/the-collector-execution.md
git commit -m "docs(collector): correct ownership foundation status"
```

## Deployment order

1. Complete and review this implementation locally.
2. Deploy the already completed legacy-site read-only boundary before enabling any collector write.
3. Back up the canonical database.
4. Apply the foundation migration to a restored copy and verify counts and lineage heads.
5. Exercise one non-production transfer and one contested claim.
6. Restore the backup into a second clean scratch database.
7. Only then perform a reviewed production canary.

No production write is part of this implementation plan.
