# Private Registry Recovery

The public `registry-ledger.jsonl` and the private recovery archive have
different jobs. The public ledger is secret-free and may be copied to Google
Drive. The private archive contains the complete registry, including private
acquisition values, evidence, creator history, stewardship associations and
encrypted Ownership Code envelopes. The private archive is never sent through the ledger's Google Drive sync.
It contains no orders or payment-provider records. Migration `022` preserves
any old fulfillment source identifier only as an opaque `legacy:` reference,
so registry recovery has no commerce-table or Stripe dependency.

## Encryption configuration

The export endpoint requires two separate Pages secrets:

- `REGISTRY_RECOVERY_EXPORT_KEY_ID`, a non-secret version label.
- `REGISTRY_RECOVERY_EXPORT_KEY`, an independently escrowed 32-byte key encoded
  as base64.

Set the key with an interactive secret command. Do not put its value in source
control, documentation, shell history or the same storage location as the
archive. Retain old versioned keys for as long as an archive encrypted by them
must remain recoverable.

The administrator must be signed in and complete the registry step-up before
opening `/api/admin/registry-recovery-export`. The response is a no-store
attachment named `registry-private-recovery-<timestamp>.json`. Its visible
manifest contains only version information, per-table counts and digests. All
rows are AES-GCM encrypted and authenticated.

## Offline key file

The restore tool reads a local key file containing exactly two non-empty lines:

```text
<key id>
<base64 32-byte key>
```

Keep this file permission-restricted and separately escrowed. The tool never
prints its contents.

## Generate clean-only restore SQL

Use only copied recovery artifacts on an offline or controlled recovery
machine:

```bash
npm run ledger -- restore-sql \
  ./registry-private-recovery-<timestamp>.json \
  ./registry-private-recovery.key \
  ./registry-private-restore.sql
```

The command authenticates the complete encrypted archive, checks its schema,
table list, counts and digests, then creates a new mode-0600 SQL file. It refuses
to print private SQL to the terminal and refuses to overwrite an existing file.
The SQL is decrypted private material, so keep it protected and short-lived.
The command does not connect to or select a database.

Apply the SQL only to a new, fully migrated recovery database. Never aim it at production
or an existing scratch database. The SQL starts one transaction,
proves that every registry target table is empty and uses ordinary
conflict-failing inserts. Before commit, it checks the exact expected count for
every restored table and rolls the whole transaction back if any insert failed,
even if the SQL runner continued after that error. A partial database, one pre-existing row, a second
restore, a malformed archive, an unsupported version or a wrong key is refused.

After restoration, compare every target table count to the encrypted archive
manifest and run the separate registry recovery qualification before any
binding change. Do not automatically switch the production binding. A deliberate
binding change happens only after the restored database and copied encrypted
plate artifacts have both been verified.
