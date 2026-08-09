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

**There are two complete ownership systems, both live, neither referencing the other.** This is
the single most important fact in the build.
- Here: `keeper_pieces` with a hash chain enforced by database triggers (migration 013 raises
  ABORT on UPDATE and DELETE), encrypted ownership codes with versioned keys, `AR-XXXXXXXX`
  public codes, and a dependency on commerce that migration 022 deliberately severed.
- On mandalacodes: the Atlas — hash chain in R2 JSON, `StewardRecord`s, letters, consent rings,
  claim requests.

**Auth ground truth.** Adrian-Website is on self-hosted Better Auth, not Clerk. Migration
completed July 2026. `users.clerk_user_id`, `getUserByClerkId`, `upsertUser({clerkUserId})`, and
`atlas_inscriptions.author_clerk_id` are stale Clerk-era names now carrying Better Auth ids.
`TODO.md` and `CLAUDE.md` both still claim Clerk and are wrong.

**Zero real collectors. Zero production artwork identities.** Confirmed in migration 013's header
(production audited with zero `keeper_pieces` rows), in `better-auth-migration.md`, and in the
identity direction. The migration window is open and this is why the merge is cheap now.

**The catalog already holds everything.** 173 pieces across five series in `data/mockData.ts`:
64 Universal Language, 42 Mandala, 34 Light Codes, 21 Objects, 12 Signature. `series` and
`category` on the `Artwork` type are free-form strings. All-artwork-filterable-by-series needs no
data model change. Only 18 pieces exist in the mandalacodes ledger, and no non-UL work at all.

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

## Blocked on Adrian — skip, list, never guess

Three things only Adrian can answer. Do not build around them, do not invent placeholder answers,
and do not let them stall anything else. Skip the item, note it in `## Progress`, continue.

1. **The materials data** — wood species, stones, makers, manufacture location, per piece. The
   `artwork_provenance_entries` table exists with typed entries and visibility flags. It is empty.
   Blocks the certificate (journey step 6, build item 1.5).
2. **Four design calls** — what video actually promises, whether a spouse is a holder or a
   contributor, what makes a light brighter without being gameable, and what the invitation
   carries as proof for a collector with no printed code. Block build items 3.2, 3.1, 2.4, 1.2.
3. **The aesthetic questions** are already answered. Design work runs in parallel under
   `collector-design-handoff.md` and does not block anything here.

---

## Phase boundaries — stop and report

**Work one phase. Stop at its boundary. Report. Do not roll into the next.**

The phases are in `the-collector-build.md`. In short:

- **Phase 0 — the merge.** Five items. Freeze the mandalacodes ledger, migrate its 18 pieces
  here, collapse the duplicated birth-details storage into one row on the person, point
  mandalacodes at this registry as a reader, rename the stale login column. **This blocks
  everything else** — until it lands, two systems claim to own who holds a piece.
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

## The chain migrates cleanly

Chain identity is content-based — SHA-256 over canonicalized event JSON, with no domain or bucket
in the hash. Nothing invalidates on relocation.

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

**Next session picks up: Phase 0, item 0.1.** Nothing is blocked on Adrian for Phase 0.
