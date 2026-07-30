# Permanent artwork plate runbook

This is the release gate for an Adrian Rasmussen artwork plate. Use the guided
wizard at `/admin/pieces/wizard` for every new plate. The flat desk at
`/admin/pieces` is for inspection and specialist recovery. Use
`/admin/maintenance` when the digital record needs correction.

The front carries a public `AR-XXXXXXXX` QR identity. The underside carries the
private Ownership Code. The QR is look-only. The Ownership Code is never placed
in a URL, public page, public ledger, audit log, or acquisition record.

The registry has no Stripe, checkout, order, or shipment dependency. Adrian
records acquisition details himself, when and if they are known.

## Stop conditions

Do not engrave production metal unless all of these are true:

- the exact artwork and edition structure are confirmed;
- the encrypted R2 backup is content-addressed and verified;
- a separately downloaded copy of that encrypted backup has been re-uploaded
  and successfully used to rebuild both plate hashes;
- the private full-registry recovery archive and its separate key are stored in
  different trusted locations;
- a clean scratch restore of the private archive has passed;
- the front and underside SVG hashes match the private manifest;
- a material prototype has passed the phone, lighting, angle, abrasion, and
  attachment tests below.

Stop issuance and engraving if the database, backup bucket, encryption key,
registry unlock, audit log, copied-file qualification, or full private recovery
archive is unavailable or uncertain.

## One-time production setup

### Ownership Code encryption

Generate a 32-byte key on a trusted computer. Do not place it in chat, source
control, screenshots, tickets, or shell history.

```bash
openssl rand -base64 32
```

Store independent copies in:

1. Cloudflare Pages as `OWNERSHIP_CODE_KEY_V1`;
2. an access-controlled password manager or institutional vault outside the
   Cloudflare account.

Set `OWNERSHIP_CODE_ACTIVE_KEY_VERSION=1`. Never delete an old versioned key
while any registry row uses it. Provision a separate high-entropy
`REGISTRY_STEP_UP_SECRET`. Sensitive registry actions require both an approved
administrator account and a recent registry unlock.

The private admin can be enabled before public launch with:

```text
ARTWORK_REGISTRY_ADMIN_ENABLED=true
```

### Encrypted plate backup

The `ARTWORK_REGISTRY_BACKUP` binding points at the private R2 bucket. Each
object is immutable and content-addressed:

```text
plates/<public-code>/<sha256>.json
```

The object contains encrypted code material and identity context, never the
plaintext Ownership Code or an encryption key. A database row is considered
backed up only when its status, object reference, and SHA-256 digest agree.

### Private full-registry recovery

Configure a second, independently escrowed 32-byte key:

- `REGISTRY_RECOVERY_EXPORT_KEY_ID`, a non-secret version label;
- `REGISTRY_RECOVERY_EXPORT_KEY`, the base64 form of exactly 32 random bytes.

This key protects the full private recovery archive. It should not be the
Ownership Code encryption key. Keep its offline key file separately from the
archive. See `docs/registry-private-recovery.md` for the exact two-line key-file
format and clean-only restore command.

### Migrations and pre-change backup

Before applying migrations, export the current D1 database to an encrypted
storage location outside the repository. Test migrations locally, then apply
them deliberately. Migration `022_registry_fulfillment_detachment.sql` removes
the registry's old order-table dependency while retaining any historical source
identifier only as an opaque `legacy:` reference.

A pre-migration D1 export is rollback evidence. It is not the ongoing recovery
method and it does not prove that newly issued plates can be rebuilt.

## First non-production canary

Before any production engraving:

1. Issue one clearly marked non-production identity in the guided wizard.
2. Download its front SVG, underside SVG, and private manifest.
3. Confirm its R2 backup is **Verified**.
4. Download the encrypted recovery JSON from the wizard.
5. Move that file outside the website workspace, then choose that downloaded
   file in the wizard and run **Verify copied recovery file**.
6. Require the persisted recovery status to show **Current**. The server checks
   the copied bytes' digest, identity, key version, Ownership Code verifier, and
   regenerated front and underside hashes. It returns no code or SVG content.
7. Download a private full-registry recovery archive and store its separate key
   elsewhere.
8. Generate restore SQL from those copied artifacts and apply it only to a new,
   fully migrated, empty scratch database.
9. Verify table counts and digests, the canary identity, lineage chain, current
   steward state if any, and the public QR result in the scratch environment.
10. Confirm a second restore or a restore into any non-empty registry is refused.

The public Drive ledger is useful for secret-free integrity comparison, but it
cannot restore private acquisition data, steward bindings, encrypted Ownership
Codes, claim evidence, administrator references, or recovery qualifications.

## Issue one permanent identity

1. Open `/admin/pieces/wizard` and unlock the private registry.
2. Select the exact artwork.
3. Confirm whether it is unique or numbered. Unique work uses edition `0` in
   storage. Numbered work uses its real edition number and exact edition size.
4. Read the artwork ID, edition, title, and intended physical piece aloud before
   pressing **Issue**.
5. Issue once. If the response is lost, retry the unchanged attempt. The same
   issuance key returns the same identity and never creates a second plate.
6. Download the front SVG, underside SVG, and private manifest together.
7. Archive the package before leaving the screen. The one-time Ownership Code
   must not be copied into ordinary notes or messages.
8. Compare public code, artwork ID, edition, generation time, filenames, and
   both SHA-256 hashes across the screen, manifest, and files.
9. Confirm the encrypted online backup is **Verified**.
10. Download its encrypted recovery JSON, archive it outside the site, re-upload
    that downloaded copy, and require recovery status **Current**.

Do not send files to the engraver until steps 1 to 10 pass.

## Material prototype qualification

The front and underside are opposite faces of one 50 mm by 62 mm plate. Import
both SVGs at native dimensions without cropping, stretching, redrawing the QR,
or scaling the faces independently.

Test the engraved front QR with at least one current iPhone and one current
Android phone:

- bright direct light;
- ordinary indoor light;
- dim light;
- straight-on;
- approximately 30 degrees off-axis;
- before attachment;
- after attachment in the final location;
- after the representative abrasion and cleaning test.

Every scan must open the exact Adrian domain and the correct artwork identity.
A QR that works only from an SVG, paper print, or a single phone does not pass.

Also verify:

- public code on metal equals the manifest;
- artwork ID and edition on metal equal the physical artwork;
- underside Ownership Code equals the manifest character for character;
- quiet zone is intact and clear of fasteners, texture, adhesive, and edges;
- attachment cannot rotate, obscure, or detach in ordinary handling;
- underside remains readable through the intended access method;
- finish and legibility survive representative handling and cleaning.

## Activate only the real metal

Activation is not approval of a vendor proof. With the final plate attached to
the intended artwork:

1. scan the real metal QR;
2. compare artwork, edition, and public code;
3. compare the underside Ownership Code;
4. inspect attachment and abrasion results;
5. paste both hashes from the archived private manifest;
6. submit activation in the wizard.

The server requires the immutable backup and copied-file recovery qualification
to still be current. If code, generator, key, backup, or build dependencies
changed after qualification, activation stops and returns to recovery. The
versioned fallback `registry-recovery-build-v1` must be deliberately bumped
whenever recovery behavior changes if a deployment commit ID is not supplied.

## Creator-entered private records

Use `/admin/maintenance` to record acquisitions and creator history. Acquisition
amount, currency, date, type, internal reference, notes, and document reference
are private. Exact amount is never returned by public registry or QR endpoints.

Creator history can record contributors, places, intentions, materials,
techniques, and notes. Choose visibility explicitly:

- **Private**, administrator only;
- **Steward**, current steward and administrator;
- **Public**, shown on the public artwork record.

Do not put private contact details or an Ownership Code in public or steward
history. If a save loses its response, do not edit, cancel, search, or navigate.
Use the offered unchanged retry so the same idempotency key resolves to exactly
one outcome.

## Admin maintenance and physical truth

The administrator can repair digital state, but cannot make incorrect metal
truthful by changing a database link.

### Digital link is wrong, metal is correct

Use **Correct link** only after physically reading the plate and confirming that
the engraving already matches the intended artwork and edition. The operation
regenerates the encrypted identity context and hashes, clears old backup proof,
and records an append-only maintenance event. Then:

1. retry encrypted backup;
2. download and verify a new copied recovery file;
3. repeat the physical activation checks, even if the plate was already active;
4. only then allow first steward binding.

### Metal is wrong

Never relink wrong metal.

- If the identity is generated but not active, void it and record the physical
  disposition. Destroy, permanently mark, or quarantine the bad plate.
- If the identity is active, use **Replace plate**. This supersedes the old
  public identity and creates one new generated identity.
- Archive the replacement package before clearing the one-time screen.
- Fabricate, recover, qualify, and activate the replacement from the beginning.

The old record remains as history. Do not delete or recycle an engraved public
code or Ownership Code.

### Steward record is wrong

Admin maintenance can reset an incorrect steward, transfer to exactly one
verified account, or assign a verified account. Each action requires a reason,
version check, registry unlock, and append-only event. A collector entering an
already-used Ownership Code cannot silently replace the current steward.

## Public launch and ongoing checks

Keep public registry exposure off until the canary restore, copied-file recovery,
real-metal phone tests, and physical activation all pass. After deliberate
review, set `LAUNCH_FLAGS.livingLegacy` to `true`, deploy, then scan the same
physical QR again and confirm the public page derives its
artwork and edition from the server-side public code record.

Monthly:

- verify the public secret-free ledger chain and compare it with the live view;
- download a fresh encrypted private registry archive;
- confirm the archive and key remain in separate accessible locations;
- review failed backups, stale recovery qualifications, ambiguous maintenance
  attempts, unlock events, reveal/package events, and plate replacements.

Quarterly, and after any relevant schema, key, generator, verifier, or recovery
code change, repeat a clean scratch restore and copied-file plate recovery.

## Final pre-engraving sign-off

- [ ] Exact physical artwork, artwork ID, uniqueness or edition size confirmed
- [ ] Exact edition number confirmed
- [ ] Public code read back from screen, manifest, and front SVG
- [ ] Ownership Code archived privately and matched to underside SVG
- [ ] Front and underside SHA-256 hashes match the manifest
- [ ] Content-addressed R2 backup verified
- [ ] Downloaded recovery JSON independently archived and re-uploaded
- [ ] Copied-file recovery status current
- [ ] Encrypted full-registry archive stored
- [ ] Separate full-registry recovery key stored elsewhere
- [ ] Clean scratch restore passed with counts, digests, lineage, and QR checks
- [ ] Real engraved prototype passed both phones, lighting, angle, and abrasion
- [ ] Attachment and underside access passed
- [ ] No Stripe, order, or shipment assumption is involved
- [ ] A second person has read the permanent identity fields where practical

If any box is uncertain, stop. Digital records can be repaired later. Engraved
metal cannot.
