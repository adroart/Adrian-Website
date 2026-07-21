# Artwork Registry: First Plate and Shipment Runbook

This is the release gate for an Adrian Rasmussen artwork plate. A plate is not
ready because an SVG exists. It is ready only after the registry is backed up,
the fabricated metal has been checked against the stored identity, the real QR
has scanned successfully, the exact sale or handoff has been assigned, and the
final packed piece has been scanned again.

The permanent public identity is `AR-XXXXXXXX`. The permanent private credential
is the **Ownership Code** etched on the underside. The QR never contains the
Ownership Code. Possessing the Ownership Code can begin a claim, but it cannot
silently replace a registered steward.

## Current release boundary

This release supports issuance, encrypted recovery, encrypted online backup,
physical activation, exact paid-sale or manual-handoff assignment, shipment
locking, QR lookup, and first steward binding.

It does **not** switch on the public shop, automate ordinary transfers or the
30-day claim process, add annual inscriptions, migrate the Mandala map, or set
up museum succession. Those are separate releases.

Do not deploy this registry or fabricate a production plate until all items in
"Production infrastructure" and "Prototype qualification" are complete.

## Production infrastructure

### 1. Generate the encryption key once

On a trusted computer, create a 32-byte key and keep the terminal output out of
screenshots, tickets, chat, shell history, and repository files:

```bash
openssl rand -base64 32
```

Store the value in two places:

1. Cloudflare Pages as `OWNERSHIP_CODE_KEY_V1`.
2. A separate, access-controlled online password manager or institutional
   vault entry, together with the key version and recovery instructions.

The second copy must not be in D1, R2, the repository, `.env.production`, or the
same Cloudflare account alone. Anyone entrusted with the key can recover codes,
so access should be logged and limited. Never delete an old versioned key while
any row still uses it.

Configure Pages without putting the value on a command line:

```bash
npx wrangler pages secret put OWNERSHIP_CODE_KEY_V1 --project-name adrian-website
```

Set the non-secret active version in the Cloudflare Pages production variables:

```text
OWNERSHIP_CODE_ACTIVE_KEY_VERSION=1
```

Provision a separate, high-entropy `REGISTRY_STEP_UP_SECRET`. The reveal,
recovery verification, backup retry, activation, packaging, and issuance routes
require it in addition to a verified allowlisted administrator account.

`UPLOAD_SECRET` is accepted for registry unlock only while
`REGISTRY_STEP_UP_SECRET` is absent. Provision the new variable before retiring
the old upload credential. As soon as the new variable exists, even if it is
empty, the registry fails closed and never falls back to `UPLOAD_SECRET`.

Keep the public `LAUNCH_FLAGS.livingLegacy` flag off during staging. Set this
non-secret Cloudflare Pages production variable instead:

```text
ARTWORK_REGISTRY_ADMIN_ENABLED=true
```

That runtime gate enables only the authenticated private plate desk and its
admin API. It does not expose the public steward, claim, map, or lineage UI. This
separate gate is what makes it possible to issue and prove a canary before the
public launch flag is changed.

### 2. Provision the encrypted backup bucket

The binding is already declared as `ARTWORK_REGISTRY_BACKUP` in `wrangler.toml`.
Create its production bucket once:

```bash
npx wrangler r2 bucket create adrian-artwork-registry-backup
```

R2 receives ciphertext, nonce, key version, and non-secret identity metadata.
It must never receive a plaintext Ownership Code or encryption key.

### 3. Subscribe Stripe order-state events

The shipment gate relies on the local order status being current. In the Stripe
Dashboard, configure the existing signed webhook endpoint to receive:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `charge.refunded` (including partial refunds);
- `charge.dispute.created`;
- `payment_intent.canceled`;
- `payment_intent.payment_failed`.

Confirm `STRIPE_WEBHOOK_SECRET` and `STRIPE_SECRET_KEY` are provisioned. Send a
test event for each reversal path and confirm the order leaves `paid`. A Stripe
assignment cannot be marked shipped unless its order is still `paid` at the
exact shipment write.

### 4. Export D1 before migration

Create a dated export outside the repository and verify that it is non-empty:

```bash
mkdir -p "$HOME/secure-backups/adrian-registry"
npx wrangler d1 export adrian-website --remote \
  --output "$HOME/secure-backups/adrian-registry/adrian-website-before-registry.sql"
```

Keep the export encrypted at rest. It contains account and commerce data and is
not a source-control artifact.

This pre-migration export is rollback evidence only. It does not contain a
registry canary and cannot prove that a plate can be recovered.

### 5. Apply migrations

First apply all migrations to a local disposable D1 and run the application
tests. Then apply to production:

```bash
npx wrangler d1 migrations apply adrian-website --local
npm run test:unit
npm run typecheck
npm run build
npx wrangler d1 migrations apply adrian-website --remote
```

Cloudflare captures a backup when migrations are applied. Keep the explicit SQL
export as the independently controlled copy.

There is no casual "down migration" for issued identities. If a migration fails,
stop issuance and deployment. For a data-loss incident, restore the pre-change
export to a newly created recovery database, validate it, then deliberately
switch the binding. Do not overwrite the live database or delete issued rows as
an improvised rollback. Once a plate is active, its public code and Ownership
Code are permanent records.

### 6. Issue a canary and create a post-issuance recovery set

After migrations, secrets, and R2 are configured, issue one clearly labeled
non-production canary plate through the admin desk. Confirm its encrypted R2
backup is verified, then create a new D1 export:

```bash
npx wrangler d1 export adrian-website --remote \
  --output "$HOME/secure-backups/adrian-registry/adrian-website-with-registry-canary.sql"
```

The recovery set is all three of the following:

1. the **post-issuance** D1 export containing the full registry row and event
   history;
2. the matching R2 encrypted envelope;
3. the separately escrowed versioned encryption key.

R2 is defense in depth for encrypted Ownership Codes. It is not a standalone
database backup: it deliberately omits steward accounts, private claim evidence,
fulfillment state, and lineage history.

### 7. Prove restoration and decryption before engraving

Use a disposable local or Cloudflare scratch environment, never production.
This drill must use copies of the independently held recovery artifacts; pointing
the scratch runtime back at the production D1 or production R2 bucket does not
prove recovery.

1. Restore the **post-issuance D1 export**
   `adrian-website-with-registry-canary.sql` into a new scratch database.
2. Copy the canary's R2 object from its recorded `backup_reference` into a new
   scratch R2 bucket at the identical object key. Use the copied R2 object, not
   a new backup generated from the restored D1 row.
3. Bind the scratch runtime only to that scratch database and scratch bucket.
   Temporarily remove or rename the D1 ciphertext and nonce columns in the
   scratch copy if you want independent operator evidence that the operation
   cannot use them; the recovery endpoint does not select either column.
4. Configure the scratch environment with the **escrowed versioned key**, not a
   value copied from the live Pages environment. Keep the public launch flag
   off and explicitly enable only the private scratch administration runtime:

   ```text
   ARTWORK_REGISTRY_ADMIN_ENABLED=true
   ```

5. Start the full Pages runtime, sign in as an admin, enter the step-up secret,
   and click **Verify R2 recovery** for the non-production canary.
6. Require a pass showing the exact public code, artwork ID, edition, R2
   reference, key version, and both matching SVG hashes. The operation reads the
   encrypted envelope from R2, decrypts only in memory, verifies the D1 code
   commitment, regenerates both fabrication files, and returns no Ownership Code
   or SVG content.
7. Confirm the public QR resolves without revealing the Ownership Code.
8. Record only the date, tester, public code, key version, hash result, and
   pass/fail outcome. The operation does not create plaintext output to retain.

Do not engrave if the D1 export, R2 envelope, and escrowed key have not been
proven together in this canary.

After the canary passes, keep `LAUNCH_FLAGS.livingLegacy` set to `false` and
continue to fabrication and prototype qualification. The permanent QR resolver
remains available for physical prelaunch scans, while public lineage history,
steward claims, and Living Legacy UI remain invisible.

## Issue a plate

1. Open the admin artwork registry.
2. Select the exact artwork and edition. Edition `0` means a unique/non-numbered
   piece; numbered editions use their real number.
3. Issue once. A retry with the same issuance key must return the same identity,
   never mint a replacement.
4. Confirm the backup status is **Verified**.
5. Download and archive together:
   - front QR SVG;
   - underside Ownership Code SVG;
   - private manifest.
6. Compare the displayed artwork ID, edition, public code, filenames, and both
   SHA-256 hashes with the manifest before sending files to the engraver.
7. Keep the manifest private. It contains the Ownership Code and is not a
   certificate for the buyer.
8. After issuance and before engraving, create a fresh encrypted D1 export. A
   pre-issuance export plus R2 is not sufficient to reconstruct the registry.

If backup fails, use **Retry encrypted backup**. Do not activate, assign, or ship
the plate while the backup is unverified.

## Prototype qualification

Qualify the real material, size, finish, engraving depth, and attachment method
before using the design on a sale.

Fabricate the front and underside as opposite faces of one **50 mm × 62 mm**
plate. Import both SVGs at their native dimensions without cropping, stretching,
or independently scaling either face.

Test the front QR on at least one current iPhone and one current Android phone:

- bright direct light;
- normal indoor light;
- dim light;
- straight-on;
- approximately 30 degrees off-axis;
- before attachment and after attachment to the artwork.

Every scan must open the exact Adrian URL and show the same public code,
artwork, and edition. A QR that scans only from a saved SVG or paper proof does
not qualify the engraved plate.

Then inspect and compare:

- public code on metal equals the manifest;
- artwork ID and edition on metal equal the physical artwork;
- underside Ownership Code equals the manifest character for character;
- front and underside production files hash to the stored values;
- QR quiet zone is intact and not crossed by a screw, frame, adhesive, texture,
  or plate edge;
- attachment cannot rotate, obscure, or detach during ordinary handling;
- underside remains readable after the intended flip/removal action;
- finish survives a representative abrasion/cleaning test.

Only after all checks pass, enter the admin step-up secret, tick every physical
confirmation, submit the stored hashes, and activate. Activation is the moment
the two permanent codes are locked. Never activate from a vendor proof.

### Public registry launch

Flip the public flag only after all three gates have passed: the copied-artifact
R2 recovery canary, the real engraved-metal phone tests above, and physical
activation of that qualified plate. Then set `LAUNCH_FLAGS.livingLegacy` to `true`,
build, and deploy deliberately. Verify that the same physical QR now
shows the exact public lineage before using the system for a sale.

The public flag remains `false` in source until this point so an unrelated
deployment cannot expose a partially qualified registry. After the public
deployment is verified, `ARTWORK_REGISTRY_ADMIN_ENABLED` may be removed because
the public flag also keeps private administration available.

## Assign the exact sale or handoff

Assignment happens during packing, not at checkout.

For a Stripe sale:

1. Confirm the order is **Paid**.
2. Select its single unassigned order item.
3. Select the active, backed-up plate for the same artwork.
4. Assign and compare the resulting public code with the physical plate.

For a manual sale or gift:

1. Create an opaque internal reference, such as an invoice or consignment ID.
2. Do not put a name, email, phone number, address, or dedication in the
   reference.
3. Select the exact active, backed-up plate and assign it.

A correction requires a written reason and is permitted only before shipment.
After shipment, the assignment is immutable; resolve mistakes as an incident,
not by rewriting lineage.

## Final packing and shipment gate

Two people should perform the first production shipment if possible: one reads
the system record and the other holds the physical piece.

- [ ] Artwork title and artwork ID match the order/manual record.
- [ ] Edition on artwork, plate, manifest, and assignment all match.
- [ ] Public code on metal matches the assigned registry row.
- [ ] Front QR scans from the attached, packed-position plate.
- [ ] Scan opens `adrianrasmussen.com` and the correct artwork history.
- [ ] Ownership Code is present and legible on the underside.
- [ ] Plate status is **Active**.
- [ ] Backup status is **Verified**.
- [ ] Recipient/shipping label belongs to this order; do not copy it into the
      public registry.
- [ ] Attachment and protective packing do not obscure or damage the plate.
- [ ] Assignment was corrected, if necessary, before this point with a reason.
- [ ] Package is sealed and the assignment is now marked **Shipped**.

Do not mark shipped before the final physical comparison. Once marked shipped,
the artwork/plate/order relationship cannot be corrected through the normal UI.

## Recipient claim

The recipient signs in with a verified email, scans the public QR, and enters
the permanent Ownership Code from the underside. A never-claimed piece binds to
that account and stamps the fulfillment as claimed. A rescan by the same steward
is idempotent.

Email-code and supported social sign-in establish email verification. A
password account that has not verified its email cannot claim; sign out and use
the emailed one-time code before retrying.

After any steward has ever claimed the piece, the permanent code never becomes a
bearer override again. A different account is routed into the governed claim
process; it cannot silently take control.

Code-valid first and contested claim attempts create a private evidence record
containing the verified account identity, email, request IP when Cloudflare
provides it, user agent, outcome, and time. This evidence is never public and is
read only through the admin step-up endpoint in bounded pages. Do not copy it
into certificates, public lineage payloads, support tickets, or ordinary logs.

## Incident rules

- **Lost fabrication package before activation:** use **Recover full fabrication
  package**; never mint a second code for the same artwork/edition.
- **Wrong engraving before activation:** destroy or permanently deface the bad
  plate, fabricate from the same package, re-run every check, then activate.
- **Wrong engraving after activation:** stop shipment and treat as an identity
  incident. Do not edit codes or delete the row.
- **Wrong sale assignment before shipment:** correct it in the fulfillment desk
  with a specific reason and repeat the packing checklist.
- **Wrong sale assignment after shipment:** do not rewrite the record; document
  the incident and resolve custody through the governed process.
- **Backup or key unavailable:** stop issuance, reveal, activation, and shipment
  until a scratch restore/decrypt canary passes.
- **Suspected code exposure:** record which public identity was affected and
  monitor claims. Do not rotate the permanent physical code behind the plate.

## Offline ledger (the master copy)

The registry is governed as **offline-master, online-mirror**: the canonical
record is a file you hold, and the online D1 database is a convenience mirror
that serves live QR lookups and can be rebuilt from the file at any time. Nothing
in this record is stored with any AI assistant or third party; it is produced by
your own Cloudflare account and saved to storage you control.

The ledger is `registry-ledger.jsonl` — a deterministic, hash-chained export of
every issued plate identity and its append-only lineage. It carries the
recovery-code **hash** and the **encrypted** Ownership Code envelope, never a
plaintext code, and no steward identity, email, IP, or display location. It is an
artist's issuance record, not a personal-data export; the private encrypted D1
export above remains the complementary full-state backup.

### Download it

Unlock the private registry, then use **Download offline ledger** on the plate
desk (`/admin/pieces`) or at the end of the guided wizard
(`/admin/pieces/wizard`). Store each export with your recovery set (the escrowed
key and the R2 envelopes). Keep every export; a newer one only ever adds lines.

### Work with it offline (no server, no network)

```bash
# Confirm the file is intact and unaltered (recomputes the whole hash chain).
npm run ledger verify ./registry-ledger.jsonl

# Prove the online mirror still matches your held master. Silence = identical.
# "Removed" or "changed" lines mean the online copy was altered out of band.
npm run ledger diff ./held-master.jsonl ./fresh-export.jsonl

# Rebuild the online registry rows from the master file. Idempotent; no plaintext.
npm run ledger to-sql ./registry-ledger.jsonl ./rebuild.sql
npx wrangler d1 execute adrian-website --remote --file ./rebuild.sql
```

`to-sql` restores `keeper_pieces` and `artwork_lineage_events` from the
recovery-code hash and encrypted envelope exactly as the live mint stored them,
which is why the online copy is disposable: losing it costs nothing as long as
you hold an intact ledger and the escrowed key. The plaintext Ownership Code
still lives only on the physical art and in your private per-piece manifests.

## Routine custody checks

Before every new batch, and at least quarterly while pieces are circulating:

1. Export D1 to encrypted storage.
2. Confirm new issued plates have verified R2 objects.
3. Run one scratch restore/decrypt canary with the current and oldest retained
   key versions.
4. Review reveal, activation, fulfillment correction, and shipment audit events.
5. Confirm the Adrian domain, Cloudflare project, D1 database, R2 bucket, and
   password-manager escrow remain under the intended registry custodian's control.
