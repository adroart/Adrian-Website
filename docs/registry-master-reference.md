# Artwork registry master reference

This is the system map for Adrian Rasmussen's permanent artwork identities. The
operational engraving procedure is `docs/lineage-plate-runbook.md`. Full private
recovery is `docs/registry-private-recovery.md`.

## System boundary

Each physical piece has two identifiers:

| Identifier | Location | Purpose | Public |
|---|---|---|---|
| `AR-XXXXXXXX` | Front QR and text | Permanent look-only identity | Yes |
| `K7QM-9XTR-2PHV-N4WB` style Ownership Code | Underside | Private possession proof | No |

The public code selects one server-side registry row. The QR does not carry the
artwork ID, edition, owner, amount, or Ownership Code as authoritative input.
The server derives the public artwork and edition from the public code.

The registry is creator-managed and commerce-neutral. It has no dependency on
Stripe, checkout sessions, orders, payment status, assignment, or shipment.
Adrian may privately enter an acquisition amount and related information at any
time. Exact amounts never appear in public responses.

## End-to-end lifecycle

1. **Define edition**: explicitly mark the artwork unique or numbered.
2. **Issue**: mint one public code and one Ownership Code idempotently.
3. **Archive fabrication files**: front SVG, underside SVG, private manifest.
4. **Back up**: write the encrypted envelope to an immutable content-addressed
   R2 object and bind the exact digest to the database row.
5. **Prove copied recovery**: download the encrypted JSON, archive it outside
   the site, re-upload that copied file, decrypt in memory, verify the code, and
   regenerate both exact SVG hashes.
6. **Engrave and test**: qualify the actual metal, QR, attachment, and finish.
7. **Activate**: submit all physical checks and both exact manifest hashes. The
   current backup and current copied-file proof are hard gates.
8. **Record creator history and acquisition**: use private maintenance, choosing
   visibility for each history entry.
9. **Bind steward**: the first verified account with the correct underside code
   may bind only after activation, verified immutable backup, and current copied
   recovery proof. Later claimants cannot overwrite the steward.
10. **Maintain**: correct digital records with append-only reasons and versions.
    Wrong physical metal is voided or superseded, never relinked.

## Primary screens

- `/admin/pieces/wizard`: required guided issue, recovery, and activation flow.
- `/admin/pieces`: flat registry desk for overview and specialist actions.
- `/admin/maintenance`: searchable private acquisitions, creator history,
  steward repairs, link corrections, voids, and replacements.
- `/qr/:code`: permanent public redirect resolver.
- `/works/:id`: public artwork record.

## Important endpoints

Admin endpoints require an approved administrator session. Sensitive writes and
private recovery also require a recent identity-bound registry unlock.

- `GET/POST /api/admin/pieces`: list safe metadata or issue a plate.
- `POST /api/admin/pieces/:id/backup`: retry immutable encrypted backup.
- `GET /api/admin/pieces/:id/backup`: download the exact encrypted recovery JSON.
- `POST /api/admin/pieces/:id/verify-recovery`: qualify the submitted copied file.
- `POST /api/admin/pieces/:id/activate`: physically activate or re-check an
  active repaired identity.
- `POST /api/admin/pieces/:id/package`: recover the private fabrication package.
- `POST /api/admin/pieces/:id/reveal`: audited Ownership Code reveal.
- `/api/admin/maintenance/*`: creator-managed correction surfaces.
- `GET /api/admin/registry-ledger`: secret-free public integrity ledger.
- `POST /api/admin/registry-ledger`: sync that ledger to Google Drive.
- `GET /api/admin/registry-recovery-export`: encrypted full private archive.
- `POST /api/keeper/bind`: first steward bind or governed later claim.

## Storage model

### D1

D1 is the live registry. Important groups include:

- artwork definitions and exact edition structure;
- `keeper_pieces`, permanent identity, encrypted envelope, hashes, backup state,
  current steward, and lifecycle links;
- append-only public lineage and durable piece anchors;
- private acquisition records;
- typed creator history with private, steward, or public visibility;
- append-only maintenance events;
- private claim evidence and ownership-access audits;
- copied-file recovery qualifications;
- only the authentication rows referenced by registry records in private export.

Migration 022 detaches the dormant legacy fulfillment table from commerce
tables. Old source IDs are preserved only as opaque `legacy:` references. They
are not runtime dependencies and are not included as order data.

### R2 plate backups

Every current plate backup is addressed as:

```text
plates/<public-code>/<sha256>.json
```

Conditional creation prevents replacement. An existing object is accepted only
when its bytes exactly match. A verified database state requires status,
reference, and digest to agree. Failed retries retain the last known good
reference and digest instead of erasing recovery evidence.

### Public integrity ledger

`registry-ledger.jsonl` is deterministic, hash-chained, and safe to place in the
configured Drive folder. It contains public identity and encrypted material
needed for integrity comparison, but omits steward identity, email, IP,
location, private acquisition data, private creator history, administrator
identity, claim evidence, and full authentication state.

Commands:

```bash
npm run ledger -- verify ./registry-ledger.jsonl
npm run ledger -- diff ./older.jsonl ./newer.jsonl
```

It is not a full recovery archive and has no restore command.

### Encrypted private recovery archive

The step-up-gated private export contains the complete registry boundary,
counts, and per-table digests. It is encrypted with
`REGISTRY_RECOVERY_EXPORT_KEY`, versioned by
`REGISTRY_RECOVERY_EXPORT_KEY_ID`, excluded from Drive sync, and restored only
through an authenticated offline conversion:

```bash
npm run ledger -- restore-sql ./registry-private-recovery-<timestamp>.json \
  ./registry-private-recovery.key ./registry-private-restore.sql
```

The generated SQL is mode 0600, refuses overwrite, requires a fully migrated
empty target, performs one transaction, and aborts without partial recovery if
any count, digest, row, dependency, or insertion fails. Never apply recovery SQL
to production or a populated database.

## Permanence rules

- Issuance is idempotent. A lost response is retried unchanged.
- Public codes and Ownership Codes are unique permanent identity records.
- Plaintext Ownership Codes are not stored in D1, R2, public ledger, private
  acquisition records, public URLs, or routine audit output.
- Active codes are not deleted or reused.
- A generated bad plate is voided with a physical disposition.
- An active bad plate is superseded by a new generated identity.
- **Correct link** is allowed only when the physical engraving is already
  truthful. It invalidates backup and recovery proof until both are renewed.
- Wrong engraving is never made "correct" by changing its artwork link.
- A first steward bind requires active metal, verified immutable backup, current
  copied-file proof, exact Ownership Code, and verified email.
- Once claimed, the Ownership Code never acts as a bearer override. Later claims
  enter a governed review process.
- Acquisition amount and private notes never enter public lineage or QR output.
- Maintenance actions require a reason, expected version, idempotency key, and
  append-only event.
- A lost maintenance response freezes editing and navigation until the exact
  unchanged request is retried or its outcome is resolved.

## Recovery dependency rules

A copied-file qualification becomes stale when any of these changes:

- backup schema version;
- deployment commit or deliberately versioned recovery build;
- Ownership Code key version;
- plate generator version;
- recovery verifier version;
- backup object reference;
- backup SHA-256 digest.

The default source version is `registry-recovery-build-v1`. Bump it whenever
recovery behavior changes if `REGISTRY_BUILD_VERSION` or
`CF_PAGES_COMMIT_SHA` is not provided at runtime.

Activation and first steward binding fail closed on missing or stale proof. An
active plate changed through a truthful digital link repair becomes selectable
in the wizard at **Prove recovery**, then must repeat physical checks.

## Admin maintenance authority

The administrator can:

- create, correct, or remove the current view of a private acquisition;
- record exact amount in integer minor units, paired with uppercase currency;
- record acquired date, acquisition type, internal reference, private notes,
  and a document reference;
- create, correct, or remove the current view of creator history while retaining
  its append-only maintenance history;
- reset, assign, or transfer stewardship to exactly one verified account;
- correct a digital link only after confirming the engraving is truthful;
- void a generated wrong plate;
- supersede an active wrong plate and issue a replacement.

"Admin can fix everything" means digital state has a governed repair path. It
does not mean deleting history, rewriting public lineage, reusing an engraved
code, exposing private data, or relabeling wrong metal.

## Operational ownership

The application enforces identity, privacy, backup, recovery, version, and
idempotency rules. Adrian still controls the steps that software cannot perform:

- key escrow in separate institutions or accounts;
- independent storage of archives and their keys;
- physical artwork and edition confirmation;
- vendor instructions and file transfer;
- material and QR qualification;
- actual attachment and underside access;
- physical destruction, marking, or quarantine of void plates;
- deliberate production migration and public launch;
- periodic clean recovery rehearsals.

## Verification map

The principal coverage lives in:

- `tests/living-legacy.test.ts`, plate generation, QR, encryption, backup,
  activation, and steward bind;
- `tests/artwork-package-recovery.test.ts`, copied-file recovery and package
  reconstruction;
- `tests/registry-maintenance.test.ts`, private records and governed repairs;
- `tests/admin-maintenance-ui.test.ts`, exact retry behavior;
- `tests/registry-ledger.test.ts`, public ledger integrity;
- `tests/registry-recovery.test.ts`, encrypted full export and clean restore;
- `tests/admin-plate-wizard.test.ts`, guided fail-closed stage logic;
- browser tests for lost responses and the administrator workflow.

Production remains untouched until migrations, secrets, canary recovery,
scratch restore, physical prototype, and final sign-off are deliberately
completed.
