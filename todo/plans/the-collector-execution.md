# The Collector Execution — how to build this, start to finish

> **What this is.** The standing instructions for any session building the collector journey.
> Read this once at the start of a session, work the current phase, stop at the phase boundary.
>
> **You are one session in a multi-session build.** Do not try to finish everything. Do not
> re-plan. The thinking is done and committed; your job is to execute the next phase and leave
> the next session able to start cold.
>
> **Three documents, and you need all three:**
> - `the-collector-journey.md` — the spec. What must be true. Read in full, once.
> - `the-collector-build.md` — the ordered work, phases 0 through 3. Your task list.
> - this file — how to work, what is already verified, what never to relitigate.

---

## Start of session — do this first

1. **Read the three documents above.** The journey spec in full. Do not skim it; it is what the
   build gets checked against and every build item names the step it serves.
2. **Read `## Progress` at the bottom of this file.** It records what previous sessions landed
   and what the next one should pick up. It is the handoff between sessions.
3. **Check for parallel sessions.** `git worktree list` and look for live dev processes. If
   another session is active in this repo, run `i64-worktree collector-<phase>` and move to the
   path it prints before your first edit. Worktree collisions are a recurring failure here.
4. **State your verification plan before writing code.** Name the concrete check — which
   typecheck, which test, which curl, which browser pass. Stating it up front catches
   wrong-approach errors that post-hoc testing cannot.

---

## What is already verified — do not re-survey

Established 2026-08-09 by four survey agents across both projects. Treat as ground truth.

**The placement decision is ratified and closed.** Adrian-Website's registry is the ownership
record. The ceremony layer — four privacy rings, the dream, letters from the piece, the globe,
Founding Lights ordinals — rehomes here from mandalacodes. The reasoning that overturned the
earlier opposite decision is in the journey spec. Do not reopen it.

**There are two ownership implementations, but the audited storage is not two populated live
systems.** This is the corrected ground truth from the Phase 0 audit.
- Here: `keeper_pieces` with a hash chain enforced by database triggers (migration 013 raises
  ABORT on UPDATE and DELETE), encrypted ownership codes with versioned keys, `AR-XXXXXXXX`
  public codes, and a dependency on commerce that migration 022 deliberately severed.
- On mandalacodes: the Atlas — hash chain in R2 JSON, `StewardRecord`s, letters, consent rings,
  claim requests. Its configured ledger object was absent and its public Atlas response was empty
  on 2026-08-09. No authoritative export containing the planned 18 pieces was found.

Both deployments already bind to the same account database. The collision is therefore two sets
of ownership code and two possible writers, not two account databases that need to be combined.

**Auth ground truth.** Adrian-Website is on self-hosted Better Auth, not Clerk. Migration
completed July 2026. `users.clerk_user_id`, `getUserByClerkId`, `upsertUser({clerkUserId})`, and
`atlas_inscriptions.author_clerk_id` are stale Clerk-era names now carrying Better Auth ids.
`TODO.md` and `CLAUDE.md` both still claim Clerk and are wrong.

**Preserve the small live registry exactly.** A read-only production audit on 2026-08-09 found one
keeper piece with one lineage event, alongside four account rows and two profile rows. The older
zero-row statement was stale. Phase 0 must not replace or rewrite that history.

**The catalog already holds everything.** 173 pieces across five series in `data/mockData.ts`:
64 Universal Language, 42 Mandala, 34 Light Codes, 21 Objects, 12 Signature. `series` and
`category` on the `Artwork` type are free-form strings. All-artwork-filterable-by-series needs no
data model change. The earlier plan expected 18 mandalacodes pieces, all from the UL work, but the
current configured ledger and local recovery copies do not contain an authoritative export.

**`CLAUDE.md` is wrong about the architecture.** It claims "No backend, all data lives in
mockData.ts." There are 88 function files and 24 migrations. Fix it when you touch it.

---

## Rules that survive — never relitigate these

Paid for with a six-agent adversarial review. Re-deciding them wastes the review and reintroduces
risks that were specifically closed.

- **Never put a name, email, free text, birth datum, or photo into a hashed chain event.** Opaque
  identifiers, event types, dates, curated city ids, and salted commitments only. The plan calls
  this the load-bearing invariant of the whole system.
- **The printed QR is a pointer, never a credential.**
- **Recovery is an ownership operation, never an edit to history.** Rebinding a claimed piece
  outside an audited `transferred` event must remain structurally impossible, server-enforced.
- **Heirs are hints that never auto-bind.** An email matching a registered heir grants nothing.
- **The claim-escalation window stays off** until four warnings can actually be delivered.
  *"Silence a keeper never heard is not consent."*
- **No approval gate between a person and their shared dream.** No visible support counts, ever.
- **Minors never hold their own accounts;** a guardian authors on their behalf, recorded as such.
- **Machine-asserted identity is never shown to a human as verified.**
- **No surface whose magic depends on a crowd that does not exist yet.** A filter must dim, never
  empty, the map at low density.
- **No plate engraved, no production identity issued** until Adrian approves the design and one
  clearly-marked test piece proves the whole path.

---

## Adrian inputs do not block implementation

Build the complete editing and journey surfaces before asking Adrian for bulk content entry.

1. **Materials, makers, origins, and wording** use reusable templates with per-artwork overrides.
   Missing values remain absent from the public certificate. Adrian adds and tunes the facts later.
2. **Product behavior uses the ratified conservative defaults:** single-use artwork invitations,
   one canonical keeper with contributors, equal brightness for registered lights, and optional
   attached video with no personal or permanent-hosting promise.
3. **The aesthetic questions** are already answered. Design work runs in parallel under
   `collector-design-handoff.md` and does not block anything here.
4. **No historical Atlas import is required.** Adrian confirmed on 2026-08-09 that the Atlas never
   began. The empty live object and backups are the expected state, not lost provenance.

---

## Phase boundaries — stop and report

**Work one phase. Stop at its boundary. Report. Do not roll into the next.**

The phases are in `the-collector-build.md`. In short:

- **Phase 0, the merge.** Five items. Freeze mandalacodes ownership writes, import any verified
  historical source chains into a separate preserved envelope, confirm the already-shared profile
  row, point mandalacodes at this registry as a reader, rename the stale login column. **This blocks
  everything else** until one system is the only writer for who holds a piece.
- **Phase 1, the walkable registration.** One ownership-integrity preflight, then eight journey
  items. Repair transfer and contested-claim paths, reframe registration around the artwork rather
  than the plate, build the invitation door, the opening screen, arrival, the certificate, the
  privacy screen, birth details at onboarding, and seed catalog membership.
- **Phase 2 — the piece becomes alive.** Six items. The dream, the globe and ordinals, a way in
  that is not the hexagram ring, brightness, letters, the yearly ritual.
- **Phase 3 — what only exists on paper.** Four items. Co-holding, video, warning delivery, the
  sale door.

**Why the stops are real, not ceremony.** Phase 0 moves ownership records between two systems in a
provenance system whose entire value is that the record cannot be quietly changed. It deserves
isolated verification and Adrian's eyes before anything is built on top of it. The later stops
exist because a single session cannot hold thirty items of context without degrading — and a
session making decisions against a half-remembered spec is exactly what produced two ownership
systems in the first place.

---

## The source chain is preserved separately

The source hashes remain valid because they are content-based SHA-256 values over canonicalized
source event JSON. They cannot be inserted as this site's native lineage events, however, because
the two systems hash different envelopes and allow different event vocabularies. Phase 0 keeps the
verified source events in their own append-only evidence chain linked to the local keeper record.
It never recomputes or disguises them as native history.

The one real cost is the public mirror, whose tamper-evidence is a commit history rather than the
chain itself. Either carry that repository along unchanged, or record honestly that the trust
chain moved on a given date and cross-reference the old mirror as the historical proof for events
before it. One paragraph of documentation, not an engineering problem.

---

## Verification

**State how you will verify before writing the code, not after.** Both typechecks must exit 0.

**For anything touching the chain, the ownership state machine, or the migration: hand the
finished diff to a fresh second model before declaring it done.** A different model has different
blind spots. A silent bug in a provenance system is expensive and may not surface for years.

**Never claim work is complete without running the check and reading its output.** Evidence before
assertions.

---

## Working rails

- Commit on a branch, never straight to main. Merge with `git-combine main <branch>`.
- No popup questions. In-chat labelled options with your lean, never a dialog.
- No em-dashes anywhere.
- **No file paths, line numbers, column names, migration numbers, or hex codes in anything Adrian
  reads.** Name things by what they do. Identifiers belong in commands he runs, never in sentences
  he reads. He is a visual designer; insider terms make him decode instead of decide.
- No icons, no emoji, no symbol glyphs in the UI. Text and colour only for states.
- Send a clickable dev-server link when there is something to look at.

---

## End of session — leave the next one able to start cold

Before you stop, append to `## Progress` below:

- Which phase and which items you completed, in plain language.
- What you verified and how — the actual check you ran.
- Anything you found that contradicts this file or the spec. **Correct the document rather than
  carrying the contradiction forward.** A wrong document is how two ownership systems got built.
- What the next session should pick up first.
- Anything newly blocked on Adrian.

Then report to Adrian: what landed, what needs him, what is next. Nothing else.

---

## Progress

**2026-08-09 — planning complete, no code yet.** The spec, the ordered build, and this file are
written, committed, and pushed. Four survey agents established the ground truth recorded above.
The two-ownership-systems collision was found and the placement decision ratified. Design work is
staged separately and runs in parallel.

**2026-08-09: Phase 0 implementation stopped at its boundary.** Mandalacodes ownership writes are
frozen and its Atlas surfaces now read the canonical registry. This site has an additive source
history envelope, a fail-closed and replay-safe import path, a verified public reader, private
recovery support, and a rolling login-name compatibility change that keeps both deployments safe
during rollout. The existing keeper record and lineage event are preserved. The already-shared
profile storage was verified rather than duplicated again.

No historical import was performed. The configured legacy ledger object, public Atlas, and recovery
copies are empty because the Atlas never began. Adrian confirmed this on 2026-08-09. Phase 0 correctly
creates no historical records; the fail-closed import path remains only as a safeguard.

Verification passed on both projects: focused provenance and compatibility tests, each full unit
suite, each typecheck, each production build, and clean-diff checks. Independent reviews found and
closed privacy, replay, semantic-integrity, old-backup compatibility, read-side mutation, rollout,
and truthful-empty-state defects before the boundary report.

**2026-08-09: Adrian closed the final Phase 0 question.** There is no missing Atlas export because
the project had not begun. Materials, makers, origins, and wording will be editable through reusable
templates with individual artwork overrides and can be filled gradually after the interface exists.

**2026-08-09: Adrian approved the hybrid multi-agent execution design.** Independent leaf modules
may build in parallel behind closed launch flags. Ownership mutation, migrations, recovery
registration, parent-route integration, and production rollout remain single-owner seams. The
approved design and Phase 1 work packets are recorded beside this file.

The repository-wide audit corrected one more statement before implementation. Administrator
transfer does not yet append the promised public transfer event, administrator reset can make a
previously claimed piece directly bearer-bindable, and contested claims still call the frozen
legacy writer. Phase 1 begins with item 1.0 to repair those paths. This does not reopen Phase 0's
placement decision.

**Next session begins Phase 1, item 1.0.** Then item 1.1 publishes the artwork-registration seam
that the parallel invitation, certificate, privacy, and birth lanes consume. Perform a reviewed
canary and restore rehearsal before any production write.

**2026-08-09: Phase 1 item 1.0 is complete locally and has not been deployed.** A previously
claimed artwork can no longer return to bearer binding or change keeper through an unaudited
update. Governed transfer now records its private evidence, advances keeper state and public
lineage together, clears the prior display location, and replays without duplication even if the
recipient's account email later changes. Public transfer history contains only random
transfer-scoped references and the transfer kind.

Contested claims now stay in the canonical registry, preserve the current keeper, remain private,
and wait for human resolution. Encrypted recovery carries the claim queue and complete transfer
evidence, retains support for older archives, and has been tested across two successive transfers.

Verification passed with 455 unit tests, typecheck, the production build, and the complete browser
suite with 58 passes and 10 intentional skips. Focused ownership, privacy, migration, and recovery
checks passed. Independent specification, security, and final re-review found and closed raw state
mutation, partial transaction, private-data, stale retry, damaged migration, and multi-transfer
restore defects.

The damage detector and migration guard are built and tested. Before any production migration,
run the detector against a fresh read-only database copy, rehearse migration and restore on copies,
and stop if it finds a previously claimed artwork in an unclaimed or half-bound state.

**Next: Phase 1 item 1.1, artwork-first registration with optional plate preparation.** No
additional Adrian content is needed to begin it.

**2026-08-09: Phase 1 item 1.1 is complete locally and has not been deployed.** An artwork can now
receive its permanent public identity, encrypted Ownership Code, verified identity backup, and
initial public history before any physical plate exists. Public lookup and the permanent QR work in
that registered state without exposing ownership secrets, keeper identity, or private recovery
data. First keeper binding uses the qualified identity backup independently of plate fabrication.

Optional plate preparation keeps the same artwork identity, code, keeper state, and public history.
It records a separate administrator action and remains replay-safe. The older plate endpoint can
only replay a previously generated package and cannot mint around artwork registration. Catalog
membership storage is separate and cannot create an edition, public code, keeper, or lineage.

Verification passed with 482 unit tests, typecheck, the production build, and the complete browser
suite with 58 passes and 10 intentional skips. The focused registration gate passed 230 tests.
Independent specification and security reviews found and closed expired-authority creation,
plate-first bypass, qualification ordering, catalog conflict, endpoint-coverage, and concurrent
replay defects.

**Next: Phase 1 items 1.2 through 1.7 can build in parallel behind the published registration and
first-bind seams.** No additional Adrian content is needed for invitation proof, template editing,
privacy and shared birth onboarding, or dry-run catalog membership.

**2026-08-09: Phase 1 items 1.2 through 1.8 are complete locally and have not been deployed.** The
public arrival is now a complete artwork record without a sign-in wall or timed gate. A collector
can enter through a neutral registration door, read the opening promise, sign in, prove the artwork
with either its Ownership Code or a single-use invitation, choose privacy, review or skip shared
birth information, see the effective certificate facts, and complete the journey. Invitation proof
is restricted to its intended verified recipient, expires or revokes safely, cannot be reused, and
does not enter public history, browser storage, or the page address.
The token remains editable while an invitation is inspected, then freezes during irreversible
redemption so a successful single-use result cannot be discarded by an in-flight edit.

The opening promises a durable, exportable ownership record. It always explains that the Ownership
Code remains with the artwork, grants registration access to whoever holds it, and must be kept safe
and private. Editable wording can supplement but cannot replace those truths. Video remains an
optional attachment and does not promise permanent hosting. Privacy defaults closed. Existing birth
information can be kept or updated, and missing information can be added or skipped. Public
certificate facts resolve from reusable templates plus individual artwork overrides, render the
exact server-resolved artwork instance, and omit blank values. A mismatched certificate response
fails closed. Administrator surfaces now expose artwork registration, collector invitations, and
certificate editing, while
physical plate preparation remains optional and later.

Catalog-wide membership planning completed as a dry run only. Encrypted recovery now carries every
new Phase 1 record, restores invitation redemption in its valid sequence, preserves private account
references, and upgrades older archives without inventing proof. The local non-production canary
passed 127 focused ownership, invitation, and encrypted clean-restore checks. After the final
acceptance repairs, the stable full gate passed 540 unit tests, 84 browser tests with 10 intentional
skips, typecheck, the production build, and clean-diff checks. No production data was seeded or
changed, no launch flag was enabled, and no deployment was performed.

Adrian can add materials, makers, origins, and final wording gradually through the certificate
editor; missing facts stay hidden and do not block the next phase. Before production rollout, run
the ownership damage detector against a fresh read-only production copy, rehearse migration and
encrypted restore on copies, and stop on any damaged ownership state. Real sale-to-artwork mapping
also remains an Adrian input before the later sale door can be connected.

**Next: Phase 2 makes the piece feel alive.** Build the dream, globe-light, equal-brightness, and
yearly-ritual experience behind the closed launch flag. Do not seed production or enable the
journey before the production-copy preflight succeeds.
