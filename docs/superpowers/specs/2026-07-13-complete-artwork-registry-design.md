# Complete Artwork Registry Design

**Status:** Product principles approved in conversation on 2026-07-13; technical
controls refined through feasibility and security review
**Canonical system:** AdrianRasmussen.com
**Secondary presentation:** MandalaCodes.com

## Purpose

Complete the artwork registry so a physical artwork can receive one permanent
public QR identity and one permanent private Ownership Code, pass a provable
fabrication and recovery process, accumulate a private and selectively public
life story, and transfer between verified stewards without splitting authority
between websites.

The registry must remain usable when Mandala Codes is unavailable. Physical
possession plus the permanent Ownership Code is the ultimate recovery path, but
the code must never silently override an active steward.

## Non-negotiable rules

1. AdrianRasmussen.com is the only writable source of truth for artwork identity,
   steward state, claims, transfers, inscriptions, provenance and recovery state.
2. Mandala Codes consumes a signed projection. It may present, filter and map the
   data but may not adjudicate or write ownership.
3. A plate's public QR and private Ownership Code never change after activation.
4. The Ownership Code never appears in a URL, email, public payload, ordinary
   log, certificate or projection.
5. A current steward may approve a transfer immediately. Explicit denial stops
   automatic transfer. Only complete nonresponse enters the 30-day path.
6. With physical possession and the correct Ownership Code, an unanswered claim
   eventually transfers after 30 days. Email delivery failures are evidence, not
   a permanent orphaning condition.
7. Permanent history is append-only. Public visibility is a reversible
   presentation choice and does not delete or rewrite the private record.
8. A confirmed new steward unlocks the complete artwork-attached private history,
   but not prior stewards' account-security profiles or unrelated personal data.
9. The registry custodian can preserve and restore the registry but cannot
   transfer artwork, resolve claims or rewrite history.
10. Steward is the only product term for the current registered person. Legacy
    implementation identifiers containing `keeper` remain private compatibility
    details and must never appear in customer-facing copy.

## System boundaries

### Canonical registry

Adrian's D1 database stores:

- permanent artwork and plate identity;
- current and historical steward relationships;
- claim and transfer state;
- private technical evidence;
- public append-only lineage events and anchors;
- private provenance records and attachments;
- inscriptions and their draft/sealed state;
- per-record public visibility;
- notification attempts and delivery outcomes;
- recovery drills, physical qualification and readiness state;
- projection and checkpoint state.

All steward-changing mutations occur in a D1 transaction or guarded D1 batch and
append the corresponding lineage event in the same atomic operation.

### Claim scheduler

A companion Cloudflare Worker with a scheduled trigger owns time-dependent work:

- claim warning delivery;
- 30-day silent-claim advancement;
- inscription auto-sealing;
- daily backup and checkpoint creation;
- signed Mandala projection publication;
- delivery retry and dead-letter reporting.

Every state transition is idempotent. The canonical mutation writes notification
and publication intents into a D1 transactional outbox. Delivery is at-least-once
with a stable idempotency key supplied to the provider. The system prevents
duplicate state transitions and minimizes duplicate messages, but does not claim
that an external email provider can guarantee exactly-once delivery.

### Mandala projection

Mandala receives a versioned, signed, privacy-filtered document containing the
public artwork map, public lineage and explicitly public steward/profile content.
Both sites may display all Adrian Rasmussen artworks. Adrian defaults to the
complete collection; Mandala defaults to its Mandala-focused filter.

Projection JSON uses deterministic canonical serialization and carries schema
version, key ID, generated and expiry times, monotonically increasing sequence,
prior-projection hash and content hash. Mandala verifies an Ed25519 signature and
persists its sequence high-water mark before replacing the last verified R2 view.
Key rotation is signed by the prior projection key. Invalid, stale or unavailable
projections leave the last verified view intact.

## Release 1: fabrication-ready identity

### Qualification canary

The admin console offers a dedicated system canary that does not consume a real
artwork or edition. A canary has a permanent public code, encrypted Ownership
Code, R2 envelope and qualification landing page, but can never be assigned,
claimed or transferred as artwork.

The recovery command must:

1. export the post-canary D1 database;
2. copy the canary R2 object into an isolated scratch bucket;
3. restore the export into an isolated scratch D1 database;
4. use the separately escrowed versioned key;
5. recover the R2 envelope without using the D1 ciphertext columns;
6. verify the Ownership Code commitment and authenticated identity fields;
7. regenerate both fabrication faces and match their hashes;
8. answer a production-issued, single-use recovery challenge and emit a signed,
   secret-free recovery report bound to the challenge, expiry, production
   environment, deployment/build hash, schema version, D1 export bookmark and
   checksum, R2 object version/ETag/hash, key version, generator version,
   verification-tool version and both SVG hashes;
9. import that report into production readiness state.

The scratch verifier holds a dedicated attestation key, not a copied production
signing key. Production consumes each challenge once. Artwork issuance remains
blocked until a current report passes. Qualification becomes stale after a schema
migration, plate-generator or QR-payload change, ownership-key rotation,
recovery-verifier change, D1/R2 binding change, vendor-package schema change or
production environment replacement.

Canaries are visibly labeled `REGISTRY QUALIFICATION - NOT AN ARTWORK` and are
excluded from artwork counts, search, sitemap, lineage projection, claims,
fulfillment and maps.

### Artwork issuance

Issuance requires an explicit artwork and explicit integer edition. Edition zero
is allowed only when deliberately selected as unique/non-numbered; a blank field
is invalid. Before mutation the admin sees title, artwork ID, edition, permanence
warning and readiness state, then types a short confirmation value.

Issuance remains idempotent. Retrying one issuance intent returns the same
identity and package. A different intent may not occupy an already issued
artwork/edition.

Before activation, an incorrect or abandoned identity may be marked `void` with
a reason. Its public code and Ownership Code are permanently burned, its audit
history remains, and neither value can be reused. An active identity can never be
voided through the ordinary console.

### Vendor package

Two deliberately separate archives are produced.

The **vendor archive** contains:

- front engraving SVG with outlined lettering;
- underside engraving SVG with outlined lettering;
- a redacted public proof and a controlled private underside proof;
- a secret-free checksum manifest for every vendor-visible asset;
- vendor instructions covering 50 mm by 62 mm native dimensions, face
  orientation, no independent scaling, QR quiet zone, material assumptions and
  which files are private;
- package and fabrication-profile schema versions.

The **owner archive** contains the private manifest, Ownership Code, both exact
hashes, recovery metadata and the vendor-archive checksum. It is never sent as
the vendor handoff bundle.

The QR retains Q error correction, four modules of quiet zone and 1 mm modules.
No production engraving file depends on an installed font. Engraving SVGs use a
documented SVG profile with path-only artwork, millimeter dimensions, explicit
engrave/cut layers, no clipping masks, hidden content or unsupported effects,
minimum feature and safe-margin checks, and no white background object that a
laser tool could interpret as an operation. The same top edge is used on both
faces; the underside is not mirrored and reads upright after the specified flip.

Vendor access to the underside is an exceptional controlled disclosure. Package
creation and download require fresh admin step-up, create an audit record and
show retention/deletion instructions. The browser clears plaintext state after
download or inactivity, while the operator is warned that local Downloads,
browser history and synchronized folders remain their responsibility.

### Prelaunch scan

An issued QR always reaches a server-verified public identity view showing the
public code, artwork and edition. Before full launch it shows no steward, lineage,
claim controls or private data. Query-string values alone are never trusted for
the displayed identity.

### Qualification and shipping

Qualification is bound to a versioned fabrication profile: vendor, material,
thickness, finish, engraving method and depth, attachment method, plate-generator
version and package schema. A material/process/profile change requires a new
qualification. Activation records every observation with timestamp, operator,
device class, condition, result and optional evidence:

- iPhone and Android;
- direct, indoor and dim lighting;
- straight and approximately 30-degree angles;
- before and after attachment;
- correct artwork, edition and public code;
- underside code match and legibility;
- attachment, abrasion and cleaning inspection;
- exact front and underside hashes.

Shipment separately requires a packed-position scan, exact assignment and label
comparison, underside legibility, active plate, verified backup and attachment
inspection. The packed scan uses a short-lived server challenge bound to the
exact plate, fulfillment and packing session. No generic checkbox substitutes
for these observations. The first production plate requires two named operators;
later plates may follow the qualified studio procedure with one operator.

### Sale-channel neutrality

Manual handoff is the universal fulfillment path. Gifts, private sales, invoices,
galleries, inheritance and consignments do not require a payment provider.
Stripe is an optional adapter that may prefill a paid order reference. Stripe
health may block only Stripe-linked fulfillment.

## Release 2: canonical ownership and claims

### Steward onboarding

First registration requires:

- authenticated account;
- verified email;
- non-empty verified full name;
- private birthdate;
- correct physical Ownership Code.

The chart-coherence setting is visibly explained and preselected during steward
onboarding. It can be disabled at onboarding or later. Birthdate and coherence
settings are never public.

### Claim state machine

A claim has one canonical row. At most one steward-changing claim may be active
for an artwork at a time; later valid claimants receive a queue/conflict response
and cannot mature concurrently. States are:

- `pending_keeper` (private legacy compatibility identifier; never customer-facing);
- `approved`;
- `denied`;
- `paused_review`;
- `auto_approved_silence`;
- `canceled`;
- `expired_invalid`.

The claimant supplies the Ownership Code, a self-attested full name backed by a
verified email account, and an optional
explanation. The server verifies the code before creating claim traffic. The
current steward sees the claimant's verified name, email and explanation. Only
the registry administrator can see IP address, user agent and technical evidence.
This privacy boundary supersedes the earlier idea of showing collectors one
another's IP addresses. A code-valid claimant sees the steward's public profile
when enabled and otherwise communicates through a masked email relay; the
steward's private email is not disclosed automatically.

Warnings are scheduled at claim opening, day 10, day 20 and day 27. Delivery and
bounce outcomes are persisted. The steward may:

- approve, causing an immediate atomic transfer;
- deny with a reason, permanently stopping that automatic claim;
- respond or request contact, pausing automation for human resolution;
- remain silent.

At the first successful run of the claim scheduler at or after day 30, a still-silent valid
claim transfers even when the old mailbox hard-bounced. This ensures the
physical artwork cannot be orphaned forever. A provider-wide delivery outage
pauses due claims; an individual dead mailbox does not. Delivery and bounce
status comes from authenticated Resend callbacks, not merely API acceptance.
Any authenticated steward response before the conditional execution prevents the
automatic mutation.

A denial reason is disclosed to the claimant through the relay and starts a
90-day refiling cooldown for the same claimant/artwork pair. A disputed theft
claim remains frozen until steward approval or a documented external legal
resolution. Executing a court or equivalent legal determination requires a
separate legal-resolution role with two independent approvers; neither the
ordinary admin nor registry custodian can act alone.

### Transfer transaction

An approved or silence-resolved transfer atomically:

1. closes the prior steward interval;
2. opens the new steward interval;
3. updates the current steward projection;
4. closes the claim;
5. appends the transfer lineage event and advances its durable anchor;
6. grants the new steward access to the complete private archive;
7. writes notification and projection intents into the transactional outbox.

The permanent Ownership Code remains unchanged. Concurrent approval, denial and
scheduled advancement use conditional writes so exactly one outcome wins.

## Release 3: private provenance and permanent story

### Provenance records

The private archive supports structured records for:

- creation place and date;
- creator and contributing craftspeople, including Balinese carvers, finishers
  and other hands;
- wood species, source, treatment and finish;
- crystals, gemstones, metals and other materials;
- construction methods;
- storage, exhibition, restoration, transport and custody;
- financial history, currency, channel and supporting documents;
- private notes, photographs and certificates.

Every confirmed steward receives the complete artwork-attached archive, including
prior price, currency and artwork documents. It excludes prior stewards'
birthdates, authentication/network evidence, payment credentials, unrelated
account notes and exact private addresses. Invoices and documents are redacted
of unrelated counterparty data before becoming artwork-attached history. Before
transfer a claimant may request temporary disclosure. The current steward selects
individual records and a short expiry; access never implies permission to
download undisclosed attachments.

Photos, certificates and documents live in a private R2 attachment bucket. D1
stores immutable content hashes, object/version identifiers, media metadata and
authorization records; large files are never stored as D1 BLOBs.

### Visibility

Confirmed historical assertions are never silently rewritten. Each record has a mutable
public-presentation flag. Hiding removes it from the public projection only;
showing it again restores the same confirmed record. Visibility changes are
audited but are not represented as changes to the underlying historical fact.

Where privacy or law requires removal, encrypted content may be cryptographically
erased or redacted while retaining its non-reversible hash, record type, time,
reason and superseding correction event. The registry never promises permanent
retention of harmful plaintext personal data.

Exact private addresses are never public. Public location is limited to an
explicit venue, city, region or steward-authored description.

### Inscriptions and dedications

Supported authored story types are:

- one creator inscription;
- one purchaser gift dedication before recipient claim;
- one origin inscription for the first steward;
- one annual steward inscription per eligible year.

Annual eligibility runs from 14 days before through 14 days after the steward's
birthday in their private IANA timezone. February 29 stewards use February 28 in
non-leap years. Each inscription begins as a private draft with a seven-day editing
period. The author may confirm and seal early. Otherwise the claim scheduler seals it at
the deadline. Sealed content is immutable; a correction is a new linked record.

Visibility remains reversible. The sealed story persists privately even while
hidden from the public projection.

The gift-dedication right is issued from an exact initial fulfillment, not from a
payment provider. Adrian records the purchaser's private email or creates a
single-purpose handoff link. The token is hashed, expires after first use or the
recipient's first claim, and can create only one dedication draft for that exact
artwork. Its seven-day editing period begins on first submission. Before shipment
the admin may revoke and reissue an unused entitlement after correcting the
fulfillment; every revocation is audited.

### Public steward profile and dream graph

A steward may opt into a public profile containing selected name, dream/purpose,
website, social links and broad location. Each field can be shown or hidden
independently and later re-enabled. A hidden profile leaves an anonymous steward
period in public lineage rather than breaking history.

Websites and social links are mutable presentation data, not immutable historical
facts. A dream becomes immutable story content only when deliberately sealed as
an inscription. Public profiles and opted-in coherence relationships form the
people, artworks and dreams graph used by both map presentations.

Adrian may add creation, storage, exhibition, restoration and location records
while he is the steward. After transfer the current steward controls new custody
and location records. Adrian may propose a historical or exhibition record, but
the current steward confirms it before private location data is stored or shown.

## Release 4: permanence, projection and custody

### Backups and checkpoints

Encrypted backups include the canonical registry, steward intervals, claims,
private evidence, inscriptions, provenance, notification state and lineage, not
only Ownership Code envelopes.

A scheduled Cloudflare Workflow uses the D1 REST export API at a low-traffic
window, polls export completion and records its D1 bookmark/checksum. It then
builds a manifest of every content-addressed R2 object version/ETag/hash referenced
at that logical cutoff. The recovery set is the D1 export, exact R2 objects,
manifest and escrowed keys. Large exports use chunked authenticated envelope
encryption with a unique nonce per chunk, wrapped data key and manifest root;
ordinary Cloudflare-managed R2 encryption is not treated as independent escrow.

Each day the claim scheduler computes a deterministic checkpoint over artwork anchors and
the prior checkpoint. It signs the checkpoint, publishes it on Adrian, mirrors it
to Mandala, stores it under an immutable sequence key protected by an R2 retention
lock, and submits its hash to an independent witness outside the primary
Cloudflare account. Verification tooling can
prove that a restored database matches the historical checkpoint sequence.

This is tamper evidence and recoverability, not a claim that Cloudflare storage
is metaphysically immutable.

### Registry custodian role

Custody uses separation of duties rather than one omnipotent credential. A
recovery operator can retrieve encrypted exports but cannot decrypt them. A
separate key guardian holds decryption material but no deployment or database
credential. Restoring production, changing bindings or rotating recovery keys
requires both roles and creates independently delivered audit alerts.

The normal registry custodian application role can:

- retrieve encrypted recovery exports;
- restore a scratch or replacement registry;
- verify checkpoints and projections;
- initiate a reviewed redeployment;
- request infrastructure credential rotation through the dual-control ceremony.

It cannot create, edit, hide or delete artwork records; view ordinary private
steward content; approve or deny claims; or transfer ownership. Museum outreach
and recipient ordering remain inactive until institutions agree to participate.
Cloudflare account administrators remain a privileged procedural trust boundary;
the design does not falsely claim that a deploy-capable super-administrator is
cryptographically incapable of abuse.

## Privacy and authorization

Roles are creator/admin, current steward, transfer claimant, temporary disclosure
recipient, public visitor, projection consumer and registry custodian.
Every endpoint defines one role and an explicit response allowlist.

Private financial, biographical, location and technical evidence is encrypted at
rest where practical and never included in public caches or projection documents.
Sensitive responses use `Cache-Control: no-store`. Emergency administrative
access requires step-up authentication and creates an immutable audit event.

## Failure behavior

- Missing encryption or recovery configuration blocks issuance.
- Failed backup blocks activation, assignment and shipment.
- Failed or stale recovery qualification blocks production issuance.
- Failed optional payment integration blocks only that integration.
- Failed email is recorded and retried through the transactional outbox; rare
  duplicate delivery is possible, but it cannot duplicate a state transition.
- Mandala failure leaves Adrian operational and retains Mandala's last verified
  projection.
- Concurrent claim actions resolve through conditional writes with one winner.
- Projection or checkpoint verification failure fails closed and alerts admin.
- A provider-wide notification outage pauses automatic transfer. An individual
  steward mailbox bounce remains evidence of unreachable custody and does not
  orphan the physical artwork indefinitely.

## Verification gates

The implementation requires:

- schema and migration tests from both empty and current production-shaped data;
- QR decode, vector-outline and vendor archive tests;
- copied D1/R2/key restore tests that exclude D1 ciphertext recovery;
- issuance, activation, assignment and shipping concurrency tests;
- claim approval, denial, response, silence and bounce tests;
- notification idempotency and scheduled-boundary tests;
- cross-site signed projection contract tests;
- private disclosure authorization and expiry tests;
- inscription draft, early seal, auto-seal and birthday-boundary tests;
- public visibility hide/show tests without source mutation;
- steward-profile and coherence-consent tests;
- checkpoint creation, restoration and tamper-detection tests;
- browser journeys for admin, first steward, seller, buyer, claimant and registry custodian;
- one production recovery canary;
- real metal tests on current iPhone and Android devices.

Software enforces and records physical observations but cannot perform camera,
attachment, abrasion or cleaning tests without the actual plate.

## Rollout order

1. Ship fabrication readiness and complete the recovery canary.
2. Qualify one real metal plate and enable the verified public identity surface.
3. Disable Mandala ownership mutation paths, ship canonical Adrian ownership,
   and run a real first-steward and immediate-transfer
   canary with controlled accounts.
4. Enable Mandala's signed read projection only after its mutation paths are
   confirmed unavailable.
5. Ship provenance, inscriptions and steward profiles behind private account gates.
6. Publish the dual maps and checkpoint verification.
7. Provision the ceremony for the limited registry custodian role; leave museum outreach disabled.

No rollout step represents later features as available before its live canary
passes.
