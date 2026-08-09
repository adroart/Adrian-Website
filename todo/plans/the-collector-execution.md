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
- **Phase 1 — the walkable registration.** Eight items. Reframe registration around the artwork
  rather than the plate, build the invitation door, the opening screen, arrival, the certificate,
  the privacy screen, birth details at onboarding, and seed the missing pieces.
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
finished diff to a second model** via the `codex:rescue` skill before declaring it done. A
different model has different blind spots. A silent bug in a provenance system is expensive and
may not surface for years.

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

**Next session begins Phase 1, item 1.1.** Use the conservative product defaults above. Perform a
reviewed canary and restore rehearsal before any production write.
