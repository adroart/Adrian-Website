/**
 * The registration ceremony's kit: the shared ceremony primitives dressed in
 * the espresso theme, exactly as the collector walk wears them, plus the one
 * primitive the artist side needs that the collector never did: a secret
 * field whose characters never show.
 *
 * Nothing here invents a value that is not in `components/ceremony/tokens.ts`.
 */

import React from 'react';
import { espresso } from '../ceremony/tokens';
import { createCeremonyUI } from '../ceremony/ui';

export const theme = espresso;
export const C = espresso.palette;
export const F = espresso.fonts;

export const {
  Ground,
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
  Capsule,
  RoomHead,
  RoomBody,
  Spacer,
} = createCeremonyUI(espresso);

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
