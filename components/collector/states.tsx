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
import { COPY, PIECE } from './copy';
import { Body, Brass, Eyebrow, Ground, Head, Ledger, Note, TLink } from './ui';
import { Drawing } from './drawings';

export type StateKey = 'account' | 'held' | 'plate' | 'offline' | 'recordonly';

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
  if (state === 'held') return <AlreadyHeld onBack={onBack} />;
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
      }}
    >
      <Eyebrow size={9.5}>{COPY.states.accountHeld}</Eyebrow>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
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
 * piece is held and offers the one path that can settle it. Nothing about
 * who holds it. The sacred rule: the code alone never transfers ownership.
 * ------------------------------------------------------------------ */

const AlreadyHeld: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
  <Ground light="e" pad="52px 30px 30px">
    <div style={{ position: 'relative', flex: 'none', display: 'grid', placeItems: 'center', height: 162 }}>
      <Drawing motif="hands" size={106} draw />
    </div>
    <div style={{ position: 'relative', flex: 'none' }}>
      <Head size={34}>{COPY.states.heldHead}</Head>
    </div>
    <Body top={16}>{COPY.states.heldBody}</Body>
    <Body top={14}>{COPY.states.heldBody2}</Body>

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
      <Brass full onClick={onBack}>
        {COPY.states.heldWrite}
      </Brass>
      <TLink onClick={onBack}>{COPY.page.back}</TLink>
    </div>
  </Ground>
);

/* ------------------------------------------------------------------ *
 * A reissued plate.
 *
 * The plate was replaced, so an older code still resolves. The record is
 * the same record. This screen says the plate changed, never that the
 * piece is wrong, and the change belongs in the public history.
 * ------------------------------------------------------------------ */

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
      {COPY.states.plateHead}
    </p>
    <Body top={16}>{COPY.states.plateBody}</Body>

    <div style={{ position: 'relative', flex: 'none', paddingTop: 26 }}>
      <Ledger label="March 2025" value="First plate, retired" />
      <Ledger label="March 2025" value="Second plate, on the piece" />
      <Note top={18}>{COPY.states.plateNote}</Note>
    </div>

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
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        paddingTop: 24,
      }}
    >
      <Brass full onClick={onRetry}>
        {COPY.states.offlineRetry}
      </Brass>
      <TLink onClick={onLater}>{COPY.states.offlineLater}</TLink>
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
