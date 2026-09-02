/**
 * The eight states a real person reaches.
 *
 * The spec walks the path where everything works. These are the ones it does
 * not walk. Four of them are their own screens and live here; the other four
 * are states of surfaces that already exist:
 *
 *   the foot is held   → PiecePage, relationship="loading"
 *   the registry is off → RecordOnly, below
 *   nothing placed yet  → PiecePage, relationship="yours", placed={0}
 *   the code did not open → CodePage, sixteen nines
 *
 * Each is written to keep one law that is easy to break when something goes
 * wrong: no prompt, no count, no blame, no locked door, and never the unclaimed
 * foot on a piece someone already holds.
 *
 * The copy on these screens is the designer's, not Adrian's, except where a
 * locked line already existed. Everything unlocked is marked in `copy.ts` and
 * renders with a dev marker.
 */

import React from 'react';
import { C, F } from './tokens';
import { COPY, PIECE, PLACEHOLDERS } from './copy';
import { Body, Brass, Eyebrow, Flag, Ground, Head, Ledger, Note, TLink } from './ui';
import { Drawing } from './drawings';

export type StateKey = 'account' | 'verify' | 'held' | 'plate' | 'offline' | 'recordonly' | 'notyet';

/**
 * The honest passing (D4). The passing screens exist as demo surfaces, but
 * nothing behind them is wired: walking a caretaker into them from the live
 * piece page would stage a passing that cannot happen. Until the flow is
 * real, the door says so plainly and returns them to the piece.
 *
 * Neither line is Adrian's. copy.ts is frozen this pass, so they live here,
 * registered as placeholders so the dev marker shows. T2b: hoist into
 * copy.ts once the passing copy is worked.
 */
const VERIFY_HEAD = 'Confirm your email first';
const VERIFY_BODY =
  'You are signed in, and the piece will not bind to an account whose email has not been confirmed. Sign in again with an emailed code and it is confirmed in the same motion. Your code stays held while you do it.';
PLACEHOLDERS.add(VERIFY_HEAD);
PLACEHOLDERS.add(VERIFY_BODY);
const VERIFY_PRIMARY = 'Email me a code';
PLACEHOLDERS.add(VERIFY_PRIMARY);

const NOTYET_HEAD = 'The passing is not open yet';
const NOTYET_BODY =
  'Passing a piece on will happen right here, and it is not ready to be done yet. Nothing about your piece or its record is affected. When the passing opens, this door leads into it.';
PLACEHOLDERS.add(NOTYET_HEAD);
PLACEHOLDERS.add(NOTYET_BODY);

/** Same idiom as walk.tsx's own local `ph`: registers a string as a
 *  placeholder against the shared PLACEHOLDERS set so it can be marked on
 *  screen, without touching frozen copy.ts. */
const ph = (s: string): string => {
  PLACEHOLDERS.add(s);
  return s;
};

type Props = {
  state: StateKey;
  onBack?: () => void;
  /**
   * Wired extras. Absent, every screen renders its demo content unchanged.
   *   heldCode  the real held code shown on the account state (memory only)
   *   onPrimary / onSecondary  the brass and the quiet link, when the wired
   *   journey routes them somewhere other than back
   *   receipt   what survives on the phone, shown back on the offline state;
   *   an empty array hides the receipt card entirely
   */
  heldCode?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  receipt?: [string, string][];
};

export const StateScreen: React.FC<Props> = ({
  state,
  onBack,
  heldCode,
  onPrimary,
  onSecondary,
  receipt,
}) => {
  if (state === 'account') {
    return (
      <NoAccount
        onBack={onBack}
        heldCode={heldCode}
        onMake={onPrimary ?? onBack}
        onHave={onSecondary ?? onBack}
      />
    );
  }
  if (state === 'verify') {
    return <VerifyEmail onBack={onBack} onVerify={onPrimary ?? onBack} />;
  }
  if (state === 'held') return <AlreadyHeld onBack={onBack} onClaim={onPrimary ?? onBack} />;
  if (state === 'notyet') return <PassingNotYet onReturn={onPrimary ?? onBack} />;
  if (state === 'plate') return <ReissuedPlate onBack={onBack} />;
  if (state === 'offline') {
    return (
      <Offline
        onBack={onBack}
        onRetry={onPrimary ?? onBack}
        onLater={onSecondary ?? onBack}
        receipt={receipt}
      />
    );
  }
  return <RecordOnly />;
};

/* ------------------------------------------------------------------ *
 * A true code, and no account yet.
 *
 * The code stays visible on the page so it is not typed twice, and the
 * account is described as what it is rather than as a gate.
 * ------------------------------------------------------------------ */

const NoAccount: React.FC<{
  onBack?: () => void;
  heldCode?: string;
  onMake?: () => void;
  onHave?: () => void;
}> = ({ onBack, heldCode, onMake = onBack, onHave = onBack }) => {
  const shown = heldCode ?? PIECE.code;
  return (
  <Ground light="c" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 150 }}>
      <Drawing motif="vault" size={104} draw />
    </div>
    <div style={{ position: 'relative', flex: 'none' }}>
      <Head size={34}>{COPY.states.accountHead}</Head>
    </div>
    <Body top={16}>{COPY.states.accountBody}</Body>

    <div
      style={{
        position: 'relative',
        flex: 'none',
        marginTop: 26,
        border: `1px solid rgba(237,233,226,.1)`,
        borderRadius: 14,
        padding: '18px 20px',
        background: 'rgba(0,0,0,.16)',
        textAlign: 'center',
      }}
    >
      <Eyebrow size={9.5}>{COPY.states.accountHeld}</Eyebrow>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 7,
          paddingTop: 11,
          fontFamily: F.mono,
          fontSize: 17,
          letterSpacing: '.28em',
          color: C.inkBody,
        }}
      >
        <span>{shown.slice(0, 4)} {shown.slice(4, 8)}</span>
        <span>{shown.slice(8, 12)} {shown.slice(12, 16)}</span>
      </div>
      <Note top={12}>{COPY.states.accountHeldNote}</Note>
    </div>

    <div style={{ position: 'relative', flex: 1 }} />
    <div
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        paddingTop: 24,
      }}
    >
      <Brass full onClick={onMake}>
        {COPY.states.accountMake}
      </Brass>
      <TLink onClick={onHave}>{COPY.states.accountHave}</TLink>
    </div>
  </Ground>
  );
};

/* ------------------------------------------------------------------ *
 * Already held.
 *
 * A true code, already bound to someone. This is a resale, an inheritance
 * or a theft, and the page cannot tell which, so it says only that the
 * piece is held. Nothing about who holds it. The sacred rule: the code
 * alone never transfers ownership.
 *
 * Rebuilt per Adrian, 2026-08-20: "it needs to be able to function without
 * me. If I pass or cannot manage it, my role is not for people to write me
 * and fix things. My role is to have the system already built and
 * automated." The former screen routed this through a letter to Adrian;
 * the backend already runs the real settlement without him, so the screen
 * now describes that process instead: claiming with the true code opens a
 * claim, the registered caretaker is told and has their say, and thirty
 * days of silence (with reminders) passes the piece on. `onClaim` opens the
 * code page when a caller supplies one; StateScreen wires it from its own
 * `onPrimary` prop, falling back to `onBack` exactly like every other state
 * here does when no wiring is provided.
 * ------------------------------------------------------------------ */

// workbook: drafts describing the real automated claim / notice / thirty-day
// process. Not yet read back to Adrian.
const HELD_BODY_1 = ph(
  'Someone already tends this piece. If it has truly come to you, the code in your hands is enough to begin the passing.',
);
const HELD_BODY_2 = ph(
  'Its caretaker is told, and has their say. Thirty days of silence, with reminders along the way, settles the piece to you; a word from them settles it the other way.',
);
const HELD_BODY_3 = ph('The piece keeps what it holds either way. Nothing is lost by either of you.');
const HELD_CLAIM = ph('Say it is yours');

const AlreadyHeld: React.FC<{ onBack?: () => void; onClaim?: () => void }> = ({ onBack, onClaim = onBack }) => (
  <Ground light="e" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 162 }}>
      <Drawing motif="hands" size={106} draw />
    </div>
    <div style={{ position: 'relative', flex: 'none' }}>
      <Head size={34}>{COPY.states.heldHead}</Head>
    </div>
    <Body top={16}>{HELD_BODY_1}</Body>
    <Body top={14}>{HELD_BODY_2}</Body>
    <Body top={14}>{HELD_BODY_3}</Body>

    <div style={{ position: 'relative', flex: 1 }} />
    <div
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        paddingTop: 24,
      }}
    >
      <Brass full onClick={onClaim}>
        {HELD_CLAIM}
      </Brass>
      <TLink onClick={onBack}>{COPY.page.back}</TLink>
    </div>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * The passing is not open yet.
 *
 * The house pattern: one drawing, a short head, a plain body, one brass act
 * back to the piece. No prompt, no count, no blame, no locked door — the
 * piece is exactly as it was, and the screen says so.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Signed in, and the account's email has never been confirmed.
 *
 * This used to land on the no-account screen, which offered a signed-in
 * person two buttons that did nothing and never mentioned email. The
 * refusal is real; what was missing was saying so and opening the one
 * door that clears it.
 * ------------------------------------------------------------------ */

const VerifyEmail: React.FC<{ onBack?: () => void; onVerify?: () => void }> = ({
  onBack,
  onVerify,
}) => (
  <Ground light="c" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 150 }}>
      <Drawing motif="vault" size={104} draw />
    </div>
    <div style={{ position: 'relative', flex: 'none' }}>
      <Head size={34}>
        <Flag text={VERIFY_HEAD} />
      </Head>
    </div>
    <Body top={16}>{VERIFY_BODY}</Body>

    <div style={{ position: 'relative', flex: 1 }} />
    <div
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        paddingTop: 24,
      }}
    >
      <Brass full onClick={onVerify}>
        {VERIFY_PRIMARY}
      </Brass>
      <TLink onClick={onBack}>{COPY.page.back}</TLink>
    </div>
  </Ground>
);

const PassingNotYet: React.FC<{ onReturn?: () => void }> = ({ onReturn }) => (
  <Ground light="f" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 162 }}>
      <Drawing motif="hands" size={106} draw />
    </div>
    <div style={{ position: 'relative', flex: 'none' }}>
      <Head size={34}>
        <Flag text={NOTYET_HEAD} />
      </Head>
    </div>
    <Body top={16}>{NOTYET_BODY}</Body>

    <div style={{ position: 'relative', flex: 1 }} />
    <div
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 24,
      }}
    >
      <Brass full onClick={onReturn}>
        {COPY.page.back}
      </Brass>
    </div>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * The plate, permanent.
 *
 * Rebuilt per Adrian's ruling, 2026-08-20: "Plates are not replaced. It
 * always keeps the same number." The former screen narrated a reissue,
 * with two fabricated 'March 2025' ledger rows and a stub note describing
 * its own unfinished state. All three are gone. The real rule: one piece,
 * one code, forever; if a plate is ever damaged the same code is engraved
 * again, and the record never forks into two histories. The state key
 * ('plate') and this component's export name are unchanged so the not_ready
 * wiring in wired.tsx keeps compiling against it.
 * ------------------------------------------------------------------ */

// workbook: drafts, not yet read back to Adrian.
const PLATE_HEAD = ph('One piece, one number, forever.');
const PLATE_BODY = ph(
  'This piece carries a single code for as long as it exists. If its plate is ever damaged, the same code is engraved again, never a new one.',
);
const PLATE_NOTE = ph('The record never forks. One piece, one history, from the first plate to the last.');

const ReissuedPlate: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <Ground light="f" pad="52px 30px 30px">
    <div
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 14,
        borderBottom: `1px solid ${C.hairStrong}`,
        paddingBottom: 15,
      }}
    >
      <span style={{ fontFamily: F.display, fontWeight: 300, fontSize: 26, color: C.ink }}>
        {COPY.page.rowHistory}
      </span>
      <TLink onClick={onBack}>Back</TLink>
    </div>

    <p
      style={{
        position: 'relative',
        flex: 'none',
        margin: '22px 0 0',
        fontFamily: F.display,
        fontWeight: 300,
        fontSize: 24,
        lineHeight: 1.36,
        color: C.ink,
      }}
    >
      <Flag text={PLATE_HEAD} />
    </p>
    <Body top={16}>{PLATE_BODY}</Body>
    <Note top={22}>{PLATE_NOTE}</Note>

    <div style={{ position: 'relative', flex: 1 }} />
    <div style={{ position: 'relative', flex: 'none', paddingTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
      <Brass onClick={onBack}>{COPY.page.close}</Brass>
    </div>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * The connection dropped mid setup.
 *
 * People register pieces in garages and hallways. What was typed survives
 * on the phone and is shown back, so the screen is a receipt rather than a
 * failure.
 * ------------------------------------------------------------------ */

const Offline: React.FC<{
  onBack?: () => void;
  onRetry?: () => void;
  onLater?: () => void;
  receipt?: [string, string][];
}> = ({ onBack, onRetry = onBack, onLater = onBack, receipt }) => {
  const rows: [string, string][] = receipt ?? [
    ['Your name', 'Mara Ellis'],
    ['Where it lives', 'Lisbon, Portugal'],
  ];
  return (
  <Ground light="g" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 152 }}>
      <Drawing motif="letter" size={102} draw />
    </div>
    <div style={{ position: 'relative', flex: 'none' }}>
      <Head size={34}>{COPY.states.offlineHead}</Head>
    </div>
    <Body top={16}>{COPY.states.offlineBody}</Body>

    {rows.length > 0 && (
      <div
        style={{
          position: 'relative',
          flex: 'none',
          marginTop: 26,
          border: '1px solid rgba(237,233,226,.1)',
          borderRadius: 14,
          padding: '4px 20px',
          background: 'rgba(0,0,0,.16)',
        }}
      >
        {rows.map(([label, value]) => (
          <Ledger key={label} label={label} value={value} />
        ))}
      </div>
    )}

    <div style={{ position: 'relative', flex: 1 }} />
    <div
      style={{
        position: 'relative',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingTop: 24,
      }}
    >
      <TLink onClick={onLater}>{COPY.states.offlineLater}</TLink>
      <Brass onClick={onRetry}>
        {COPY.states.offlineRetry}
      </Brass>
    </div>
  </Ground>
  );
};

/* ------------------------------------------------------------------ *
 * The registry is off.
 *
 * While the flag is false, a scanned piece lands on the record that exists
 * today: what it is, how it was made, where it has been. No door, no error,
 * and no hint that a registry is coming.
 * ------------------------------------------------------------------ */

const RecordOnly: React.FC = () => (
  <Ground light="b" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <Eyebrow size={10}>{PIECE.series}</Eyebrow>
      <span style={{ fontFamily: F.display, fontWeight: 300, fontSize: 38, lineHeight: 1.05, color: C.ink }}>
        {PIECE.name}
      </span>
    </div>

    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 186 }}>
      <Drawing motif="piece" size={120} draw />
    </div>

    <div className="collector-scroll" style={{ position: 'relative', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <Ledger label="Series" value="Universal Language, 1 of 64" />
      <Ledger label="Made" value="2024" />
      <Ledger label="Material" value="Claro walnut, brass inlay" />
      <Ledger label="Identity" value="AR-7QK4M2PD" />
      <Body top={20}>{COPY.rooms.storyBody1}</Body>
      <div style={{ paddingTop: 20 }}>
        <a href="/" style={{ fontFamily: F.body, fontSize: 14, color: C.inkQuiet, textDecoration: 'none' }}>
          {COPY.page.siteLink}
        </a>
      </div>
    </div>
  </Ground>
);
