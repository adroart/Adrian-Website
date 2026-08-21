/**
 * The registration ceremony's kit: the shared ceremony primitives dressed in
 * the espresso theme, exactly as the collector walk wears them, plus the two
 * primitives the artist side needs that the collector never did: a secret
 * field whose characters never show, and the frame the ceremony sits in.
 *
 * The frame matters because this ceremony is ARTIST-side. The collector meets
 * the walk on a phone, so `components/collector/CollectorShell.tsx` renders a
 * literal 390 by 844 phone and that is honest. Registration happens at the
 * desk, in the admin studio, on whatever window Adrian has open. It is one
 * design, not two: the same screens, the same wording, the same order. Only
 * the viewable area changes. `CeremonyFrame` is that one frame, and `Ground`
 * below is wrapped so the reading column stays a readable measure however wide
 * the window gets, rather than the type stretching to the frame's edge.
 *
 * Nothing here invents a value that is not in `components/ceremony/tokens.ts`.
 */

import React from 'react';
import { espresso } from '../ceremony/tokens';
import { createCeremonyUI, type GroundProps } from '../ceremony/ui';
import { CeremonyStyles } from '../ceremony/styles';

export const theme = espresso;
export const C = espresso.palette;
export const F = espresso.fonts;

const ui = createCeremonyUI(espresso);

export const {
  Eyebrow,
  Head,
  Body,
  Note,
  Brass,
  TLink,
  Foot,
  Row,
  ChoiceRow,
  Ledger,
  Field,
  Area,
  Capsule,
  RoomHead,
  RoomBody,
  Spacer,
} = ui;

const BaseGround = ui.Ground;

/**
 * The ceremony ground, with one addition the collector's copy does not need:
 * the screen's flex column is centred and capped at `--ceremony-measure`, the
 * variable the frame sets per viewport. On a phone the measure is the whole
 * width and this is byte-identical to the bare ground. On a desk the frame
 * widens, the measure holds the line length where it was drawn, and the extra
 * width becomes air on both sides instead of longer lines.
 *
 * The wrapper takes over as the flex item so `Spacer` (flex: 1) and `RoomBody`
 * (flex: 1, its own scroll) keep working exactly as they did.
 *
 * The prop type is the kit's own exported `GroundProps`, never re-declared
 * here, so every prop the ground learns (the `cut` that turns it into a desk
 * run, whatever comes after) passes through this wrapper untouched instead of
 * being silently dropped by a stale local copy.
 */
export const Ground: React.FC<GroundProps> = ({ children, ...rest }) => (
  <BaseGround {...rest}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        maxWidth: 'var(--ceremony-measure, 100%)',
        marginInline: 'auto',
      }}
    >
      {children}
    </div>
  </BaseGround>
);

/**
 * The stage and the frame the ceremony is played on, shared by
 * `RegisterCeremony` and `AddToPiece` so the two can never drift apart.
 *
 * One frame, three viewable areas. Under 768 it is the phone card the design
 * was drawn as. Past 768 the card grows into the studio window and the reading
 * measure holds. Past 1180 it grows once more and stops: a ceremony that asks
 * one question per screen has no use for a 1600-wide box, and letting it fill
 * one would flatter the design dishonestly.
 */
export const CeremonyFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="collector-root ceremony-stage" data-marks="0">
    <CeremonyStyles />
    <style>{`
      .ceremony-stage {
        display: flex;
        justify-content: center;
        padding: 20px 0 44px;
      }
      .ceremony-frame {
        position: relative;
        overflow: hidden;
        width: 100%;
        max-width: 390px;
        height: min(780px, max(640px, calc(100vh - 150px)));
        border-radius: 24px;
        background: ${C.ground};
        border: 1px solid ${C.hairStrong};
        box-shadow: 0 32px 64px -24px rgba(0,0,0,.55);
        --ceremony-measure: 100%;
      }
      @media (min-width: 768px) {
        .ceremony-stage { padding: 26px 20px 52px }
        .ceremony-frame {
          max-width: 720px;
          height: min(840px, max(640px, calc(100vh - 170px)));
          --ceremony-measure: 470px;
        }
      }
      @media (min-width: 1180px) {
        .ceremony-frame {
          max-width: 900px;
          height: min(880px, max(660px, calc(100vh - 180px)));
          --ceremony-measure: 520px;
        }
      }
    `}</style>
    <div className="ceremony-frame">{children}</div>
  </div>
);

/**
 * The registry secret, lit like every other field but never echoed: the same
 * hairline-and-rule shape as the kit's Field with a password input inside.
 */
export const SecretField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label
    style={{
      position: 'relative',
      display: 'block',
      padding: '0 2px 11px',
      borderBottom: 'transparent',
      cursor: 'text',
    }}
  >
    <span
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 1.5,
        background: `linear-gradient(90deg,${C.brass},rgba(212,184,138,.15))`,
        boxShadow: '0 0 14px rgba(212,184,138,.55)',
        display: 'block',
      }}
    />
    <span style={{ display: 'block' }}>
      <Eyebrow tone={C.brass}>{label}</Eyebrow>
    </span>
    <input
      type="password"
      value={value}
      autoComplete="off"
      spellCheck={false}
      onChange={event => onChange(event.target.value)}
      style={{
        display: 'block',
        width: '100%',
        marginTop: 8,
        background: 'none',
        border: 0,
        outline: 0,
        padding: 0,
        fontFamily: F.mono,
        fontSize: 16,
        color: C.ink,
      }}
    />
  </label>
);

/** The revealed Ownership Code: mono, selectable, and nothing else near it. */
export const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <p
    style={{
      margin: '14px 0 0',
      fontFamily: F.mono,
      fontSize: 17,
      letterSpacing: '.06em',
      lineHeight: 1.6,
      color: C.inkWarm,
      overflowWrap: 'anywhere',
      userSelect: 'all',
    }}
  >
    {children}
  </p>
);
