# Collector Hybrid Execution Design

**Approved:** 2026-08-09

**Purpose:** Build the collector journey with the maximum safe parallelism while preserving one
owner for every ownership-sensitive seam.

## Outcome

The collector journey is delivered in four waves. Independent leaf modules may be built in
parallel behind closed launch flags. Ownership mutation, shared migrations, parent route
integration, recovery registration, and production rollout remain serial.

The design deliberately separates four concerns:

1. The permanent artwork identity.
2. The optional physical plate and its fabrication package.
3. The person or people currently connected to the piece.
4. The editable ceremony and certificate content around the piece.

No feature may collapse those concerns back into one lifecycle.

## Ratified defaults

- Catalog seeding creates artwork-level registry membership. It does not mint physical-instance
  identities, ownership codes, or edition claims.
- A physical instance receives a permanent identity only through explicit artwork registration.
- Plate fabrication is optional and follows artwork registration.
- Invitations are artwork-specific, intended-recipient-specific, revocable, and single use.
- One canonical keeper retains transfer, recovery, claim, and invitation authority.
- Contributors may add attributed material but cannot change ownership.
- Contributors do not survive a transfer unless the new keeper explicitly invites them again.
- Registered pieces have equal resting brightness. Size may change marker size, never brightness.
- Video begins as one optional keeper upload with export and deletion. It makes no permanence
  promise and has no paid expansion in the first release.
- Warning delivery uses email plus an in-account record. Automatic freeing remains disabled and
  final resolution remains human-reviewed.
- A sale creates a pending invitation only after an administrator confirms the exact physical
  piece. A product identifier never becomes ownership proof.
- Materials, makers, origin, technique, certificate wording, and opening wording use reusable
  templates with per-artwork inherit, override, and suppress states. Missing facts remain hidden.

## Corrected foundation findings

The repository audit found three issues that precede new collector work:

1. Artwork identity is still structurally coupled to plate fabrication.
2. Administrator transfer changes the keeper record without adding the public transfer event the
   journey promises. Administrator reset can also make a previously claimed piece directly
   bearer-bindable again.
3. Contested claims and paid-sale notices still target the frozen legacy writer, which now rejects
   those writes.

These are implementation defects, not product questions. They are repaired before parallel
Phase 1 work begins.

## Execution waves

### Wave 0: ownership foundation

One owner handles the entire wave.

- Make keeper transfer and public transfer history one atomic, idempotent operation.
- Replace reset-to-bearer with an explicit governed recovery or transfer outcome.
- Store contested claims in the canonical database.
- Remove new-write dependencies on the frozen legacy system.
- Separate artwork registration from optional plate generation.
- Extend recovery and restore coverage before any new registry table can ship.

Nothing else may edit the keeper state machine, lineage writer, migration chain, or recovery table
manifest while this wave is active.

### Wave 1: walkable registration

After Wave 0 publishes stable interfaces, three agents work concurrently while the controller
owns integration.

**Registry and invitation lane**

- Register an artwork without generating a plate.
- Offer plate preparation as a later optional transition.
- Build single-use intended-recipient invitations.
- Build dry-run and replay-safe catalog membership seeding.

**Certificate lane**

- Build reusable certificate and wording templates.
- Build bulk assignment and individual inherit, override, and suppress controls.
- Build one effective-certificate resolver used by preview and public output.

**Person-data lane**

- Build versioned four-ring consent outside permanent history.
- Build birth onboarding against the one shared profile.
- Preserve skip, later completion, revocation, minor protection, and private-data boundaries.

**Integration owner**

- Own the opening, arrival, invitation, privacy, birth, and completion screen sequence.
- Own the parent artwork page, routes, navigation, shared styles, launch flags, and browser walk.
- Consume lane interfaces without reimplementing their rules.

### Wave 2: the living piece

Three agents work concurrently against frozen contracts.

- Dream plus yearly ritual.
- Canonical Atlas projection, local claim ordinals, consent-safe cities, and equal brightness.
- Atlas experience with series, year, and place browsing where nonmatches recede.

Letters form the next bounded task because they depend on the stable consent and piece interfaces.
The integration owner alone connects these modules to routes and the parent artwork page.

### Wave 3: extended holding and sale

Parallel leaf modules:

- Contributor access and attribution.
- Optional private video with export and deletion.
- Warning scheduling, delivery receipts, responses, and administrator visibility.
- Sale-created invitation after exact-piece assignment.

Ownership release, recovery, final claim resolution, and sale cutover remain serial canaries.

## Agent boundaries

Parallel agents receive exact file ownership. They may create new files within their lane and edit
only files listed in their packet. They may not edit:

- the migration chain unless their packet reserves the next migration;
- the keeper bind or transfer implementation unless they are the ownership-foundation owner;
- the parent artwork page, application routes, launch flags, shared navigation, or global styles;
- the recovery table manifest unless they are the integration owner at the merge checkpoint.

If a lane discovers that it needs one of those files, it reports the required interface rather
than editing the file.

## Contract-first integration

Each lane publishes a narrow interface plus a representative fixture before its UI integration:

- artwork registration returns a public identity independent of plate state;
- invitation redemption calls the same canonical first-bind operation as an ownership code;
- certificate resolution returns only effective, recorded facts;
- consent projection returns only fields explicitly visible for that piece and person;
- Atlas projection consumes canonical first-bind events and curated consented cities;
- dreams, letters, contributors, and media key to the permanent piece identity.

The integration owner builds against these fixtures. A lane is not merged until the fixture,
runtime implementation, and tests agree.

## Review and merge protocol

Every lane follows the same sequence:

1. Write one behavior test and observe the intended failure.
2. Add the minimum implementation and observe the focused pass.
3. Complete the lane's focused suite and typecheck.
4. Self-review for privacy, ownership, recovery, and out-of-scope edits.
5. Receive a spec-compliance review.
6. Fix and re-review every spec gap.
7. Receive a code-quality review.
8. Fix and re-review every quality issue.
9. Merge into the integration branch.
10. Run the combined focused suite before accepting the next lane.

Agents do not merge directly to the production branch and do not deploy.

## Verification gates

During each lane:

- focused unit tests;
- typecheck;
- clean diff check.

At each wave boundary:

- complete unit suite;
- complete browser suite on desktop and mobile;
- typecheck;
- production build;
- clean diff check;
- privacy and recovery boundary review;
- one second-model review for ownership, lineage, or migration changes.

Before the first production write:

- read-only production inventory;
- encrypted recovery export;
- restore rehearsal into a clean database;
- one clearly marked test artwork;
- full registration, transfer, recovery, invitation, and export walkthrough;
- Adrian approval before any physical plate is fabricated.

## Adrian inputs

No factual content blocks implementation. Adrian's required work is limited to:

- reviewing finished screens and redirecting the visual language if needed;
- entering or tuning factual templates gradually;
- confirming exact physical-piece assignment before sale invitations;
- approving warning copy before delivery opens;
- approving the test artwork and production rollout.

All product behavior uses the defaults above until Adrian chooses to tune it.
