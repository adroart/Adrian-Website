# Registry Recovery Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make recovery qualification durable and activation-blocking, prevent backup overwrite, verify complete ledgers, and restore the full private registry only into a clean recovery database.

**Architecture:** Piece recovery, full-registry recovery and admin-access recovery remain separate. Immutable content-addressed R2 objects preserve each encrypted envelope; a persisted qualification binds copied-artifact recovery to exact system versions; a strict secret-free issuance ledger and separate private full recovery artifact serve different privacy needs.

**Tech Stack:** Cloudflare D1, R2, Pages Functions, Web Crypto, TypeScript, Node tests, Wrangler recovery procedures.

---

## Scope boundary

This plan closes false-success recovery paths. It does not convert engraving
vectors or add external institutional custody. The creator-history migration in
the Maintenance plan uses 019, so this plan begins at migration 020.

## File structure

- Create `migrations/020_registry_recovery_qualification.sql`: persisted append-only qualification.
- Modify `functions/api/_lib/plateBackup.js`: content-addressed conditional writes.
- Modify issuance, retry and recovery endpoints to retain immutable reference and digest.
- Create `utils/registryRecovery.ts`: version and currentness rules.
- Modify activation and wizard logic to require persisted qualification.
- Modify `utils/registryLedger.ts` and `scripts/registry-ledger.ts`: strict whole-file verification and clean restore.
- Expand private full-registry recovery without placing personal or financial data into the public/Drive ledger.
- Update recovery documentation and tests.

### Task 1: Add persisted recovery qualification

**Files:**
- Create: `migrations/020_registry_recovery_qualification.sql`
- Modify: `tests/artwork-package-recovery.test.ts`
- Modify: `tests/living-legacy.test.ts`

- [ ] **Step 1: Write failing migration tests**

Require append-only qualification rows, administrator identity, safe result code,
copied-artifact proof fields and no plaintext Ownership Code.

- [ ] **Step 2: Add the schema**

```sql
CREATE TABLE registry_recovery_qualifications (
  id TEXT PRIMARY KEY,
  keeper_piece_id TEXT REFERENCES keeper_pieces(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN ('piece','registry','administrative')),
  result TEXT NOT NULL CHECK (result IN ('passed','failed')),
  copied_artifacts INTEGER NOT NULL CHECK (copied_artifacts IN (0,1)),
  schema_version TEXT NOT NULL,
  build_version TEXT NOT NULL,
  key_version INTEGER,
  generator_version TEXT,
  backup_reference TEXT,
  backup_sha256 TEXT,
  administrator_user_id TEXT NOT NULL,
  administrator_email TEXT NOT NULL,
  safe_failure_code TEXT,
  qualified_at TEXT NOT NULL
);
```

Add no-update/no-delete triggers and piece/time and scope/time indexes.

- [ ] **Step 3: Run tests and commit**

Run: `npx tsx --test --experimental-test-module-mocks tests/artwork-package-recovery.test.ts tests/living-legacy.test.ts`

Expected: PASS.

```bash
git add migrations/020_registry_recovery_qualification.sql tests
git commit -m "feat: persist registry recovery qualification"
```

### Task 2: Make encrypted R2 backups non-overwriting

**Files:**
- Modify: `functions/api/_lib/plateBackup.js`
- Modify: `functions/api/admin/pieces.js`
- Modify: `functions/api/admin/pieces/[id]/backup.js`
- Modify: `functions/api/admin/pieces/[id]/verify-recovery.js`
- Modify: `tests/living-legacy.test.ts`
- Modify: `tests/artwork-package-recovery.test.ts`

- [ ] **Step 1: Write failing immutable-backup tests**

Cover deterministic document SHA-256, content-addressed key, retry without a
second write, identical race acceptance, conflicting object refusal, failed retry
preserving the prior reference and digest mismatch rejection.

- [ ] **Step 2: Run tests and confirm overwrite behavior fails them**

Run: `npx tsx --test --experimental-test-module-mocks --test-name-pattern "backup|R2" tests/artwork-package-recovery.test.ts tests/living-legacy.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement strict backup documents**

Export:

```js
export function buildBackupDocument(row) {}
export function parseBackupDocument(value) {}
export async function backupDocumentSha256(bytes) {}
```

Write to `plates/<publicCode>/<sha256>.json` with a conditional create. If a race
reports an existing object, accept only byte-identical content. Persist both the
reference and SHA-256 in D1; never overwrite the last known-good reference after
a failed attempt.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:unit`

Expected: PASS.

```bash
git add functions/api/_lib/plateBackup.js functions/api/admin/pieces.js functions/api/admin/pieces tests
git commit -m "fix: preserve immutable encrypted plate backups"
```

### Task 3: Gate activation on current copied-artifact recovery

**Files:**
- Create: `utils/registryRecovery.ts`
- Modify: `utils/artworkPlate.ts`
- Modify: `functions/api/admin/pieces/[id]/verify-recovery.js`
- Modify: `functions/api/admin/pieces/[id]/activate.js`
- Modify: `functions/api/admin/pieces.js`
- Modify: `components/AdminPlateWizard.tsx`
- Modify: `utils/plateWizard.ts`
- Modify: `tests/artwork-package-recovery.test.ts`
- Modify: `tests/admin-plate-wizard.test.ts`

- [ ] **Step 1: Write failing currentness tests**

Require missing, failed and live-only verification to block activation. Require a
copied-artifact pass and make it stale after backup reference/digest, schema,
build, key, generator or verifier version changes.

- [ ] **Step 2: Define version comparison**

```ts
export type RecoveryDependencies = {
  schemaVersion: string;
  buildVersion: string;
  keyVersion: number;
  generatorVersion: string;
  verifierVersion: string;
  backupReference: string;
  backupSha256: string;
};

export function qualificationIsCurrent(
  qualification: StoredQualification | null,
  dependencies: RecoveryDependencies,
): { current: boolean; reasons: string[] };
```

- [ ] **Step 3: Persist pass only after complete verification**

The verifier must decrypt copied R2 bytes with the separately provided escrowed
key context, check the verifier, regenerate exact assets and match hashes before
batching a `passed` qualification with a succeeded maintenance audit. A live
D1/live R2 diagnostic records `copied_artifacts = 0` and never qualifies.

- [ ] **Step 4: Enforce in activation**

Fetch the latest passed copied-artifact qualification, evaluate currentness and
include its exact identity in the conditional activation transaction. Return
`409 recovery_qualification_required` with safe stale reasons otherwise.

- [ ] **Step 5: Remove the browser bypass**

Delete `recoveryProven` and `recoveryStagingAck`. Render only persisted
`missing`, `stale` or `current` status from the server.

- [ ] **Step 6: Run tests and commit**

Run: `npm run test:unit && npm run typecheck && npm run build`

Expected: PASS.

```bash
git add utils functions/api/admin/pieces components/AdminPlateWizard.tsx tests
git commit -m "fix: require durable recovery before activation"
```

### Task 4: Verify the complete ledger file

**Files:**
- Modify: `utils/registryLedger.ts`
- Modify: `scripts/registry-ledger.ts`
- Modify: `tests/registry-ledger.test.ts`

- [ ] **Step 1: Write the adversarial tests**

Reject missing, duplicate or late headers; unsupported schema; malformed JSON;
false count; false head; clean last-line truncation; extra valid line with stale
header; and unknown record shapes.

- [ ] **Step 2: Run tests and confirm current false positives**

Run: `npx tsx --test --experimental-test-module-mocks tests/registry-ledger.test.ts`

Expected: FAIL on clean tail truncation and forged headers.

- [ ] **Step 3: Implement whole-file verification**

Add:

```ts
export type LedgerFileVerifyReason =
  | 'missing_header' | 'duplicate_header' | 'late_header' | 'schema'
  | 'record_count' | 'head_hash' | 'json' | 'record_shape'
  | LedgerVerifyResult['reason'];

export async function verifyLedgerFile(file: {
  header: LedgerHeader | null;
  lines: LedgerLine[];
}): Promise<LedgerFileVerifyResult> {}
```

Strict parsing must produce an error instead of silently filtering duplicate or
late headers. `verify`, `diff` and restore CLI commands all call
`verifyLedgerFile`, never `verifyLedgerChain` alone.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:unit`

Expected: PASS.

```bash
git add utils/registryLedger.ts scripts/registry-ledger.ts tests/registry-ledger.test.ts
git commit -m "fix: verify complete registry ledger files"
```

### Task 5: Separate public ledger from complete private recovery

**Files:**
- Modify: `utils/registryLedger.ts`
- Modify: `functions/api/_lib/registryLedgerExport.js`
- Modify: `functions/api/admin/registry-ledger.js`
- Modify: `functions/api/_lib/driveSync.js`
- Create: `functions/api/admin/registry-recovery-export.js`
- Create: `tests/registry-recovery.test.ts`
- Modify: `tests/privileged-endpoints.test.ts`

- [ ] **Step 1: Write failing boundary tests**

Require the secret-free issuance ledger to exclude steward identity, exact
amounts, private notes and evidence. Require the encrypted/private recovery
export to cover every registry-owned table and include per-table counts.

- [ ] **Step 2: Enumerate the recovery boundary**

Include `registry_artworks`, `keeper_pieces`, `keeper_intentions`, dormant legacy
fulfillments, acquisitions, provenance entries, claim evidence, public lineage,
ownership audit, maintenance events and recovery qualifications. Include only
the Better Auth user/account rows referenced by current or historical stewards;
exclude sessions and verification tokens.

- [ ] **Step 3: Implement two explicit downloads**

Keep `registry-ledger.jsonl` secret-free. Add an unlocked private full-recovery
export with `Cache-Control: no-store`, a distinct content type/name and an
encrypted archive contract. Never silently upload it through the existing Drive
sync.

- [ ] **Step 4: Add exact count and privacy assertions**

Test deterministic ordering, table counts, foreign-key coverage and absence of
private values from the public ledger.

- [ ] **Step 5: Run tests and commit**

Run: `npm run test:unit && npm run typecheck`

Expected: PASS.

```bash
git add utils/registryLedger.ts functions/api tests
git commit -m "feat: add complete private registry recovery export"
```

### Task 6: Make restoration clean-only and conflict-failing

**Files:**
- Modify: `utils/registryLedger.ts`
- Modify: `scripts/registry-ledger.ts`
- Modify: `tests/registry-recovery.test.ts`

- [ ] **Step 1: Write failing round-trip tests**

Apply all migrations to a temporary SQLite database, insert representative rows,
export, restore into a second migrated empty database and compare every table
count and final head. Prove a second restore and a target containing one
conflicting row abort.

- [ ] **Step 2: Replace permissive restore SQL**

Replace `buildRebuildSql` with `buildRestoreSql(verifiedFile)`. Emit dependency-
ordered plain `INSERT`, never `INSERT OR IGNORE`. Begin with a transaction and a
guard that aborts if any registry-owned target table contains data.

- [ ] **Step 3: Rename the CLI command**

Replace `to-sql` with `restore-sql`. Require a verified input and print
instructions for a newly created, fully migrated recovery database. Never target
the configured production database automatically.

- [ ] **Step 4: Run tests and commit**

Run: `npm run test:unit`

Expected: PASS.

```bash
git add utils/registryLedger.ts scripts/registry-ledger.ts tests/registry-recovery.test.ts
git commit -m "fix: make registry restoration conflict-failing"
```

### Task 7: Rehearse and document all three recoveries

**Files:**
- Modify: `docs/lineage-plate-runbook.md`
- Modify: `docs/registry-master-reference.md`
- Modify: `docs/registry-activation-checklist.md`

- [ ] **Step 1: Document the separate drills**

Write exact procedures for piece package recovery, complete registry recovery and
admin account/unlock recovery. Record where copied artifacts and separately
escrowed keys originate without placing secret values in documentation.

- [ ] **Step 2: Run the disposable recovery rehearsal**

Use copied exports, a scratch D1 database, a scratch R2 location and the
separately escrowed key. Compare package hashes, table counts, public-code
resolution and current steward state.

- [ ] **Step 3: Run final verification**

Run: `git diff --check && npm run test:unit && npm run typecheck && npm run build && npm run test:e2e`

Expected: zero failures.

- [ ] **Step 4: Commit**

```bash
git add docs/lineage-plate-runbook.md docs/registry-master-reference.md docs/registry-activation-checklist.md
git commit -m "docs: qualify complete registry recovery"
```
