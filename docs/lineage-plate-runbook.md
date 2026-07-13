# Artwork Registry: First Plate and Shipment Runbook

This is the release gate for an Adrian Rasmussen artwork plate. A plate is not
ready because an SVG exists. It is ready only after the registry is backed up,
the fabricated metal has been checked against the stored identity, the real QR
has scanned successfully, the exact sale or handoff has been assigned, and the
final packed piece has been scanned again.

The permanent public identity is `AR-XXXXXXXX`. The permanent private credential
is the **Ownership Code** etched on the underside. The QR never contains the
Ownership Code. Possessing the Ownership Code can begin a claim, but it cannot
silently replace a registered keeper.

## Current release boundary

This release supports issuance, encrypted recovery, encrypted online backup,
physical activation, exact paid-sale or manual-handoff assignment, shipment
locking, QR lookup, and first keeper binding.

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

Confirm the existing admin step-up secret is also provisioned as `UPLOAD_SECRET`.
The reveal, backup retry, and activation routes require it in addition to the
admin session.

### 2. Provision the encrypted backup bucket

The binding is already declared as `ARTWORK_REGISTRY_BACKUP` in `wrangler.toml`.
Create its production bucket once:

```bash
npx wrangler r2 bucket create adrian-artwork-registry-backup
```

R2 receives ciphertext, nonce, key version, and non-secret identity metadata.
It must never receive a plaintext Ownership Code or encryption key.

### 3. Export D1 before migration

Create a dated export outside the repository and verify that it is non-empty:

```bash
mkdir -p "$HOME/secure-backups/adrian-registry"
npx wrangler d1 export adrian-website --remote \
  --output "$HOME/secure-backups/adrian-registry/adrian-website-before-registry.sql"
```

Keep the export encrypted at rest. It contains account and commerce data and is
not a source-control artifact.

### 4. Apply migrations

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

### 5. Prove restoration and decryption before engraving

Use a disposable local or Cloudflare scratch database, never production:

1. Restore the exported SQL into the scratch database.
2. Bind a scratch R2 bucket containing one copied encrypted plate envelope.
3. Configure the scratch environment with the escrowed versioned key.
4. Start the full Pages runtime and sign in as an admin.
5. Reveal exactly one non-production canary plate using step-up authentication.
6. Confirm the revealed Ownership Code regenerates the same underside SVG and
   the same stored SHA-256 hash.
7. Confirm the public QR resolves without revealing the Ownership Code.
8. Delete the scratch plaintext output and record only the date, tester, public
   code, key version, hash result, and pass/fail outcome.

Do not engrave if the D1 export, R2 envelope, and escrowed key have not been
proven together in this canary.

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

If backup fails, use **Retry encrypted backup**. Do not activate, assign, or ship
the plate while the backup is unverified.

## Prototype qualification

Qualify the real material, size, finish, engraving depth, and attachment method
before using the design on a sale.

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
that account and stamps the fulfillment as claimed. A rescan by the same keeper
is idempotent.

After any keeper has ever claimed the piece, the permanent code never becomes a
bearer override again. A different account is routed into the governed claim
process; it cannot silently take control.

## Incident rules

- **Lost fabrication package before activation:** use audited admin reveal;
  never mint a second code for the same artwork/edition.
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

## Routine custody checks

Before every new batch, and at least quarterly while pieces are circulating:

1. Export D1 to encrypted storage.
2. Confirm new issued plates have verified R2 objects.
3. Run one scratch restore/decrypt canary with the current and oldest retained
   key versions.
4. Review reveal, activation, fulfillment correction, and shipment audit events.
5. Confirm the Adrian domain, Cloudflare project, D1 database, R2 bucket, and
   password-manager escrow remain under the intended custodian's control.

