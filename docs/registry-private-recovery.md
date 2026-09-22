# Private Registry Recovery

The public `registry-ledger.jsonl` and the private recovery archive have
different jobs. The public ledger is secret-free and may be copied to Google
Drive. The private archive contains the versioned table manifest in
`utils/registryRecoveryArchive.ts`, including private
acquisition values, evidence, creator history, stewardship associations and
encrypted Ownership Code envelopes. The private archive is never sent through the ledger's Google Drive sync.
Schema 10 adds caretaker passing (including terminal state, private declarations and
notification evidence), silence windows/reminders/deliveries, historical-author
publication and permanent shine-removal marks. Restoring those marks prevents
removed writing from resurfacing when a record is regenerated. Schema 11 adds the
explicit `piece_records.legacy_sections` fact, preserving whether a permanent Piece
Record was generated with legacy placeholder sections. Schema 1–10
archives remain decryptable and inspectable, with their authenticated source schema
retained. They cannot supply tables their manifests never included. SQL generation
refuses `recovery_privacy_evidence_unavailable` when an older archive includes any
current or historical public share, publication mutation, or opaque public-record
reference. The refusal occurs before SQL is returned or a destination is changed.
An authenticated export originally captured at schema 10 or later, containing the removal evidence, is the remedy;
when it cannot be recovered, public restoration remains unresolved. A manually
invented empty removal list is not an override. Safe older archives without any
potentially republished content remain restorable.

Upgrading or re-encrypting an older archive preserves its original authenticated
source schema; wrapping schema-9 content in schema 10 or 11 cannot make missing
removal evidence complete. Schema-10 Piece Record rows retain their six-column
format and restore `legacy_sections` as migration 043's default, `0`. Native
schema-11 archives preserve the recorded value, `0` or `1`.

The archive does not include `piece_media`, `artist_messages`, R2 media bytes,
book/poetry/music indexes, invoices or manual payment events, orders, payment-provider
records, operational sessions, or a complete application backup. Registry media
references that are archived still need their exact separately copied R2 bytes;
verified-media restore refuses missing or mismatched copies. The archive key and
versioned Ownership Code keys need separate custody. None of these dependencies
is proved by a local synthetic rehearsal.

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

## Custody keys endpoint

`POST /api/admin/custody-keys` is the one route that hands the registry's
private key material, `REGISTRY_RECOVERY_EXPORT_KEY`, its key id, and every
`OWNERSHIP_CODE_KEY_V<n>` still configured, to an authenticated admin browser.
It exists so the custody envelope described in the Successor's Handbook can be
built from the admin console instead of only from a Terminal script.

**The trust boundary.** The keys travel exactly once, over TLS, to a browser
that has already completed the registry step-up unlock, the same gate every
other secret export in this file sits behind. From there, everything happens
locally: `utils/custodyEnvelope.ts` is isomorphic Web Crypto (PBKDF2, then
AES-GCM), the same code whether it runs in this endpoint's tests, in Node, or
in the browser, so the envelope is built and encrypted on the admin's own
machine. The passphrase that locks the envelope is typed there and never sent
anywhere, including to this endpoint. Nothing about this design changes what
the endpoint returns, key material in the clear, over an authenticated
connection, once, to no-store responses only, which is why every other
requirement in this document (the step-up gate, fail-closed configuration
checks, an audit row for every call) applies to it in full.

**The Terminal script is still the offline path.** `~/builds/adrian-website-custody.sh`
(`/awcustody`) builds an envelope with no website at all, generating fresh
keys rather than reading the live ones, for when Cloudflare or the site itself
is gone. Use the website while it exists; keep the script for when it does
not.

**Why not GET.** A GET request can end up in browser history, a proxy log, or
a prefetch. This endpoint answers POST only and returns 405 naming `POST` in
`Allow` for anything else.

**Audit.** Every call, successful or not reaching the point of returning keys,
is recorded in `registry_maintenance_events` (migration `017`) before the
response is sent, the same append-only shape the shine-removal and
stewardship-transfer maintenance actions use. The single Ownership Code reveal
path (`ownership_code_audit`, migration `010`) was the other candidate, but
that table's `keeper_piece_id` column is required and tied to one piece; a
custody export names no piece, so it uses the table already built to carry a
`NULL` piece for a registry-wide administrative action. The audit row holds
ids, key versions, and timestamps only, never a key value, so a full read of
the audit history reveals nothing that helps decrypt anything.

**Rate limiting and single use.** Neither applies here, on purpose. The
codebase's in-memory rate limiter (`_lib/ratelimit.js`) is used only on
public, unauthenticated endpoints such as inquiries and viewing requests; no
admin-gated route in this codebase rate limits itself, because the registry
step-up unlock already bounds how often a signed-in administrator can reach a
sensitive route without re-entering the step-up secret (a ten minute token, a
one hour absolute cap). Adding a separate limiter here would be inventing a
new pattern rather than following one that exists. The durable record of who
exported keys and when is the audit row, not a usage cap.
