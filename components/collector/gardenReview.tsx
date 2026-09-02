/**
 * The review page: placing passes through here, always.
 *
 * Adrian's ruling (§7 "The lock line moves; the placing gets a review"):
 * pressing Place it on the write screen no longer commits anything. It hands
 * the draft to this one grave page, which shows
 *
 *   - the words read back WHOLE, in the reading typography the rooms use,
 *     scrollable when they run long,
 *   - the chosen tier restated in its own words (the tier titles and bodies
 *     from copy.ts, verbatim),
 *   - the warning that placing locks it into the record,
 *   - the honesty that the editing mechanics are still being decided,
 *
 * and the one press that commits, bottom right. The quiet link on the left
 * returns to the write screen with everything intact (the Garden wrapper
 * keeps the draft and hands it back).
 *
 * THE SEAL'S SECOND PRESS LIVES HERE. The write screen's two-press arm state
 * is gone: when the tier is Seal it, this page IS the grave moment. Its
 * warning paragraph carries the seal vow language, tierSealBody and
 * tierSealWriterNote reused verbatim, and the single commit press suffices.
 *
 * Outcomes land here too, in the file's quiet idiom: held and locked are
 * receipts, never errors, and nothing written is ever lost.
 */

import React, { useState } from 'react';
import { C, F } from './tokens';
import { COPY, PLACEHOLDERS } from './copy';
import { Brass, Eyebrow, Flag, Ground, Note, RoomBody, RoomHead, TLink } from './ui';
import type { GardenLive } from './live';
import type { DreamTier } from './api';

/* ------------------------------------------------------------------ *
 * Drafted lines, none of them Adrian's yet. copy.ts is another lane's
 * file this pass, so they live here, registered as placeholders so they
 * can never reach Adrian disguised as finished copy. T2b: hoist into
 * copy.ts's garden table once it reopens.
 * ------------------------------------------------------------------ */

const REVIEW_HEAD = 'Read it back';
PLACEHOLDERS.add(REVIEW_HEAD);

/** the warning: placing locks it into the record (non-seal tiers) */
const REVIEW_WARN = 'Placing it sets these words into the record, and the record keeps them.';
PLACEHOLDERS.add(REVIEW_WARN);

/** the honesty: the editing mechanics are still being decided */
const REVIEW_HONESTY = 'The way placed words open again for changing is still being decided.';
PLACEHOLDERS.add(REVIEW_HONESTY);

/** the one press that commits */
const REVIEW_COMMIT = 'Place it, truly';
PLACEHOLDERS.add(REVIEW_COMMIT);

/**
 * The quiet line for words the yearly gate is holding: the locked outcome
 * here, and the settled read-only body on the write screen. Replaces
 * COPY.garden.lock at both, per §7 the old line left the writing screen
 * entirely and its mechanic talk moved into REVIEW_HONESTY above.
 */
export const GARDEN_HELD_LINE = 'It is held until its day. Nothing you wrote is lost.';
PLACEHOLDERS.add(GARDEN_HELD_LINE);

/* The piece answered, and asked for something first. Saying it plainly is the
 * point: the words are safe, and the caretaker knows what clears it. */
export const GARDEN_UNREADY_LINE =
  'Your words are here and nothing is lost. The piece asks for your birth day, time and place before words can be placed in it. That question lives in the walk through your record.';
PLACEHOLDERS.add(GARDEN_UNREADY_LINE);

const T = COPY.garden;

/** What the write screen hands over. Nothing is committed until this page says so. */
export type GardenDraft = {
  body: string;
  tier: DreamTier;
  heirsMayShare: boolean;
  /** whether the heirs' sub-choice was live on the write screen, so the
   *  read-back only restates a choice that was actually offered */
  heirsShown: boolean;
};

export const GardenReview: React.FC<{
  /** the question being answered, for the read-back's quiet context line */
  question: string;
  draft: GardenDraft;
  /** wired: the real place call through api.ts; absent, the demo commits nothing */
  live?: GardenLive;
  /** back to the write screen, everything intact */
  onBack: () => void;
  /** the placement landed (or the demo stood in for it) */
  onDone: () => void;
}> = ({ question, draft, live, onBack, onDone }) => {
  const [placing, setPlacing] = useState(false);
  const [held, setHeld] = useState<'held' | 'locked' | 'unready' | null>(null);

  const sealing = draft.tier === 'seal';
  const tierTitle = sealing ? T.tierSealTitle : draft.tier === 'keep' ? T.tierKeepTitle : T.tierShineTitle;

  const commit = () => {
    if (!live) {
      /* demo: the same grave page, nothing stored anywhere */
      onDone();
      return;
    }
    if (placing) return;
    setPlacing(true);
    setHeld(null);
    void live
      .place(draft.body, draft.tier, draft.heirsMayShare)
      .then(outcome => {
        if (outcome === 'landed') onDone();
        else setHeld(outcome);
      })
      .finally(() => setPlacing(false));
  };

  return (
    <Ground light="k" pad="44px 30px 30px">
      <RoomHead title={REVIEW_HEAD} onBack={onBack} />

      <RoomBody top={22}>
        <Eyebrow>{question}</Eyebrow>

        {/* the words, whole. The rooms' own reading typography (the dream
            body in rooms.tsx), with the writer's line breaks kept. */}
        <p
          style={{
            margin: '14px 0 0',
            fontFamily: F.display,
            fontWeight: 300,
            fontSize: 23,
            lineHeight: 1.36,
            color: C.inkWarm,
            textWrap: 'pretty',
            whiteSpace: 'pre-wrap',
          }}
        >
          {draft.body}
        </p>

        {/* the tier, restated in its own words. For Seal it, the restatement
            IS the vow: tierSealBody and tierSealWriterNote, verbatim, stand
            as this page's warning paragraph, and the one press below is the
            second press the seal used to ask for on the write screen. */}
        <div style={{ marginTop: 26, paddingTop: 16, borderTop: `1px solid ${C.hair}` }}>
          <p style={{ margin: 0, fontFamily: F.body, fontSize: 13.5, color: C.brass }}>
            <Flag text={tierTitle} />
          </p>
          {sealing ? (
            <>
              <Note top={6}>{T.tierSealBody}</Note>
              <Note top={8}>{T.tierSealWriterNote}</Note>
            </>
          ) : (
            <Note top={6}>{draft.tier === 'keep' ? T.tierKeepBody : T.tierShineBody}</Note>
          )}
          {draft.tier === 'keep' && draft.heirsShown && (
            <Note top={8}>{draft.heirsMayShare ? T.heirsOnTitle : T.heirsOffTitle}</Note>
          )}
        </div>

        {/* the warning, then the honesty. The seal's vow above already said
            the graver thing, so the generic lock warning yields to it. */}
        {!sealing && <Note top={18}>{REVIEW_WARN}</Note>}
        <Note top={sealing ? 18 : 8}>{REVIEW_HONESTY}</Note>

        {/* the quiet outcomes: a receipt, never an error. The words stay on
            this page and the same brass tries again; the yearly gate is a
            state, answered in the held line's own words. */}
        {held && (
          <Note top={14}>
            {held === 'locked'
              ? GARDEN_HELD_LINE
              : held === 'unready'
                ? GARDEN_UNREADY_LINE
                : COPY.states.offlineBody}
          </Note>
        )}
      </RoomBody>

      <div
        style={{
          flex: 'none',
          marginTop: 'auto',
          paddingTop: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <TLink onClick={onBack}>{T.change}</TLink>
        <Brass onClick={commit}>{REVIEW_COMMIT}</Brass>
      </div>
    </Ground>
  );
};
