/**
 * What the piece writes.
 *
 * Two of them, and neither is from an app:
 *   the letter — unsigned, as though the house wrote it. It reports what it has
 *                held, opens a door, and asks for nothing.
 *   the email  — what the caretaker gets when an invited person writes, named
 *                by who they are as well as their relation, so a child's words
 *                are not left waiting for years.
 *
 * The law that shapes both: there is no prompt anywhere. The invitation is that
 * the page visibly becomes more alive, never a request. Adrian: "You feel
 * something with your love, not because it wants something from you."
 *
 * Wording for letters has not been worked. All of it is marked.
 */

import React from 'react';
import { C, F } from './tokens';
import { COPY } from './copy';
import { Body, Brass, Eyebrow, Ground, Note, TLink } from './ui';

export type LetterKey = 'letter' | 'email';

export const LetterScreen: React.FC<{ letter: LetterKey; onBack?: () => void }> = ({ letter, onBack }) =>
  letter === 'letter' ? <FromThePiece onBack={onBack} /> : <SomeonePlaced onBack={onBack} />;

const FromThePiece: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <Ground light="m" pad="44px 30px 30px">
    {/* one warm wash at the top, so the letter reads as lit from the house */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(70% 34% at 50% 8%,rgba(212,184,138,.08) 0%,transparent 70%)',
      }}
    />

    <div style={{ position: 'relative', flex: 'none' }}>
      <Eyebrow>{COPY.letter.from}</Eyebrow>
    </div>

    <div className="collector-scroll" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 26 }}>
      <p style={{ margin: 0, fontFamily: F.display, fontWeight: 300, fontSize: 25, lineHeight: 1.42, color: C.ink }}>
        {COPY.letter.lead}
      </p>
      <Body top={22}>{COPY.letter.p1}</Body>
      <Body top={16}>{COPY.letter.p2}</Body>
      <Body top={16}>{COPY.letter.p3}</Body>
      <div style={{ paddingTop: 26, fontFamily: F.body, fontSize: 12.5, fontStyle: 'italic', color: C.inkQuiet }}>
        {COPY.letter.sign}
      </div>
    </div>

    <div
      style={{
        position: 'relative',
        flex: 'none',
        marginTop: 'auto',
        paddingTop: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <TLink onClick={onBack}>{COPY.letter.later}</TLink>
      <Brass onClick={onBack}>{COPY.letter.openPage}</Brass>
    </div>
  </Ground>
);

const SomeonePlaced: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <Ground light="r" pad="44px 30px 30px">
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(70% 30% at 50% 6%,rgba(212,184,138,.07) 0%,transparent 70%)',
      }}
    />

    <div style={{ position: 'relative', flex: 'none' }}>
      <Eyebrow>{COPY.letter.emailFrom}</Eyebrow>
    </div>

    <div
      style={{
        position: 'relative',
        flex: 'none',
        paddingTop: 22,
        paddingBottom: 18,
        borderBottom: `1px solid ${C.hairStrong}`,
      }}
    >
      <div style={{ fontFamily: F.display, fontWeight: 300, fontSize: 27, lineHeight: 1.24, color: C.ink, textWrap: 'pretty' }}>
        {COPY.letter.emailHead}
      </div>
      <div style={{ paddingTop: 10, fontFamily: F.body, fontSize: 12.5, color: C.inkQuiet }}>
        {COPY.letter.emailWho}
      </div>
    </div>

    <div className="collector-scroll" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto', paddingTop: 22 }}>
      <Body>{COPY.letter.emailBody}</Body>
      <div
        style={{
          marginTop: 22,
          padding: '16px 16px 18px',
          borderRadius: 4,
          boxShadow: 'inset 0 0 0 1px rgba(212,184,138,.22)',
          background: 'linear-gradient(90deg,rgba(212,184,138,.08),rgba(212,184,138,.02))',
        }}
      >
        <Eyebrow tone={C.brass}>{COPY.letter.emailWords}</Eyebrow>
        <p style={{ margin: '11px 0 0', fontFamily: F.body, fontSize: 14.5, lineHeight: 1.66, color: C.inkWarm }}>
          {COPY.letter.emailQuote}
        </p>
      </div>
      <Note top={22}>{COPY.letter.emailFoot}</Note>
    </div>

    {/* the two choices, and neither is owed. Nothing happens if it is left. */}
    <div
      style={{
        position: 'relative',
        flex: 'none',
        marginTop: 'auto',
        paddingTop: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <TLink onClick={onBack}>{COPY.rooms.familyKeep}</TLink>
      <Brass onClick={onBack}>{COPY.rooms.familyShine}</Brass>
    </div>
  </Ground>
);
