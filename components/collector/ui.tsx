/**
 * The collector journey's six interaction primitives, plus the ground they sit
 * on. Everything on every screen is built from these; nothing here invents a
 * token that is not in `tokens.ts`.
 *
 * The laws these encode:
 *   Rows open in place; links travel.
 *   Brass appears only on something you can act on, and never shifts with season.
 *   No icons, no emoji, no glyphs. Text and colour only for states.
 *   No count, bar, streak, badge, or any line that asks the caretaker for anything.
 */

import React from 'react';
import { BRASS_GLASS, C, F, GRAIN, SETUP_WASH, TOOTH, TRACK_GLASS, VIGNETTE } from './tokens';
import { isPlaceholder } from './copy';

/* ------------------------------------------------------------------ *
 * The ground
 * ------------------------------------------------------------------ */

type GroundProps = {
  /** which vignette from the design doc this screen was drawn with */
  light?: keyof typeof VIGNETTE;
  /** setup screens carry an extra warm wash under the vignette */
  wash?: boolean;
  /** the design doc's own padding for this screen kind */
  pad?: string;
  children: React.ReactNode;
};

/**
 * Laid paper, in the dark. Three layers in order: a woven grain, a dot tooth,
 * and a vignette that moves per screen so no two screens light identically.
 * Every layer is pointer-events:none so nothing here eats a tap.
 */
export const Ground: React.FC<GroundProps> = ({
  light = 'a',
  wash = false,
  pad = '52px 30px 30px',
  children,
}) => (
  <div style={{ position: 'absolute', inset: 0, background: C.ground, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.55, backgroundImage: GRAIN }} />
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: TOOTH, backgroundSize: '7px 7px' }} />
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: VIGNETTE[light] }} />
    {wash && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: SETUP_WASH }} />}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', padding: pad }}>
      {children}
    </div>
  </div>
);

/* ------------------------------------------------------------------ *
 * Type
 * ------------------------------------------------------------------ */

/** Karla, uppercase, tracked. Labels and eyebrows only. */
export const Eyebrow: React.FC<{ children: React.ReactNode; tone?: string; size?: number }> = ({
  children,
  tone = C.inkQuiet,
  size = 9.5,
}) => (
  <span
    style={{
      fontFamily: F.label,
      fontSize: size,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      color: tone,
    }}
  >
    {children}
  </span>
);

/** Cormorant, never under 20px. */
export const Head: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = 33 }) => (
  <h1
    style={{
      margin: 0,
      fontFamily: F.display,
      fontWeight: 300,
      fontSize: size,
      lineHeight: 1.1,
      letterSpacing: '-.015em',
      color: C.ink,
      textWrap: 'balance',
    }}
  >
    {children}
  </h1>
);

/** Lora. All body copy. */
export const Body: React.FC<{ children: React.ReactNode; tone?: string; size?: number; top?: number }> = ({
  children,
  tone = C.inkBody,
  size = 15,
  top = 0,
}) => (
  <p style={{ margin: `${top}px 0 0`, fontFamily: F.body, fontSize: size, lineHeight: 1.72, color: tone }}>
    <Flag text={children} />
  </p>
);

/** The quiet line under a field or a list. Never a prompt, never an ask. */
export const Note: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 0 }) => (
  <p
    style={{
      margin: `${top}px 0 0`,
      fontFamily: F.body,
      fontSize: 12.5,
      lineHeight: 1.66,
      color: C.inkQuiet,
    }}
  >
    <Flag text={children} />
  </p>
);

/**
 * Marks placeholder copy in dev with a hairline underline, so no unwritten line
 * can reach Adrian disguised as finished copy. Invisible in production.
 */
export const Flag: React.FC<{ text: React.ReactNode }> = ({ text }) => {
  if (typeof text !== 'string' || !isPlaceholder(text)) return <>{text}</>;
  return (
    <span
      title="Placeholder. Not Adrian's words yet."
      style={{ borderBottom: `1px dashed ${C.wrongEdge}`, paddingBottom: 1 }}
    >
      {text}
    </span>
  );
};

/* ------------------------------------------------------------------ *
 * The button, settled
 * ------------------------------------------------------------------ */

type BrassProps = {
  children: React.ReactNode;
  onClick?: () => void;
  full?: boolean;
  /** the arrival Begin is the only bright thing on an otherwise quiet page */
  lifted?: boolean;
};

/** Brass. The one thing on the screen you can act on. */
export const Brass: React.FC<BrassProps> = ({ children, onClick, full = false, lifted = false }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      ...BRASS_GLASS,
      width: full ? '100%' : undefined,
      minHeight: 48,
      padding: '0 34px',
      border: 0,
      borderRadius: 999,
      fontFamily: F.label,
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: '.16em',
      textTransform: 'uppercase',
      cursor: 'pointer',
      ...(lifted ? { boxShadow: '0 6px 22px -8px rgba(212,184,138,.5)' } : null),
    }}
  >
    {children}
  </button>
);

/** A text link. Plain, quiet, and it is how you leave. */
export const TLink: React.FC<{ children: React.ReactNode; onClick?: () => void; tone?: string }> = ({
  children,
  onClick,
  tone = C.inkQuiet,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: 'none',
      border: 0,
      cursor: 'pointer',
      fontFamily: F.body,
      fontSize: 13.5,
      color: tone,
      padding: '6px 4px',
    }}
  >
    {children}
  </button>
);

/** The foot every walked screen shares: a quiet way out, and the one brass act. */
export const Foot: React.FC<{ link?: React.ReactNode; children?: React.ReactNode }> = ({ link, children }) => (
  <div
    style={{
      position: 'relative',
      flex: 'none',
      marginTop: 'auto',
      paddingTop: 18,
      display: 'flex',
      alignItems: 'center',
      justifyContent: link ? 'space-between' : 'flex-end',
      gap: 16,
    }}
  >
    {link}
    {children}
  </div>
);

/* ------------------------------------------------------------------ *
 * Rows: they open in place, they never navigate
 * ------------------------------------------------------------------ */

export const Row: React.FC<{ label: string; onClick?: () => void; warm?: boolean; last?: boolean }> = ({
  label,
  onClick,
  warm = false,
  last = false,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="collector-row"
    style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 14,
      width: '100%',
      background: 'none',
      border: 0,
      borderTop: `1px solid ${C.hairMid}`,
      borderBottom: last ? `1px solid ${C.hairMid}` : undefined,
      padding: '14px 0',
      textAlign: 'left',
      cursor: 'pointer',
      fontFamily: F.body,
      fontSize: 15.5,
      color: warm ? C.inkWarm : C.inkBody,
    }}
  >
    <span>{label}</span>
    <span
      className="collector-chev"
      style={{
        fontFamily: F.label,
        fontSize: 9.5,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        color: '#5f574d',
      }}
    >
      Open
    </span>
  </button>
);

/** A choice row: a title and the sentence that separates it from the other. */
export const ChoiceRow: React.FC<{ title: string; note?: string; onClick?: () => void }> = ({
  title,
  note,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="collector-row"
    style={{
      display: 'block',
      width: '100%',
      background: 'none',
      border: 0,
      borderBottom: `1px solid ${C.hair}`,
      padding: '15px 0',
      textAlign: 'left',
      cursor: 'pointer',
    }}
  >
    <span style={{ display: 'block', fontFamily: F.body, fontSize: 16, color: C.ink }}>{title}</span>
    {note && (
      <span
        style={{
          display: 'block',
          paddingTop: 5,
          fontFamily: F.body,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: C.inkQuiet,
        }}
      >
        <Flag text={note} />
      </span>
    )}
  </button>
);

/** A ledger line: label left, value right, hairline above. */
export const Ledger: React.FC<{ label: string; value: React.ReactNode; warm?: boolean }> = ({
  label,
  value,
  warm = false,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 16,
      borderBottom: `1px solid ${C.hair}`,
      padding: '13px 0',
    }}
  >
    <span style={{ flex: 'none' }}>
      <Eyebrow>{label}</Eyebrow>
    </span>
    <span
      style={{
        fontFamily: F.body,
        fontSize: 14.5,
        color: warm ? C.inkWarm : C.inkBody,
        textAlign: 'right',
      }}
    >
      {value}
    </span>
  </div>
);

/* ------------------------------------------------------------------ *
 * Fields: lit, never boxed. The rule under the field holding the cursor
 * is the only light on the screen.
 * ------------------------------------------------------------------ */

export const Field: React.FC<{
  label: string;
  value?: string;
  hint?: string;
  lit?: boolean;
  onChange?: (v: string) => void;
}> = ({ label, value = '', hint, lit = false, onChange }) => (
  <label
    style={{
      flex: 1,
      minWidth: 0,
      position: 'relative',
      display: 'block',
      padding: '0 2px 11px',
      borderBottom: `1px solid ${lit ? 'transparent' : C.hairStrong}`,
      cursor: 'text',
    }}
  >
    {lit && (
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
    )}
    <span style={{ display: 'block' }}>
      <Eyebrow tone={lit ? C.brass : C.inkQuiet}>{label}</Eyebrow>
    </span>
    <input
      value={value}
      placeholder={hint}
      spellCheck={false}
      onChange={e => onChange?.(e.target.value)}
      style={{
        display: 'block',
        width: '100%',
        marginTop: 8,
        background: 'none',
        border: 0,
        outline: 0,
        padding: 0,
        fontFamily: F.body,
        fontSize: 16,
        color: C.ink,
      }}
    />
  </label>
);

/** A writing field. The same rule, given room. */
export const Area: React.FC<{
  value?: string;
  hint?: string;
  rows?: number;
  onChange?: (v: string) => void;
}> = ({ value = '', hint, rows = 4, onChange }) => (
  <div style={{ padding: '22px 2px 14px', borderBottom: `1px solid ${C.hairStrong}` }}>
    <textarea
      value={value}
      placeholder={hint}
      rows={rows}
      onChange={e => onChange?.(e.target.value)}
      style={{
        display: 'block',
        width: '100%',
        resize: 'none',
        background: 'none',
        border: 0,
        outline: 0,
        padding: 0,
        fontFamily: F.body,
        fontSize: 16.5,
        lineHeight: 1.72,
        color: C.ink,
      }}
    />
  </div>
);

/* ------------------------------------------------------------------ *
 * The two-way choice. The same object as the button.
 * ------------------------------------------------------------------ */

export const Capsule: React.FC<{
  options: [string, string];
  active: 0 | 1;
  onPick?: (i: 0 | 1) => void;
}> = ({ options, active, onPick }) => (
  <div style={{ ...TRACK_GLASS, display: 'flex', padding: 4, borderRadius: 999 }}>
    {options.map((label, i) => (
      <button
        key={label}
        type="button"
        onClick={() => onPick?.(i as 0 | 1)}
        style={{
          flex: 1,
          minHeight: 44,
          border: 0,
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: F.body,
          fontSize: 13,
          textAlign: 'center',
          ...(i === active ? BRASS_GLASS : { background: 'none', color: '#a1968a' }),
        }}
      >
        {label}
      </button>
    ))}
  </div>
);

/** A chip pair: the display grain, and anything else with two settled states. */
export const Chip: React.FC<{ label: string; on?: boolean; onClick?: () => void }> = ({
  label,
  on = false,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      border: `1px solid ${on ? C.brassEdge : C.hairStrong}`,
      borderRadius: 999,
      padding: '8px 16px',
      background: 'none',
      fontFamily: F.label,
      fontSize: 10,
      letterSpacing: '.12em',
      textTransform: 'uppercase',
      color: on ? C.brass : C.inkQuiet,
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
);

/**
 * A lamp: the What shows control. A real switch cut into the ground, lit when
 * it shows and dark when it is quiet. Text carries the state; the lamp is the
 * material, not the label.
 */
export const Lamp: React.FC<{
  title: string;
  note: string;
  on: boolean;
  fixed?: boolean;
  fixedWord?: string;
  onToggle?: () => void;
}> = ({ title, note, on, fixed = false, fixedWord, onToggle }) => (
  <div
    onClick={fixed ? undefined : onToggle}
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) 74px',
      alignItems: 'center',
      gap: 14,
      margin: '0 -12px',
      padding: '17px 16px',
      borderRadius: 9,
      cursor: fixed ? 'default' : 'pointer',
      position: 'relative',
      overflow: 'hidden',
      ...(fixed
        ? { boxShadow: `inset 0 0 0 1px rgba(237,233,226,.06)` }
        : {
            background: on
              ? 'linear-gradient(180deg,#17130f 0%,#0d0b09 100%)'
              : 'linear-gradient(180deg,#141210 0%,#0b0a08 100%)',
            boxShadow: on
              ? 'inset 0 1px 0 rgba(237,233,226,.08),inset 0 -1px 0 rgba(0,0,0,.9),0 1px 2px rgba(0,0,0,.6)'
              : 'inset 0 1px 0 rgba(237,233,226,.05),inset 0 -1px 0 rgba(0,0,0,.9),0 1px 2px rgba(0,0,0,.55)',
          }),
    }}
  >
    {!fixed && (
      <span
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          opacity: 0.5,
          backgroundImage: 'repeating-linear-gradient(90deg,rgba(237,233,226,.035) 0 1px,transparent 1px 3px)',
          display: 'block',
        }}
      />
    )}
    <div style={{ minWidth: 0, position: 'relative' }}>
      <div style={{ fontFamily: F.body, fontSize: 15, color: on && !fixed ? C.inkWarm : C.ink }}>{title}</div>
      <div
        style={{
          fontFamily: F.body,
          fontSize: 12.5,
          lineHeight: 1.55,
          color: on && !fixed ? 'rgba(242,227,196,.62)' : C.inkQuiet,
          paddingTop: 5,
        }}
      >
        {note}
      </div>
    </div>
    {fixed ? (
      <span style={{ textAlign: 'right' }}>
        <Eyebrow size={9}>{fixedWord}</Eyebrow>
      </span>
    ) : (
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9 }}>
        <Eyebrow size={8.5} tone={on ? C.brass : C.inkQuiet}>
          {on ? 'shows' : 'quiet'}
        </Eyebrow>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            background: 'radial-gradient(circle at 50% 30%,#221d19 0%,#0a0907 100%)',
            boxShadow: on
              ? 'inset 0 1px 1px rgba(237,233,226,.14),inset 0 -1px 2px rgba(0,0,0,.95),0 1px 0 rgba(237,233,226,.05),0 0 18px rgba(212,184,138,.5)'
              : 'inset 0 1px 1px rgba(237,233,226,.14),inset 0 -1px 2px rgba(0,0,0,.95),0 1px 0 rgba(237,233,226,.05)',
          }}
        >
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: '50%',
              display: 'block',
              background: on
                ? 'radial-gradient(circle at 38% 30%,#fbf1da 0%,#e2c493 38%,#c4aa7c 62%,#8a6f42 100%)'
                : 'radial-gradient(circle at 38% 30%,#332e28 0%,#1a1714 55%,#0d0b09 100%)',
              boxShadow: on
                ? '0 0 10px rgba(212,184,138,.95),0 0 3px rgba(255,247,229,.8)'
                : 'inset 0 1px 1px rgba(0,0,0,.9)',
            }}
          />
        </span>
      </span>
    )}
  </div>
);

/* ------------------------------------------------------------------ *
 * A room: the header every opened row wears
 * ------------------------------------------------------------------ */

export const RoomHead: React.FC<{ title: string; onBack?: () => void }> = ({ title, onBack }) => (
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
    <span style={{ fontFamily: F.display, fontWeight: 300, fontSize: 26, color: C.ink }}>{title}</span>
    <button
      type="button"
      onClick={onBack}
      style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, color: C.inkQuiet }}
    >
      Back
    </button>
  </div>
);

/** The scrolling body of a room. Rooms may scroll; setup screens never do. */
export const RoomBody: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 16 }) => (
  <div
    style={{
      position: 'relative',
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      scrollbarWidth: 'none',
      paddingTop: top,
    }}
  >
    {children}
  </div>
);

/** The plus that opens an add-another. Not an icon: a typed character. */
export const Plus: React.FC = () => (
  <span
    style={{
      ...BRASS_GLASS,
      flex: 'none',
      width: 28,
      height: 28,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      fontFamily: F.label,
      fontSize: 14,
      lineHeight: 1,
    }}
  >
    +
  </span>
);

export const Spacer: React.FC = () => <div style={{ position: 'relative', flex: 1 }} />;
