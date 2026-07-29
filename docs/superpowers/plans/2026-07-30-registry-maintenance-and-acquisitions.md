# Registry Maintenance and Acquisitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Adrian one private Maintenance workspace for manual acquisition records and repair of artwork, plate and steward relationships, with every consequential correction retained in append-only history.

**Architecture:** Current state stays queryable in focused registry tables. A private append-only maintenance event records administrator identity, reason and canonical before/after values in the same guarded D1 batch as each mutation. Physical engraving errors are repaired by voiding or superseding a plate and linking a replacement, never by pretending the metal changed.

**Tech Stack:** Cloudflare D1 and Pages Functions, React 18, TypeScript, Better Auth admin identity, Node tests, Playwright.

---

## Scope boundary

This plan implements private acquisitions, creator metadata, steward repairs,
identity correction, void and replacement lifecycles, and the Maintenance UI.
It does not expose amounts publicly, automate Atlas sizing, process payments, or
change vector artwork.

## File structure

- Create `migrations/017_creator_registry_maintenance.sql`: acquisitions, creator entries, maintenance events and version columns.
- Create `functions/api/_lib/registryMaintenance.js`: validation, stable JSON, idempotency and guarded batches.
- Create `functions/api/admin/maintenance.js`: private search.
- Create `functions/api/admin/maintenance/[id].js`: private detail.
- Create `functions/api/admin/maintenance/[id]/acquisitions.js`: acquisition creation.
- Create `functions/api/admin/maintenance/[id]/acquisitions/[acquisitionId].js`: acquisition correction.
- Create `functions/api/admin/maintenance/[id]/actions.js`: metadata, identity and steward repairs.
- Create `utils/adminRegistryMaintenance.ts`: client types and validation.
- Create `components/AdminMaintenance.tsx`: searchable maintenance workspace.
- Modify `App.tsx` and `components/admin/AdminNavigation.ts`: route and navigation.
- Create `migrations/018_registry_plate_lifecycle.sql`: void, supersede and replacement-safe physical lifecycle.
- Extract `functions/api/_lib/registryPlateIssuance.js`: reusable plate issuance.
- Update QR, public lineage and ledger projections for superseded plates.
- Add focused unit and browser tests.

### Task 1: Add private acquisitions and append-only maintenance history

**Files:**
- Create: `migrations/017_creator_registry_maintenance.sql`
- Create: `tests/registry-maintenance.test.ts`

- [ ] **Step 1: Write failing migration tests**

Assert creation, currency/amount constraints, unique idempotency keys and
append-only triggers.

- [ ] **Step 2: Run the test and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-maintenance.test.ts`

Expected: FAIL because migration 017 is absent.

- [ ] **Step 3: Add the schema**

Use integer minor units and an explicit visibility boundary:

```sql
CREATE TABLE artwork_acquisitions (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  acquisition_type TEXT NOT NULL CHECK (acquisition_type IN
    ('sale','gift','retained','loan','consignment','inheritance','other')),
  acquired_at TEXT,
  amount_minor INTEGER CHECK (amount_minor IS NULL OR amount_minor >= 0),
  currency TEXT CHECK (currency IS NULL OR currency GLOB '[A-Z][A-Z][A-Z]'),
  acquirer_reference TEXT,
  private_notes TEXT,
  document_reference TEXT,
  public_provenance TEXT,
  record_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((amount_minor IS NULL AND currency IS NULL) OR
         (amount_minor IS NOT NULL AND currency IS NOT NULL))
);

CREATE TABLE registry_maintenance_events (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  keeper_piece_id TEXT REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  artwork_id TEXT,
  administrator_user_id TEXT NOT NULL,
  administrator_email TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_json TEXT NOT NULL,
  after_json TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded','failed')),
  related_record_id TEXT,
  created_at TEXT NOT NULL
);
```

Add `BEFORE UPDATE` and `BEFORE DELETE` abort triggers on maintenance events,
indexes by piece/time and type/time, and additive `record_version` and
`steward_version` columns on `keeper_pieces`.

- [ ] **Step 4: Run migration tests**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-maintenance.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add migrations/017_creator_registry_maintenance.sql tests/registry-maintenance.test.ts
git commit -m "feat: add private registry maintenance history"
```

### Task 2: Implement shared maintenance transactions

**Files:**
- Create: `functions/api/_lib/registryMaintenance.js`
- Modify: `tests/registry-maintenance.test.ts`

- [ ] **Step 1: Write failing helper tests**

Cover stable JSON, required reasons, amount normalization, ISO currency,
idempotent replay, conflicting idempotency payload, optimistic version mismatch,
and failure without a false success event.

- [ ] **Step 2: Run tests and confirm missing module**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-maintenance.test.ts`

Expected: FAIL with missing helper exports.

- [ ] **Step 3: Implement validation and atomic batches**

Expose focused functions:

```js
export function normalizeReason(value) {}
export function normalizeAcquisitionInput(value) {}
export function canonicalMaintenanceJson(value) {}
export async function replayMaintenanceEvent(env, idempotencyKey) {}
export async function commitMaintenanceMutation(env, {
  statements, event, expectedVersion,
}) {}
```

Use the identity returned by `requireRegistryUnlock`. Never accept administrator
identity from the request body. Store allowlisted before/after objects only.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/api/_lib/registryMaintenance.js tests/registry-maintenance.test.ts
git commit -m "feat: add guarded maintenance transactions"
```

### Task 3: Add private acquisition APIs

**Files:**
- Create: `functions/api/admin/maintenance.js`
- Create: `functions/api/admin/maintenance/[id].js`
- Create: `functions/api/admin/maintenance/[id]/acquisitions.js`
- Create: `functions/api/admin/maintenance/[id]/acquisitions/[acquisitionId].js`
- Modify: `tests/registry-maintenance.test.ts`
- Modify: `tests/privileged-endpoints.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Cover authenticated search by title, artwork ID, public code and edition; private
detail; acquisition create; guarded correction; idempotent retry; version
conflict; and exact public-field exclusion.

- [ ] **Step 2: Run tests and confirm routes are missing**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-maintenance.test.ts tests/privileged-endpoints.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement acquisition input**

Accept:

```ts
{
  acquisitionType: 'sale' | 'gift' | 'retained' | 'loan' | 'consignment' | 'inheritance' | 'other';
  acquiredAt?: string;
  amountMinor?: number;
  currency?: string;
  acquirerReference?: string;
  privateNotes?: string;
  documentReference?: string;
  publicProvenance?: string;
  reason: string;
  idempotencyKey: string;
  expectedVersion?: number;
}
```

All writes require registry unlock. Search and detail require the authenticated
admin. Public APIs never join this table for amount or currency.

- [ ] **Step 4: Run tests**

Run: `npm run test:unit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/api/admin/maintenance functions/api/admin/maintenance.js tests
git commit -m "feat: add private acquisition records"
```

### Task 4: Build the Maintenance workspace

**Files:**
- Create: `utils/adminRegistryMaintenance.ts`
- Create: `components/AdminMaintenance.tsx`
- Modify: `App.tsx`
- Modify: `components/admin/AdminNavigation.ts`
- Modify: `src/index.css`
- Modify: `vite.config.ts`
- Create: `tests/admin-maintenance-ui.test.ts`
- Modify: `tests/admin-studio-navigation.spec.ts`

- [ ] **Step 1: Write failing navigation and UI tests**

Require `/admin/maintenance`, Artwork navigation, search, private acquisition
form, before/after review, mandatory reason, conflict reload and no private
browser storage.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/admin-maintenance-ui.test.ts && npx playwright test tests/admin-studio-navigation.spec.ts`

Expected: FAIL because the route is absent.

- [ ] **Step 3: Implement client types**

Define safe list/detail types separately from acquisition mutation payloads.
Generate one `crypto.randomUUID()` idempotency key per confirmation attempt and
retain it only until the request resolves.

- [ ] **Step 4: Implement the workspace**

Create a search/results view and detail view with five sections: Public truth,
Physical plate, Private acquisition, Current steward, Maintenance history.
Consequential edits open one review panel showing before, after and required
reason. On `409 version_conflict`, reload and explain that the record changed.

- [ ] **Step 5: Verify privacy and accessibility**

All controls have visible labels, status/error announcements, 44-pixel targets,
keyboard focus order and mobile scrolling. No private value enters URLs,
`localStorage`, `sessionStorage` or public route state.

- [ ] **Step 6: Run tests**

Run: `npm run test:unit && npm run typecheck && npm run build && npx playwright test tests/admin-studio-navigation.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add App.tsx components/AdminMaintenance.tsx components/admin/AdminNavigation.ts utils/adminRegistryMaintenance.ts src/index.css vite.config.ts tests
git commit -m "feat: add registry maintenance workspace"
```

### Task 5: Add steward reset and transfer

**Files:**
- Create: `functions/api/admin/maintenance/[id]/actions.js`
- Modify: `components/AdminMaintenance.tsx`
- Modify: `tests/registry-maintenance.test.ts`

- [ ] **Step 1: Write failing action tests**

Use the exact request contract:

```ts
{
  action: 'reset_steward' | 'transfer_steward',
  targetEmail?: string,
  reason: string,
  idempotencyKey: string,
  expectedStewardVersion: number
}
```

Test verified target lookup, reset, transfer, unknown target, required reason,
idempotency, stale version 409, atomic failure and retained before/after history.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks --test-name-pattern "steward" tests/registry-maintenance.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement guarded repairs**

Resolve target email against the verified Better Auth user row. Reset clears the
current steward, claim/release timestamps and display location. Transfer sets the
target user and current claim time. Increment `steward_version` and append the
private maintenance event in the same D1 batch.

- [ ] **Step 4: Add the review UI**

Show the current steward, target verified email, exact consequences and required
reason. A successful reset visibly returns the plate to `Unclaimed`.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:unit && npm run typecheck && npm run build`

Expected: PASS.

```bash
git add functions/api/admin/maintenance components/AdminMaintenance.tsx tests
git commit -m "feat: add steward maintenance actions"
```

### Task 6: Add correction, void and replacement lifecycle

**Files:**
- Create: `migrations/018_registry_plate_lifecycle.sql`
- Create: `functions/api/_lib/registryPlateIssuance.js`
- Modify: `functions/api/admin/pieces.js`
- Modify: `functions/api/admin/maintenance/[id]/actions.js`
- Modify: `functions/qr/[number].js`
- Modify: `functions/api/registry/[publicCode].js`
- Modify: `functions/api/lineage/[publicCode].js`
- Modify: `components/AdminMaintenance.tsx`
- Modify: `tests/registry-maintenance.test.ts`
- Modify: `tests/public-registry-identity.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Cover generated-only void, active-only supersede, replacement link in both
directions, unique active identity, old-code resolution, collision refusal,
idempotency and private-field exclusion.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-maintenance.test.ts tests/public-registry-identity.test.ts`

Expected: FAIL.

- [ ] **Step 3: Add replacement-safe schema**

Rebuild `keeper_pieces` with statuses `legacy`, `generated`, `active`, `void` and
`superseded`; add `supersedes_keeper_piece_id`, `superseded_by_keeper_piece_id`
and physical disposition. Replace the unconditional artwork/edition unique
constraint with a partial unique index covering current, non-retired rows.
Rebuild every referencing table in the same migration and recreate its indexes
and append-only triggers.

- [ ] **Step 4: Extract reusable issuance**

Move package generation, encryption, public-code allocation, persistence,
backup and issuance lineage assembly from `pieces.js` into
`registryPlateIssuance.js`. Ordinary issuance and replacement both call this
module directly.

- [ ] **Step 5: Implement repair actions**

Add `correct_link`, `void_plate` and `replace_plate`. Each requires unlock,
reason, idempotency and expected version. Replacement atomically retires the old
plate, creates a new generated identity, links them and appends maintenance
history. A wrong physical engraving always requires replacement.

- [ ] **Step 6: Preserve old public codes**

Old QR URLs remain resolvable. Return a safe `superseded` status and the current
public code only when that public disclosure is enabled. Never expose private
maintenance details.

- [ ] **Step 7: Run full verification and commit**

Run: `npm run test:unit && npm run typecheck && npm run build && npm run test:e2e`

Expected: PASS.

```bash
git add migrations/018_registry_plate_lifecycle.sql functions components tests
git commit -m "feat: add repairable plate lifecycle"
```

### Task 7: Add creator, place, role and intention records

**Files:**
- Create: `migrations/019_registry_creator_history.sql`
- Create: `functions/api/admin/maintenance/[id]/provenance.js`
- Modify: `components/AdminMaintenance.tsx`
- Modify: `tests/registry-maintenance.test.ts`

- [ ] **Step 1: Write failing structured-provenance tests**

Cover contributor name and role, creation place, dated intention, material or
technique note, private/public visibility, correction history and public-field
allowlisting.

- [ ] **Step 2: Add a focused table**

Use one typed entry table:

```sql
CREATE TABLE artwork_provenance_entries (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT NOT NULL REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN
    ('contributor','creation_place','intention','material','technique','note')),
  title TEXT NOT NULL,
  detail TEXT,
  role TEXT,
  occurred_at TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private','steward','public')),
  record_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

- [ ] **Step 3: Add API and UI editing**

Create, correct and remove-current-view actions all append maintenance events.
Historical values stay in maintenance history even when an entry no longer
appears in the current view.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:unit && npm run typecheck && npm run build`

Expected: PASS.

```bash
git add migrations/019_registry_creator_history.sql functions/api/admin/maintenance components/AdminMaintenance.tsx tests
git commit -m "feat: record artwork creation provenance"
```

### Task 8: Integrated Maintenance rehearsal

**Files:**
- Modify: `docs/lineage-plate-runbook.md`
- Modify: `docs/registry-master-reference.md`

- [ ] **Step 1: Document every repair path**

Record acquisition, metadata correction, steward reset/transfer, void,
supersede/replacement and creator-history procedures with public/private effects.

- [ ] **Step 2: Rehearse all actions in a disposable local database**

Verify current truth, before/after history, old QR behavior, retry idempotency,
conflict refusal and exact price privacy after each action.

- [ ] **Step 3: Run final verification**

Run: `git diff --check && npm run test:unit && npm run typecheck && npm run build && npm run test:e2e`

Expected: zero failures.

- [ ] **Step 4: Commit**

```bash
git add docs/lineage-plate-runbook.md docs/registry-master-reference.md
git commit -m "docs: add registry maintenance operations"
```
