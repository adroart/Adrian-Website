# Registry production activation checklist

This checklist covers the actions that require Adrian's production accounts,
physical prototype, or independent key custody. Completing code does not
complete these steps. Do not engrave a production plate until every required
item is checked.

## 1. Production secrets and bindings

- [ ] `OWNERSHIP_CODE_KEY_V1` contains one base64-encoded 32-byte key.
- [ ] The same versioned key is escrowed outside Cloudflare.
- [ ] `OWNERSHIP_CODE_ACTIVE_KEY_VERSION=1` is configured.
- [ ] `REGISTRY_STEP_UP_SECRET` is separate, high entropy, and escrowed.
- [ ] `ARTWORK_REGISTRY_BACKUP` points at the intended private R2 bucket.
- [ ] `REGISTRY_RECOVERY_EXPORT_KEY` contains a different base64 32-byte key.
- [ ] `REGISTRY_RECOVERY_EXPORT_KEY_ID` is a stable non-secret version label.
- [ ] The recovery export key is stored outside Cloudflare and separately from
  the encrypted private archives.
- [ ] `REGISTRY_BUILD_VERSION` or `CF_PAGES_COMMIT_SHA` identifies deployments,
  or the source constant `registry-recovery-build-v1` has been deliberately
  reviewed and will be bumped with recovery behavior changes.
- [ ] `ARTWORK_REGISTRY_ADMIN_ENABLED=true` is set if private administration is
  needed before the public Living Legacy launch.

No Stripe, webhook, price, checkout, order, or payment variable is required by
the artwork registry.

## 2. Database preparation

- [ ] A dated encrypted pre-migration D1 export exists outside the repository.
- [ ] All migrations through `022_registry_fulfillment_detachment.sql` pass on a
  disposable local database.
- [ ] Migration 022 has been applied to production before private export.
- [ ] Old dormant fulfillment source IDs, if any, are now opaque `legacy:`
  references without order-table foreign keys.
- [ ] Focused registry tests, complete unit tests, typecheck, and production
  build pass against the exact code to deploy.

## 3. Administrator recovery

Registry data recovery and administrator account recovery are separate.

- [ ] At least two intentionally controlled administrator accounts exist if the
  authentication system supports this policy.
- [ ] Each account can complete verified sign-in without relying on the registry
  recovery archive.
- [ ] The allowlist or role configuration is documented outside the repository.
- [ ] The process for rotating or recovering `REGISTRY_STEP_UP_SECRET` is stored
  with the operations record.
- [ ] Losing one device, email session, or password-manager login does not lose
  all administrator access.

Never put session tokens, passwords, unlock secrets, or private keys in a
registry archive or maintenance note.

## 4. Non-production canary identity

- [ ] A clearly marked non-production artwork identity has been issued through
  `/admin/pieces/wizard`.
- [ ] Exact artwork ID and unique or numbered edition intent were confirmed.
- [ ] The issuance response was archived before leaving the one-time screen.
- [ ] Front SVG, underside SVG, and private manifest are stored together.
- [ ] Both file hashes match the manifest.
- [ ] Encrypted online backup shows **Verified**.
- [ ] The object reference is content-addressed as
  `plates/<public-code>/<sha256>.json`.
- [ ] The encrypted recovery JSON was downloaded and moved outside the website.
- [ ] That downloaded copy was selected in the wizard and passed
  **Verify copied recovery file**.
- [ ] The persisted qualification status shows **Current**.
- [ ] The canary's public QR resolves to the exact server-derived artwork and
  edition without revealing the Ownership Code.

## 5. Full private recovery rehearsal

- [ ] A fresh encrypted archive was downloaded from
  `/api/admin/registry-recovery-export` after sign-in and registry unlock.
- [ ] The archive and its two-line key file are in separate trusted locations.
- [ ] Archive media and key media were copied, not read from the live runtime.
- [ ] `npm run ledger -- restore-sql` authenticated and validated the copied
  archive before producing SQL.
- [ ] The generated SQL file had mode 0600 and did not overwrite an existing file.
- [ ] A new scratch D1 database received all migrations before restore.
- [ ] Every registry and referenced authentication table was empty before restore.
- [ ] Restore completed as one transaction.
- [ ] Per-table counts and SHA-256 digests match the archive manifest.
- [ ] Canary identity, encrypted envelope, backup digest, recovery qualification,
  maintenance history, lineage chain, and steward state were recovered.
- [ ] The scratch public QR resolved correctly.
- [ ] A second restore was refused.
- [ ] A restore into a deliberately non-empty scratch registry was refused.
- [ ] A deliberately damaged archive was refused before SQL was generated.

The Google Drive ledger is a public-safe integrity mirror. It is not accepted as
a substitute for this encrypted private recovery rehearsal.

## 6. Physical prototype

- [ ] Plate is exactly 50 mm by 62 mm, unless the vector specification is later
  intentionally changed and all hashes and qualification are repeated.
- [ ] Front and underside SVGs were imported at native dimensions.
- [ ] QR quiet zone is clear.
- [ ] Public code is readable by eye.
- [ ] Underside Ownership Code is readable character for character.
- [ ] Attached plate cannot rotate, detach, or become obscured in normal use.
- [ ] Intended underside access works without damaging the art.
- [ ] Representative cleaning and abrasion do not defeat legibility.
- [ ] Current iPhone passes bright, indoor, dim, straight, angled, unattached,
  attached, and post-abrasion scans.
- [ ] Current Android passes the same scans.
- [ ] Every scan opens the exact Adrian domain and correct identity.

## 7. First production plate

- [ ] A second person cross-checks the artwork, edition, public code, Ownership
  Code, filenames, and both hashes where practical.
- [ ] Fabrication package is archived before vendor transfer.
- [ ] Vendor receives only the required fabrication files through an approved
  private channel.
- [ ] Recovery status is still **Current** immediately before engraving.
- [ ] The real returned metal matches the manifest and the intended art.
- [ ] Physical activation checks are completed against the real attached plate.
- [ ] Activation succeeds without a backup, hash, audit, version, or recovery
  warning.
- [ ] The physical QR is scanned again after activation.

## 8. Maintenance rehearsal

Use a non-production identity.

- [ ] Create and correct a private acquisition with an amount, currency, date,
  internal reference, notes, and document reference.
- [ ] Confirm exact amount is absent from public API, QR, lineage, and ledger.
- [ ] Create private, steward, and public creator-history examples.
- [ ] Confirm each visibility boundary with the appropriate account.
- [ ] Simulate a lost maintenance response and use only the unchanged retry.
- [ ] Reset or transfer a test steward and confirm append-only history.
- [ ] Correct a deliberately wrong digital link only after confirming test metal
  is truthful.
- [ ] Confirm backup and recovery proof become stale after that correction.
- [ ] Confirm the active test identity reappears in the wizard at recovery.
- [ ] Re-back up, requalify the copied file, and repeat physical checks.
- [ ] Confirm first steward bind remains blocked until those steps pass.
- [ ] Void a generated bad test plate and record physical disposition.
- [ ] Replace an active bad test plate, archive the one-time replacement package,
  and confirm the old identity is superseded rather than deleted.

## 9. Public launch

- [ ] Public launch remains off until copied-file recovery, full clean restore,
  physical prototype, and first production activation all pass.
- [ ] Launch is a deliberate reviewed change, not a side effect of unrelated work.
- [ ] After launch, the same real QR shows the correct public artwork record.
- [ ] Public responses contain no Ownership Code, exact amount, private notes,
  steward email, IP address, ciphertext, nonce, or administrator identity.

## 10. Ongoing schedule

Monthly:

- [ ] verify and diff the secret-free public ledger;
- [ ] download a fresh encrypted private archive;
- [ ] check failed backups and stale qualifications;
- [ ] review unlock, reveal, package recovery, maintenance, void, and replacement
  audit events;
- [ ] confirm archive and keys remain readable from their separate locations.

Quarterly, and after a migration, key rotation, generator change, verifier
change, or recovery code change:

- [ ] repeat copied-file plate recovery;
- [ ] repeat a clean full-registry scratch restore;
- [ ] scan a representative attached plate on current iPhone and Android devices.

If a check fails, stop new engraving. Use Admin Maintenance for digital repairs.
Void or supersede wrong metal. Never relink an engraving that is physically
wrong.
