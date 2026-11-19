# Private artwork history recovery, 19 November 2026

The existing encrypted registry recovery archive omitted migration 052's `collector_reflections` and `collector_place_milestones`. Its former table parity check could pass even though those private chapters and successor reading choices had not been archived. Keeper rollout remains off and migration 052 remains unapplied in production.

The repair extends the existing archive contract to schema v12. Both living tables, every column including `successor_access`, and the authors' referenced authentication records are included in the encrypted snapshot. They restore after contributor grants, preserving foreign keys and the existing runtime permission checks. Clean-target and completion guards include both tables, so a nonempty target or incomplete import fails instead of merging histories.

Compatibility is explicit. With neither 052 table installed, export still produces the exact v11 manifest and column shape. A partial installation fails closed. Table discovery is rechecked inside the same database batch as the content snapshot, so a schema change cannot produce an apparently complete archive with omitted chapters. Older authenticated formats remain readable and retain their source schema version; upgrading them supplies empty new tables and cannot recover writing an older exporter never captured. Restore continues to require a new database with the complete repository migration set. This does not apply migrations to production.

## Local verification

Run from the candidate worktree:

```sh
node --import tsx --test --experimental-test-module-mocks tests/registry-recovery.test.ts
```

The disposable SQLite rehearsal passes all 49 recovery tests. The new living-record case restores exact rows from an authenticated encrypted export after existing historical ownership transfers. It verifies that:

- The former keeper retains their private entries.
- The current keeper reads only explicitly permitted older milestones and writing; an unrelated account reads neither.
- Successor reading permission does not confer publication or permission-editing rights.
- The former author can revoke access or allow a previously withheld entry after restore.
- Private entries stay outside public history; deliberately public milestones survive.
- Ciphertext does not expose private body text or author identifiers, tampered ciphertext fails authentication, and a second restore is refused.
- Pre-052 export remains v11, decrypts and upgrades with authenticated provenance, and restores into a fully migrated empty target. Partial schema is rejected.

The remaining keeper-launch proof is an isolated deployed staging D1/R2 restore using the real operational backup and key-custody procedure, plus authorized notice delivery and deployed cross-domain account/Atlas verification. Local SQLite proof does not replace that operational rehearsal. No production data, migrations, rollout flags, credentials or outgoing notices were changed for this work.
