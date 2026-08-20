# The click-through — Adrian's review gate before anything flips public

The collector journey and the registration ceremony are wired end to end and everything stays dark behind `livingLegacy: false` in `launchFlags.ts`. Nothing flips public until you have walked every section below and said so. This document is the walk.

## How to open it

- `npm run dev`, then `/collector` opens the review shell (dev builds only).
- **Demo mode** (default): every screen walkable with sample data. The demo code is sixteen `1`s, sixteen `9`s shows the wrong-code state.
- **Wired (dev)** toggle in the shell chrome: the same screens running against the real API of whatever backend the dev server proxies to. Use a non-production database.
- The real entrance, once the flag is on, is a QR scan: `/works/:id?instance=AR-XXXXXXXX&ref=qr`, with `&claim=1` opening the code page directly.
- Artist side: `/admin/register` (the ceremony), `/admin/artworks/:id/add` (Add to this piece), `/admin/pieces` (the desk), `/admin/pieces/wizard` (fabrication only).

This checklist can now be walked as a guided clickable rail that steps through every screen in order with a caption. See `docs/collector-walkthrough-guide.md` for the walkthrough guide. Sections 6 and 7 of this checklist (the artist ceremony and record archive) map to the rehearsal at `/admin/rehearsal`, where you run all eight real steps in sequence.

## 1. Arrival, by relationship

- [ ] Unclaimed piece: quiet page, one lit Begin, no sign-in link.
- [ ] Registered, not signed in: no brass, two peer doors (Look through it · Sign in to tend it).
- [ ] Registered, signed in, not yours: code door reads I hold this piece.
- [ ] Registered to you: no pill, no doors, your rows present, Begin gone.
- [ ] Loading moment holds the foot quietly, and doubt never shows a lit Begin on a held piece.

## 2. The code and the vault

- [ ] Sixteen characters, two rows of eight, the last character is the press, the pause, tumblers accelerate.
- [ ] Wrong code: "The code is not true" with Try again · Contact Adrian.
- [ ] The vault opens only on a real successful bind, never before.
- [ ] Anonymous entry: the held-code screen, then account creation, then the walk resumes and the vault opens. Confirm the typed code survives the email-verification round trip and is gone from the browser after any ending.
- [ ] Contested piece: "A passing begins", the patient screens, no grasping language.
- [ ] Reissued plate, offline, and rate-limited states all read as quiet states, not errors.

## 3. Between the vault and the record

- [ ] Sealed artist message: when one was left, "Something was left for you" arrives right after the vault, before everything else.
- [ ] The four screens: pull, grid, love, carries. Tap anywhere, no skip link.

## 4. The gathering

- [ ] Sign its record, Who you are (skippable), Where it lives, Your links (skippable), What shows. Three required, each with the leave-warning line.
- [ ] The explainer sheet reachable from Why we ask and from Skip.
- [ ] Ignition: the real ordinal ("You are Light N") arrives from the registry, holding quietly until it does.

## 5. The rooms and the garden

- [ ] Story, certificate, history (dark reads as quiet absence until launch), dreams.
- [ ] Garden: one question per screen, place it or not now, the three states none of which is a failure.
- [ ] The yearly ritual door appears only when eligible.
- [ ] The three-tier control (Let it shine · Keep it with the piece · Seal it) with the heirs choice and once-shone-is-permanent.
- [ ] The yearly lock note appears outside your birthday window.
- [ ] The ground warms quietly with years held on a long-kept piece.

## 6. The artist ceremony

- [ ] Register an artwork: threshold, choose or name the work, edition once (Unique one press), unlock, confirm, registered. Under a minute with nothing else required.
- [ ] The Ownership Code shown exactly once, with copy and dismiss.
- [ ] The four next actions plus Add to this piece.
- [ ] A piece already in someone's hands: the invitation path, no photograph required anywhere.
- [ ] Add to this piece: photograph, story, materials and makers, video slot, a message for its caretaker. Empty slots read as quiet rows.
- [ ] Mid-ceremony unlock expiry: the registry closed screen, nothing typed is lost.

## 7. The record and the archive

- [ ] Open a generated Piece Record from disk with no internet: it reads completely, and the printed hash verifies with the inline verifier.
- [ ] The export zip: records, the index front door, the Successor's Handbook at the root.
- [ ] The handbook reads end to end in your voice or close enough to correct.

## Wording that needs your word (placeholders and drift)

Locked copy was never paraphrased. These are the open items:

1. `showsBody` drifted from the record: built as "Your piece shines. Here is what shows…" where §6 says "your piece shines; here is what shows…". Say which stands.
2. `ritual.body` text appears in no section of the wording record. Approve it or replace it.
3. Moderate drifts: `showBirthNote`, `bornEyebrow`, field label casing, `keptNote` (details in the copy audit, scratchpad `copy-audit.md`).
4. The dream's prompt: still the highest-stakes unwritten line.
5. The garden's questions, per-piece materials, the video capsule wording: still yours to write.
6. Invitation-proof wording on the existing-owner path (placeholder shipped).
7. All artist-side ceremony copy (threshold, unlock, confirm, code reveal, record lines) and Add to this piece copy: written plain, none of it locked, all replaceable by your words.
8. The verification-prompt screen reuses the held-code copy: needs your line.
9. The seal writer-access line: "You can always open your own. You can let it shine one day. Once it shines, it stays."
10. The split privacy lamp labels (currently plain placeholders) need your voice.
11. The shows screen now scrolls and needs your layout ruling.

## Still demo-only (deliberate, later passes)

Caretaker-initiated transfer to move a piece beyond the not-yet state, gift wishes from givers, the family approval pair, the succession mark's real store, per-person birthday windows, collaborator accounts, region-grain widening, What was paid, video capture, letters authoring, and the interface inversion.

## The gate

When every box above is checked and the wording items are settled, `livingLegacy` flips in `launchFlags.ts` and deploys with the rest of `main`. Until then the public site behaves exactly as before.
