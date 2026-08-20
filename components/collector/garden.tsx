/**
 * The garden: Add to your piece.
 *
 * The garden does not live in onboarding. It lives on the piece page, always,
 * from the day of registration onward: fill one now, five next month, the rest
 * across years. Nothing is required and nothing expires.
 *
 * Three surfaces, and the design file picked the first two:
 *   ask   — the piece asks a single thing, full screen, in its own voice
 *   index — a numbered list carrying the first line of each answer, the piece's
 *           own table of contents
 *   write — the page the garden hands you to: one question, a plain rule, and
 *           the one real decision under it
 *
 * The card-stack arrangement (14b in the design file) predates these two and is
 * marked superseded there. It is not built.
 *
 * Sharing is the DEFAULT and the control is how you withhold, per the settled
 * privacy model: the piece shines, the person opts in. So the control is never
 * a permission request.
 *
 * The one real decision under the field is the THREE-TIER control (§6 "Three
 * tiers, and what outlives you"; drawn in collector-primitives.html ~2536-2610):
 * Let it shine · Keep it with the piece · Seal it, stacked, with the heirs'
 * sub-choice under Keep and hidden entirely under Seal. It replaced the two-way
 * capsule on 2026-08-20; the capsule's strings stay exported in copy.ts but
 * nothing here reads them any more.
 *
 * OPEN, and Adrian's: the questions themselves. The eight in `copy.ts` show the
 * intended shape and are marked as placeholders.
 */

import React, { useRef, useState } from 'react';
import { C, F } from './tokens';
import { COPY, PLACEHOLDERS } from './copy';
import { Area, Brass, Eyebrow, Flag, Ground, Note, Plus, RoomBody, RoomHead, TLink } from './ui';
import type { GardenLive } from './live';
import type { DreamTier } from './api';

/**
 * The grave confirm before a seal commits. Sealing is a vow, so it takes one
 * extra deliberate press of the same brass — never a browser confirm(). No
 * locked line exists for this moment and copy.ts is frozen this pass, so the
 * string lives here, registered as a placeholder so it can never reach Adrian
 * disguised as finished copy. T2b: hoist into copy.ts's garden table.
 */
const SEAL_CONFIRM =
  'Sealing is a vow. Press Place it once more, and nobody but you opens these words again, not ever.';
PLACEHOLDERS.add(SEAL_CONFIRM);

type View = 'ask' | 'index' | 'write';

/** what the piece already holds, for the shell */
const PLACED: (string | null)[] = [
  'I saw it in the hallway of a house I was leaving…',
  'On the long wall, where the afternoon reaches it…',
  'The night the power went out and we ate on the floor…',
  null,
  null,
  null,
  null,
  null,
];

/**
 * The wired index: the piece's real dream state, projected onto the question
 * slots. The dreams contract holds ONE current dream per piece, so the first
 * slot carries it and the rest read as waiting. Loading and failure are both
 * quiet: nothing answered yet is a true statement in either.
 */
function livePlaced(live: GardenLive): (string | null)[] {
  const placed: (string | null)[] = COPY.garden.questions.map(() => null);
  if (live.dreams.status === 'ready' && live.dreams.data?.current) {
    placed[0] = live.dreams.data.current.body;
  }
  return placed;
}

export const Garden: React.FC<{
  onWalk?: (key: string) => void;
  onClose?: () => void;
  /** wired: the real dream state and the place call. Absent, demo unchanged. */
  live?: GardenLive;
}> = ({ onClose, live }) => {
  const [view, setView] = useState<View>('ask');
  const [which, setWhich] = useState(live ? 0 : 3);

  /* forward and back through the eight questions, both wrapping. "Next" is
     the cycle the file already had (askOwn kept wired to it, unchanged); the
     ask screen's chevrons, swipe, and arrow keys get both directions. */
  const questionCount = COPY.garden.questions.length;
  const goNext = () => setWhich(i => (i + 1) % questionCount);
  const goPrev = () => setWhich(i => (i - 1 + questionCount) % questionCount);

  if (view === 'index') {
    return (
      <GardenIndex
        onBack={() => setView('ask')}
        onPick={i => {
          setWhich(i);
          setView('write');
        }}
        onClose={onClose}
        placed={live ? livePlaced(live) : undefined}
      />
    );
  }

  if (view === 'write') {
    return (
      <QuestionPage
        index={which}
        onBack={() => setView('index')}
        onPlace={() => setView('index')}
        live={live}
        initialText={
          live && which === 0 && live.dreams.status === 'ready'
            ? live.dreams.data?.current?.body ?? ''
            : ''
        }
      />
    );
  }

  return (
    <GardenAsk
      index={which}
      onSeeAll={() => setView('index')}
      onWrite={() => setView('write')}
      onAnother={goNext}
      onPrev={goPrev}
      onNext={goNext}
    />
  );
};

/* ------------------------------------------------------------------ *
 * One at a time. The piece asks a single thing, full screen, in its own
 * voice. Nothing else on the screen.
 * ------------------------------------------------------------------ */

/** swipe past this many px, horizontally-dominant, to turn the question */
const SWIPE_THRESHOLD = 48;

const GardenAsk: React.FC<{
  index: number;
  onSeeAll: () => void;
  onWrite: () => void;
  onAnother: () => void;
  onPrev: () => void;
  onNext: () => void;
}> = ({ index, onSeeAll, onWrite, onAnother, onPrev, onNext }) => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    /* a mostly-vertical drag is a scroll attempt, not a page turn */
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) onNext();
    else onPrev();
  };

  /* ArrowLeft/Right turn the question while any control on this screen holds
     focus; nothing here grabs focus itself, so Tab order is untouched. */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') onPrev();
    else if (e.key === 'ArrowRight') onNext();
  };

  return (
    <Ground light="b" pad="44px 30px 30px">
      <div style={{ display: 'contents' }} onKeyDown={handleKeyDown}>
        <div style={{ flex: 'none' }}>
          <Eyebrow>{COPY.garden.asks}</Eyebrow>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div
            style={{ position: 'relative' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* the app's one deliberate arrow exception: whisper quiet, brass,
                low opacity until touched. Font glyphs, not an icon set. */}
            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous question"
              className="garden-chevron"
              style={{
                position: 'absolute',
                left: -30,
                top: 0,
                bottom: 0,
                width: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 0,
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                color: C.brass,
                fontFamily: F.body,
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next question"
              className="garden-chevron"
              style={{
                position: 'absolute',
                right: -30,
                top: 0,
                bottom: 0,
                width: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 0,
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                color: C.brass,
                fontFamily: F.body,
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ›
            </button>

            {/* keyed on the question so it re-mounts and re-fades on every
                turn; the file's existing quiet-entry idiom (ceremony/styles.tsx
                `ignite`), just short enough to read as a swap, not a scene.
                Reduced motion is handled globally by .collector-root's rule. */}
            <div key={index} style={{ animation: 'ignite .2s ease-out both' }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: F.display,
                  fontWeight: 300,
                  fontSize: 37,
                  lineHeight: 1.14,
                  color: C.ink,
                  textWrap: 'pretty',
                }}
              >
                <Flag text={COPY.garden.questions[index]} />
              </p>
              <p style={{ margin: '22px 0 0', fontFamily: F.body, fontSize: 14.5, lineHeight: 1.7, color: C.inkBody }}>
                <Flag text={COPY.garden.frames[0]} />
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onWrite}
            style={{
              alignSelf: 'flex-start',
              marginTop: 22,
              background: 'none',
              border: 0,
              cursor: 'pointer',
              fontFamily: F.body,
              fontSize: 15.5,
              color: C.brass,
            }}
          >
            {COPY.garden.writeIt}
          </button>
        </div>

        <div
          style={{
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 18,
            borderTop: `1px solid ${C.hair}`,
          }}
        >
          <TLink onClick={onSeeAll}>{COPY.garden.seeAll}</TLink>
          <TLink onClick={onAnother}>{COPY.garden.askOwn}</TLink>
        </div>
      </div>

      <style>{`
        .garden-chevron { opacity: .35; transition: opacity .15s ease; }
        .garden-chevron:hover, .garden-chevron:focus-visible { opacity: .7; }
      `}</style>
    </Ground>
  );
};

/* ------------------------------------------------------------------ *
 * The index. A numbered list with the first line of what was written
 * under each answered one, so the page reads as the piece's own table
 * of contents. No count anywhere, and no state is a failure.
 * ------------------------------------------------------------------ */

const GardenIndex: React.FC<{
  onBack: () => void;
  onPick: (i: number) => void;
  onClose?: () => void;
  /** wired: the real answers; absent, the shell's samples */
  placed?: (string | null)[];
}> = ({
  onBack,
  onPick,
  placed,
}) => (
  <Ground light="a" pad="44px 30px 30px">
    <RoomHead title={COPY.garden.title} onBack={onBack} />
    <RoomBody top={20}>
      {COPY.garden.questions.map((q, i) => {
        const answer = (placed ?? PLACED)[i];
        return (
          <button
            key={q}
            type="button"
            onClick={() => onPick(i)}
            style={{
              display: 'grid',
              gridTemplateColumns: '26px minmax(0,1fr)',
              gap: 14,
              width: '100%',
              padding: '15px 0',
              borderBottom: `1px solid ${C.hair}`,
              background: 'none',
              border: 0,
              borderBottomWidth: 1,
              borderBottomStyle: 'solid',
              borderBottomColor: C.hair,
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ paddingTop: 5 }}>
              <Eyebrow tone={answer ? C.brass : C.inkQuiet}>{String(i + 1).padStart(2, '0')}</Eyebrow>
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: F.body, fontSize: 16, color: answer ? C.inkWarm : C.ink }}>
                <Flag text={q} />
              </span>
              {answer ? (
                <span
                  style={{
                    display: 'block',
                    paddingTop: 6,
                    fontFamily: F.body,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'rgba(242,227,196,.6)',
                  }}
                >
                  {answer}
                </span>
              ) : (
                <span style={{ display: 'block', paddingTop: 6 }}>
                  <Eyebrow>{COPY.garden.stateNotYet}</Eyebrow>
                </span>
              )}
            </span>
          </button>
        );
      })}

      <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingTop: 20 }}>
        <Plus />
        <span style={{ fontFamily: F.body, fontSize: 15, color: C.ink }}>{COPY.garden.own}</span>
      </div>
    </RoomBody>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * The three-tier control. Three quiet stacked choices, the drawn shape
 * from collector-primitives.html: title over a two-line truth, brass
 * border on the one that holds. The heirs' sub-choice sits under Keep,
 * on by default, and is hidden entirely under Seal, which already
 * answers the question.
 * ------------------------------------------------------------------ */

const TierRow: React.FC<{
  title: string;
  body: string;
  on: boolean;
  /** absent: the row is settled and cannot move */
  onPick?: () => void;
}> = ({ title, body, on, onPick }) => (
  <button
    type="button"
    onClick={onPick}
    disabled={!onPick}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      width: '100%',
      textAlign: 'left',
      padding: '11px 13px',
      cursor: onPick ? 'pointer' : 'default',
      background: on ? 'rgba(212,184,138,.05)' : 'none',
      border: `1px solid ${on ? C.brassEdge : C.hair}`,
      borderRadius: 10,
      fontFamily: F.body,
    }}
  >
    <span style={{ fontSize: 13.5, color: on ? C.brass : C.ink }}>
      <Flag text={title} />
    </span>
    <span style={{ fontSize: 11.5, lineHeight: 1.5, color: C.inkQuiet }}>
      <Flag text={body} />
    </span>
  </button>
);

/** the heirs' right: label and note swap with the state, never a switch glyph */
const HeirsRow: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      width: '100%',
      textAlign: 'left',
      marginTop: 12,
      padding: '9px 2px 0',
      cursor: 'pointer',
      background: 'none',
      border: 0,
      borderTop: `1px solid ${C.hair}`,
      fontFamily: F.body,
    }}
  >
    <span style={{ fontSize: 12.5, color: on ? C.brass : C.ink }}>
      <Flag text={on ? COPY.garden.heirsOnTitle : COPY.garden.heirsOffTitle} />
    </span>
    <span style={{ fontSize: 11.5, lineHeight: 1.5, color: C.inkQuiet }}>
      <Flag text={on ? COPY.garden.heirsOnNote : COPY.garden.heirsOffNote} />
    </span>
  </button>
);

const T = COPY.garden;

/**
 * The whole control, shaped by what already stands:
 *
 *   nothing yet, or a keep dream — three stacked choices, every allowed move
 *     open (keep→shine, keep→seal, and staying put). The heirs' sub-choice
 *     shows only while Keep is the selection.
 *   a shine dream — settled. It shines with the piece; there is no movement,
 *     because shine is permanent and un-shining does not exist.
 *   a sealed dream — the seal state, the writer's own access spoken plainly
 *     (tierSealWriterNote), and exactly one move: let it shine.
 *
 * The lit/tapped share moment (§6 "A question, opened"): shareOnLine under a
 * selection that will shine, shareOffLine under Seal, whose "nobody sees it
 * but you" is literally true. Keep carries no state line — its own body holds
 * the truth ("They may choose to let it shine one day"), and shareOffLine on
 * it would be the exact lie §6 forbids.
 */
const TierControl: React.FC<{
  tier: DreamTier;
  onTier: (t: DreamTier) => void;
  /** the standing dream's tier; null before first placement */
  settled: DreamTier | null;
  heirs: boolean;
  onHeirs: (on: boolean) => void;
  /**
   * Whether the heirs' choice can actually be kept. The demo always shows it
   * (the design is reviewable); the wired path shows it on the FIRST
   * placement, where the create call now carries heirsMayShare through
   * api.ts. Once a dream stands there is no wire to change the choice, so
   * the row hides rather than pretending — a toggle that silently saved
   * nothing would be a lie.
   */
  heirsChoosable: boolean;
}> = ({ tier, onTier, settled, heirs, onHeirs, heirsChoosable }) => {
  if (settled === 'shine') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TierRow title={T.tierShineTitle} body={T.tierShineBody} on />
        <Note top={4}>{T.shareOnLine}</Note>
      </div>
    );
  }

  if (settled === 'seal') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TierRow title={T.tierSealTitle} body={T.tierSealBody} on={tier === 'seal'} onPick={() => onTier('seal')} />
        <TierRow title={T.tierShineTitle} body={T.tierShineBody} on={tier === 'shine'} onPick={() => onTier('shine')} />
        <Note top={4}>{tier === 'shine' ? T.shareOnLine : T.tierSealWriterNote}</Note>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <TierRow title={T.tierShineTitle} body={T.tierShineBody} on={tier === 'shine'} onPick={() => onTier('shine')} />
      <TierRow title={T.tierKeepTitle} body={T.tierKeepBody} on={tier === 'keep'} onPick={() => onTier('keep')} />
      <TierRow title={T.tierSealTitle} body={T.tierSealBody} on={tier === 'seal'} onPick={() => onTier('seal')} />
      {tier === 'keep' && heirsChoosable && <HeirsRow on={heirs} onToggle={() => onHeirs(!heirs)} />}
      {tier === 'shine' && <Note top={4}>{T.shareOnLine}</Note>}
      {tier === 'seal' && <Note top={4}>{T.shareOffLine}</Note>}
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * A question, opened. One question, a plain rule, and the one real
 * decision under it.
 * ------------------------------------------------------------------ */

export const QuestionPage: React.FC<{
  index: number;
  onBack: () => void;
  onPlace: () => void;
  /** wired: place the words for real through api.ts; absent, demo unchanged */
  live?: GardenLive;
  initialText?: string;
}> = ({
  index,
  onBack,
  onPlace,
  live,
  initialText = '',
}) => {
  /* the standing dream, when the garden is wired. The dreams contract holds
     one current dream per piece, and it is what `place` touches. */
  const current = live && live.dreams.status === 'ready' ? live.dreams.data?.current ?? null : null;
  const settled: DreamTier | null = current
    ? current.tier ?? (current.visibility === 'private' ? 'keep' : 'shine')
    : null;

  /* the yearly lock, pre-empted from eligibility: the standing dream's BODY
     settles outside the birthday window. First placement is always open, and
     tier moves are never gated. The server is the real gate — an unknown
     window reads open here and `place` answers 'locked' if it was not. */
  const bodyLocked = Boolean(live && current && !live.editWindowOpen);

  const [text, setText] = useState(initialText);
  const [tier, setTierState] = useState<DreamTier>(settled ?? 'shine');
  const [heirs, setHeirs] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [held, setHeld] = useState<'held' | 'locked' | null>(null);
  /* sealing is a vow: the first press arms, the second commits */
  const [sealArmed, setSealArmed] = useState(false);

  const setTier = (t: DreamTier) => {
    setSealArmed(false);
    setTierState(t);
  };

  const sealing = tier === 'seal' && settled !== 'seal';

  const place = () => {
    if (!live) {
      /* demo: same control, same grave confirm, nothing stored anywhere */
      if (sealing && !sealArmed) {
        setSealArmed(true);
        return;
      }
      onPlace();
      return;
    }
    const body = bodyLocked ? current?.body ?? '' : text.trim();
    if (placing || !body) return;
    if (sealing && !sealArmed) {
      setSealArmed(true);
      return;
    }
    setPlacing(true);
    setHeld(null);
    void live
      .place(body, tier, heirs)
      .then(outcome => {
        if (outcome === 'landed') onPlace();
        else setHeld(outcome);
      })
      .finally(() => setPlacing(false));
  };

  return (
    <Ground light="k" pad="44px 30px 30px">
      <RoomHead title={COPY.garden.questions[index]} onBack={onBack} />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', paddingTop: 26 }}>
        <div style={{ flex: 'none' }}>
          <Note>{COPY.garden.frames[1]}</Note>
        </div>

        {bodyLocked ? (
          /* outside the window the words are readable, never editable: the
             standing body as plain text and the lock as a quiet note. No
             field, no greyed field, no error. Tier moves below stay open. */
          <div className="collector-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 18 }}>
            <p style={{ margin: 0, fontFamily: F.body, fontSize: 15, lineHeight: 1.7, color: C.inkBody }}>
              {current?.body}
            </p>
            <Note top={14}>{COPY.garden.lock}</Note>
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <Area
              value={text}
              hint={COPY.garden.answerHint}
              rows={5}
              onChange={v => {
                setSealArmed(false);
                setText(v);
              }}
            />
          </div>
        )}

        {/* the one real decision. Sharing is the default; the tiers are how
            you withhold, never a permission request. */}
        <div style={{ flex: 'none', paddingTop: 16 }}>
          <TierControl
            tier={tier}
            onTier={setTier}
            settled={settled}
            heirs={heirs}
            onHeirs={setHeirs}
            heirsChoosable={!live || settled === null}
          />
        </div>

        {/* the lock is a single line, deliberately, so the mechanic can change
            without touching anything else on this screen */}
        {!bodyLocked && (
          <div style={{ flex: 'none', paddingTop: 14 }}>
            <Note>{COPY.garden.lock}</Note>
          </div>
        )}

        {/* the grave confirm: one more deliberate press of the same brass */}
        {sealArmed && sealing && (
          <div style={{ flex: 'none', paddingTop: 12 }}>
            <Note>{SEAL_CONFIRM}</Note>
          </div>
        )}

        {/* the quiet failure: a receipt, never an error. The words stay on the
            phone and the same brass tries again. The yearly gate is a state,
            not a failure: the lock line itself answers it. */}
        {held && (
          <div style={{ flex: 'none', paddingTop: 12 }}>
            <Note>{held === 'locked' ? COPY.garden.lock : COPY.states.offlineBody}</Note>
          </div>
        )}
      </div>

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
        <TLink onClick={onBack}>{COPY.garden.finishLater}</TLink>
        <Brass onClick={place}>{COPY.garden.place}</Brass>
      </div>
    </Ground>
  );
};
