# Universal Language Oracle — TODO

A resumable list of everything outstanding. Read with `ANCHOR.md` (the
situation) and `VISION.md` (the intent). This file is the working backlog
— update it as items close. Last revised 2026-05-23.

---

## 0. State right now (as of commit `235aa1d`)

What's on disk and pushed to `oracle/synthesis-foundation`:

- **RELATIONS** — 64 / 64 cards. UL 1 locked. UL 2–64 scaffold.
- **ICHING** — 64 / 64 cards. All scaffold. Plus deep-pass pilots on UL 3, 22, 50 (`.deep.json` files).
- **BODY** — 64 / 64 cards. All scaffold. Plus deep-pass pilots on UL 3, 22, 50.
- **KEYS (Gene Keys)** — 64 / 64 cards. UL 1 final (Adrian-locked). UL 2–64 scaffold.
- **DESIGN (Human Design)** — 64 / 64 cards. UL 1, UL 2 final. UL 3–64 scaffold.
- **Invocations** — 1 / 64. Only UL 1 has an invocation. UL 2–64 not yet written.
- **Card UI** — restructured: card-as-object container, edge-to-edge nav, prominent headers, brown tonal panel progression, white-flash fix, deep-pass loader.
- **Overlays** — KEYS, DESIGN, ICHING, BODY all wired into `data/synthesisData.ts`. RELATIONS overlay NOT yet wired (UL 1 sample exists but doesn't render on the live card).

---

## 1. The biggest decision still open

**Commit the full deep-pass rewrite for the remaining 61 cards across ICHING + BODY?**

The pilot (UL 3, 22, 50) demonstrated the gap: the scaffold prose is
on-standard but surface-anchored; the deep pass reads the full vault
(Eranos philology, Wilhelm/Huang/Cleary translations, Practical Guide
mythology, Rudd's full Gene Keys chapter) and lets those specific
anchors carry the teaching.

If yes: dispatch 61 × 2 = 122 agents under `_DEEP_PASS_ADDENDUM.md`,
writing `NN.deep.json` files. Overlay loader already prefers `.deep.json`
over scaffold, so deep cards swap in automatically as they land.

If no: leave the scaffolds as the working draft until Adrian's Phase 2
personal pass per card.

---

## 2. Stage C — writing work left

### C1. Invocations for UL 2–64  (63 cards)

Status: **0 / 63 written.** Only UL 1 has an invocation.

Per `02_INVOCATION_GUIDE.md`: invocations are NOT delegable to subagents.
They have to be pulled from Adrian's own seeing, read aloud, body-check.
The locked sample for UL 1 is at `oracle/generated/01.json`.

Needs: a working brief for the invocation voice (likely Adrian-written
to set the voice across the 64), then 63 invocations written one at a
time. Loader at `data/synthesisData.ts` already supports any file that
lands in `oracle/generated/`.

### C2. Deep pass — ICHING + BODY for UL 4–64  (122 cards if committed)

Status: **6 / 128 done** (the UL 3 / 22 / 50 pilots).

If you commit the deep pass: each card reads the full vault material per
the addendum, writes a `NN.deep.json` file. Dispatchable in parallel
batches. Same brief as the pilot.

### C3. KEYS UL 2–64 — Adrian Phase 2 → final  (63 cards)

Status: **scaffold for 63 cards, ready for your Phase 2 pass.** The
scaffold is on-standard, written under `oracle/sections/keys/_BRIEF.md`.
Per the manifest, `status: "final"` is set only when you personally
write or rework a card. Not a delegable task.

### C4. DESIGN UL 3–64 — Adrian Phase 2 → final  (62 cards)

Status: **scaffold for 62 cards.** Same shape as KEYS. UL 1 and UL 2 are
final references. Your Phase 2 pass per card.

### C5. ICHING + BODY deep pass — Phase 2 / final  (per card, after C2)

Even with the deep pass committed, the result is still `status:
"scaffold"`. Adrian's per-card Phase 2 pass takes a card to `final`. Not
delegable.

### C6. Moving-line readings — already inside ICHING  (no separate task)

The six moving-line readings per card are part of the ICHING section
file (`lines[]` array, written by the same agent that writes the card's
combination + reading). C2 finishes this automatically when ICHING is
deep-passed. (Standalone Stage C6 from the older ANCHOR roadmap is now
folded into ICHING.)

---

## 3. Stage D — wire, polish, ship

### D1. RELATIONS overlay — wire into the live card

Status: **NOT wired.** The 64 RELATIONS files exist on disk but the live
card still renders the legacy Relations panel data. Needs:
1. Parallel `relationsModules` glob in `data/synthesisData.ts`.
2. A new field on `CardSynthesis` (e.g. `relations` carrying the full
   ten-prose-field shape per `_BRIEF.md`).
3. Card UI panel reads from the new field. The TCG-style layout
   structure already exists in `UniversalLanguageCard.tsx` for UL 1
   (lines around the Relations panel) — extend it to read per-card data.

### D2. Invocation panel for UL 2–64

Status: Loader already supports any file dropped in `oracle/generated/`,
panel already renders. Just waiting on the invocations being written
(C1).

### D3. `CardIdentityHeader` refactor

Status: Partially done. The recent UI work put title + artwork +
keywords in one rounded container above the chapter nav. Still pending
from the original HANDOFF.md: the *same* identity block appearing at
the top of every chapter panel (not just the hero), per HANDOFF Priority
1. Decide whether this is still wanted given the new nav-driven
in-place panel swap (which means the chapter is already always visible
above the panel via the nav).

### D4. Per-panel artwork sizing strategy

Status: Pending. If D3 happens, decide: full artwork on UL, medium-size
artwork on the five system panels.

### D5. Acquire detail section / configurator

Status: BuySheet exists but the configurator per `MARKETING_POSITIONING.md`
§IV is not built. Sizes, configurations, edition counts, etc.

### D6. Artwork image verification

Status: All 64 artwork images need to be verified — exist at Cloudinary,
correct piece, correct filename pattern, alt text matches spec.

### D7. Retire `oracle_cards_complete.json` + `expandedOracleData.ts`

Status: Pending. These hold the legacy per-card data. Once all overlays
fully cover their content, retire and remove the imports.

### D8. Reconcile older guide set to `WRITING_METHOD.md`

Status: Pending. `00`–`06` predate the six-section structure and the
locked writing method. They're not actively misleading because
`WRITING_METHOD.md` is canonical, but they should be edited to point at
the new method or removed.

---

## 4. Stage E — surface & launch

### E1. Rework `OracleSystems.tsx`  (the lineage / "about the systems" page)

### E2. Network UI  (planetary grid of placed sculptures + Pearl-holder profiles)

Per `MARKETING_POSITIONING.md` §VIII–IX and HANDOFF Priority 4. Phase 1
scope: map of placed sculptures with node-holder profiles + Pearl
registration calculator.

### E3. Full review of all 64

Against the locked writing method and the positioning doc. Whole-deck
read, looking for cross-card symmetry, tonal drift, etc.

### E4. Human Design rights check

Per `CONCEPT.md` §9 / §10. Before publishing.

### E5. Confirm every card's status is `final`

C3 / C4 / C5 + any final passes get all 64 cards to `status: "final"`.

### E6. Launch

---

## 5. Stage F — brand / domain (parked)

These are open strategic questions that should not block writing or
shipping work, per HANDOFF.md "Open strategic questions":

- The brand name (currently "Universal Language" — alternatives
  considered, none landed)
- The domain (depends on name)
- The i64 / i64os relationship
- Painted vs unpainted finish strategy
- Unstained / cheaper-node tier

---

## 6. Smaller things that came up

- The casting widget shows only the present hexagram when the throw
  produces no moving lines. Visible silently — should display a small
  "no moving lines in this cast; the hexagram is stable" message.
- Diversify-trim pass on RELATIONS (similar to the one KEYS and DESIGN
  ran) once the section's spotlit and tonally even.
- ANCHOR.md and HANDOFF.md are still slightly out of date relative to
  this commit (235aa1d). Light reconciliation pending.

---

## 7. The way to use this file

Update the status lines as items close. When something splits into
sub-tasks, write them in beneath the parent. When a stage starts,
move it to `## In progress` at the top. The pending stages stay below.

Anchor docs to read alongside this file:
- `VISION.md` — what the deck is and why
- `ANCHOR.md` — the situation, what's decided, what's open
- `WRITING_METHOD.md` — the locked field-by-field standard
- `_DEEP_PASS_ADDENDUM.md` — the deep-pass rules (only when the deep pass is happening)
- `HANDOFF.md` — UI hand-off, open strategic questions
- `MARKETING_POSITIONING.md` — strategic spine, language rules
