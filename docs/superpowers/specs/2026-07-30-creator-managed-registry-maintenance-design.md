# Creator-Managed Artwork Registry and Maintenance Design

**Status:** Approved direction on 2026-07-30
**Canonical system:** AdrianRasmussen.com
**Supersedes:** Stripe-dependent fulfillment and absolute admin immutability in earlier registry designs

## Purpose

The artwork registry is a creator-managed record of a physical artwork's identity,
history, stewardship and meaning. It is not a payment processor and does not need
Stripe to activate, assign, record, transfer or maintain an artwork.

The system must handle imperfect real life. Adrian must retain permanent
administrative authority to correct mistakes, restore access, replace damaged
plates and repair relationships between physical objects and digital records.
Corrections preserve history instead of silently erasing it.

## Governing rule

The public QR code is permanent whenever the physical plate remains usable. The
current digital truth is repairable by the creator/admin. Every consequential
repair appends a private maintenance event recording the previous value, new
value, reason, administrator and time.

Software cannot alter an engraving already attached to an artwork. If the metal
itself is wrong, unreadable, lost or duplicated, admin maintenance supersedes or
voids that plate and connects a replacement.

## Product boundaries

### Included

- permanent public QR identity;
- private Ownership Code and recovery;
- creator-managed artwork and edition identity;
- manual acquisition records, including private amount and currency;
- people, places, roles, intentions, materials and dates involved in creation;
- steward registration and transfer;
- administrative correction, reset, void and replacement;
- private audit history and selective public provenance;
- independent backups and recovery drills.

### Excluded

- Stripe or any other payment provider as a registry dependency;
- automatic proof that a payment occurred;
- automated order fulfillment requirements;
- public display of purchase amounts;
- Atlas dot sizing or financial visualization in this release;
- elaborate anti-theft controls based on speculative pre-claim attacks.

Existing shop checkout may continue as a separate website capability. Its health,
webhooks and data do not block registry work.

## Information model

The registry separates four kinds of information.

### 1. Physical identity

These values describe what was physically produced:

- public plate code and QR URL;
- Ownership Code commitment and encrypted recovery envelope;
- artwork ID and edition engraved on the plate;
- plate generation date and fabrication hashes;
- plate status and replacement lineage.

They are protected from ordinary editing. Maintenance actions may correct the
digital relationship or supersede the plate, but must retain the original values
in the audit history.

### 2. Artwork record

The editable artwork record may contain:

- title and collection or series;
- unique or numbered edition status, edition number and edition size;
- creation start and completion dates;
- materials, dimensions and techniques;
- creation locations;
- creators, fabricators and other contributors with their roles;
- intentions, stories and private notes;
- public description and photographs.

Editing these fields does not require replacing the plate unless the engraved
identity itself becomes false or misleading.

### 3. Acquisition record

Adrian records acquisitions manually. A record supports:

- sale, gift, retained by artist, loan, consignment, inheritance or other;
- acquisition date;
- exact amount paid and ISO currency when applicable;
- acquirer or steward reference;
- private notes and supporting documents;
- optional public provenance wording that never exposes the amount.

Exact amount and currency are private to the admin. They are never returned by a
public artwork, QR, Atlas or projection endpoint. Future Atlas visualization may
derive a non-reversible visual classification, but that work is explicitly
deferred.

### 4. Maintenance history

Each consequential action appends a maintenance event with:

- event type;
- artwork and plate identifiers;
- administrator identity;
- timestamp;
- reason written by the administrator;
- structured before and after values;
- optional private evidence or notes;
- related replacement, steward or acquisition identifiers.

Maintenance history is private by default and append-only. A separate public
correction note may be published when transparency is useful.

## Lifecycle

### Draft

Adrian creates or selects an artwork and enters its metadata. Edition is always
explicit. Blank is invalid. Edition zero requires a deliberate confirmation that
the artwork is unique and non-numbered.

Draft records remain freely editable and do not create a permanent code.

### Generated

Generating a plate creates a public code, private Ownership Code, encrypted
recovery envelope and fabrication package. A generated plate is reserved but not
yet treated as attached to the physical artwork.

Before activation, admin may:

- regenerate downloadable files for the same identity;
- correct draft metadata;
- void an abandoned or incorrect identity;
- run recovery and fabrication checks.

A voided code is never reused.

### Active

Activation means Adrian has compared the real plate with the intended artwork.
The QR resolves publicly and the physical identity becomes protected from
ordinary editing.

Activation does not require an order, payment or Stripe record. It requires:

- explicit artwork and edition confirmation;
- verified encrypted backup;
- current recovery qualification;
- visual comparison of artwork, plate and public destination;
- real-material QR and Ownership Code legibility checks.

### Stewarded

The recipient registers with the Ownership Code after receiving the artwork.
Pre-shipment claim prevention is not a major design driver. The system still
records when a claim occurred and alerts admin if a surprising registration needs
maintenance.

The steward relationship is repairable by admin with a recorded reason.

### Superseded or void

- `void` applies to a generated identity that was never validly attached.
- `superseded` applies when an active physical plate is replaced or retired.
- `lost` and `destroyed` may describe the known physical disposition.

The old public URL remains resolvable and explains that the identity was
superseded. It links to the current plate when public disclosure is appropriate.

## Admin Maintenance

The admin workspace receives a dedicated **Maintenance** area. It is organized
around understandable problems rather than database tables.

### Find a record

Admin can locate a work by title, artwork ID, public code, edition, steward,
acquisition date or maintenance status.

The detail view clearly separates:

- current public truth;
- private artwork and acquisition details;
- physical plate identity;
- current steward;
- backups and recovery status;
- chronological maintenance history.

### Available repairs

Admin can:

1. Correct artwork metadata.
2. Correct the artwork or edition linked to a public code.
3. Void an unused generated identity.
4. Supersede a damaged, lost, incorrect or duplicate physical plate.
5. Generate and connect a replacement plate.
6. Reset, release or transfer the steward relationship.
7. Correct a private acquisition record.
8. Add, correct or remove contributors, locations, roles and intentions.
9. Restore access after account or recovery problems.
10. Restore account access or issue a replacement plate when a physical
    Ownership Code must change.
11. Add an explanatory public correction note.
12. Export, verify and restore the registry.

### Safety without rigidity

Ordinary edits save normally. Consequential actions use a review screen showing:

- what will change;
- what will remain permanent;
- whether the physical plate must be replaced;
- public consequences;
- private consequences;
- the required reason.

The administrator confirms the action once. The system does not require a
second person, payment record or complex ceremony for routine repairs.

High-sensitivity actions, such as revealing an Ownership Code, downloading a
private fabrication package, rotating recovery credentials or deleting private
evidence, require a fresh registry unlock and create a success or failure audit
event.

### Undo model

Corrections are not implemented by deleting history. A later maintenance action
may reverse an earlier one. The current state reflects the latest valid action,
while both actions remain in the private history.

## Public QR experience

Every successful scan displays identity derived from the public code on the
server, never from editable query parameters. The first view includes:

- artwork title;
- stable artwork ID;
- exact edition or `Unique work`;
- public plate code;
- artist name;
- current plate status;
- public provenance selected by Adrian.

Purchase amount, buyer identity, private notes, Ownership Code, recovery state,
admin history and private evidence never appear in the public response.

The public page continues to work before the steward features launch. Claim and
steward controls are additive, not prerequisites for identifying the artwork.

## Ownership and recovery

The Ownership Code is a possession credential, not an irreversible authority
over Adrian. It normally lets a recipient register the artwork, but admin can
repair a mistaken or inaccessible steward relationship.

Recovery has three separate layers:

1. **Piece recovery:** regenerate a private fabrication package from an encrypted
   envelope and the correct versioned master key.
2. **Registry recovery:** restore the complete database, including artwork,
   acquisition, steward, maintenance and audit records.
3. **Administrative recovery:** regain authenticated admin and registry-unlock
   access through documented independent credentials.

Production readiness requires a successful scratch recovery from copied data,
not a test that reads only the live database and live bucket. The result is stored
with the relevant schema, build, key and generator versions and becomes stale
when those dependencies change.

R2 recovery objects are versioned or content-addressed. Retrying a backup cannot
overwrite the last known-good object. Offline exports validate their complete
record count and trusted final hash before being accepted.

## Data visibility

| Information | Admin | Current steward | Public |
| --- | --- | --- | --- |
| Artwork identity and edition | Yes | Yes | Yes |
| Public plate code | Yes | Yes | Yes |
| Exact amount and currency | Yes | No | Never |
| Acquisition type and date | Yes | Optional | Optional |
| Buyer or steward identity | Yes | Their own | Only with explicit consent |
| Contributors and creation places | Yes | Yes | Selected by Adrian |
| Intentions and stories | Yes | Selected private history | Selected by Adrian |
| Ownership Code | Fresh unlock only | Physical code only | Never |
| Maintenance and recovery evidence | Yes | No | Never |

## Error handling

- Public lookup failures distinguish not found from temporary service failure and
  offer retry guidance.
- Admin actions are idempotent so retrying after a network failure does not
  create a second plate, replacement or transfer.
- A failed maintenance action leaves current state unchanged and records no false
  success.
- Conflicting repairs stop and reload the latest record before confirmation.
- Private values never appear in URLs, browser logs, generic error messages or
  public responses.

## Required tests

Before the first production engraving, automated and browser tests cover:

- explicit unique and numbered edition creation;
- QR resolution showing exact server-derived artwork, edition and public code;
- first steward registration for a numbered and a draft-created artwork;
- admin steward reset and transfer;
- correction of an artwork or edition link with retained before/after history;
- voiding generated identities and superseding active plates;
- replacement plate linkage without silent duplicate identity;
- private manual acquisition creation and editing;
- proof that exact amount and currency never enter public payloads;
- contributor, place, role and intention maintenance;
- immutable/versioned R2 backup behavior;
- complete scratch registry and piece recovery;
- ledger rejection of truncation, false headers and conflicting restores;
- accessibility and mobile keyboard use of registration and maintenance forms;
- build, type checking, unit tests and browser journeys for one exact deployed
  commit.

Physical qualification separately tests the actual vendor output on current
iPhone and Android devices, under varied lighting and angles, before and after
attachment, abrasion, cleaning and packing.

## Delivery order

1. Remove Stripe and order state from registry assignment and lifecycle gates.
2. Add manual private acquisition records and contributor/place/role metadata.
3. Add append-only maintenance events and the Maintenance workspace.
4. Implement correction, void, supersede, replacement and steward repair actions.
5. Fix exact edition propagation and first-steward registration.
6. Make recovery qualification durable and R2 backups non-overwriting.
7. Correct the offline ledger and full-registry restoration path.
8. Finish deterministic vendor vectors and qualify a disposable physical plate.
9. Run the full production rehearsal before engraving a real artwork plate.

## Acceptance criteria

The design is complete when Adrian can take any artwork from draft through
physical plate, private acquisition record, public scan and steward registration
without Stripe; can deliberately repair every digital relationship through one
Maintenance area; can see a private history of every consequential repair; can
recover the complete registry from independent copies; and cannot accidentally
expose exact purchase amounts or Ownership Codes publicly.
