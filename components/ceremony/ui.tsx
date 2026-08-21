/**
 * The ceremony kit's six interaction primitives, plus the ground they sit on.
 * Everything on every ceremony screen is built from these; nothing here
 * invents a value that is not in the theme from `tokens.ts`.
 *
 * The kit dresses two kinds of room, told apart by `Ground`'s `cut`. A frame
 * is the phone: one question per screen, a fixed height, nothing scrolls but a
 * room's own body. A run is the desk: a flowing page of lists and work, read
 * in daylight, that scrolls like a page because it is one.
 *
 * The laws these encode:
 *   Rows open in place; links travel.
 *   Brass appears only on something you can act on, and never shifts with
 *   season. A desk holds the same law by other means: one brass act per shelf,
 *   and every equal neighbour wears Quiet, the same pill cut in hairline.
 *   No icons, no emoji, no glyphs. Text and colour only for states, and the
 *   word always carries the meaning; the colour only agrees with it.
 *   Counts belong to the desk. The old law said no count, bar, streak, or
 *   badge, because a count is a demand, and the collector is never asked for
 *   anything. That reason still stands, so a frame never shows one. But the
 *   desk exists to tell Adrian how much work is waiting, and hiding the number
 *   from the person the number is for would be piety, not care. Counts are
 *   allowed in a run, never in a frame.
 *   Fields are lit in a frame, boxed in a run. When a screen asks one
 *   question, the lit rule is the only light on the screen and that is the
 *   point. A desk page holds fourteen fields, and fourteen lights is no light
 *   at all, so on the desk a field takes a plain hairline box and keeps quiet.
 *   In a run, the page scrolls, never a child. No admin surface nests a
 *   RoomBody inside a run's ground. Two scroll containers on one desk means
 *   the reader has to find the right one before reading, and that is the
 *   thing being forbidden.
 *
 * The primitives are built by `createCeremonyUI(theme)`, so the same set can
 * be dressed by a sibling theme later. Today there is one theme, espresso, and
 * `components/collector/ui.tsx` applies it; the artist-side registration
 * ceremony applies the same one. The class-name hooks (`collector-row`,
 * `collector-chev`, `collector-ph`) are the kit's own, matched by the kit's
 * stylesheet in `styles.tsx`; they keep their historical names so the DOM the
 * collector walk renders does not change.
 */

import React from 'react';
import type { CeremonyTheme } from './tokens';

export type CeremonyUIOptions = {
  /**
   * Marks unwritten copy: given a rendered string, says whether it is a
   * placeholder rather than settled words. The collector passes its copy
   * table's `isPlaceholder`; a surface with no placeholder system passes
   * nothing and `Flag` renders every string plain.
   */
  isPlaceholder?: (text: string) => boolean;

  /**
   * Raises the floor under the quietest type. The collector's defaults, 9.5px
   * Karla in inkQuiet, were drawn for a phone held close at night, and briefly
   * they read. A desk of twenty admin routes read in daylight is a different
   * room, and the same ink at the same size fails there. The sizes are inline
   * styles, so no stylesheet outside can reach them; the raise has to come in
   * here, as an option. A surface that passes nothing keeps the collector's
   * defaults exactly.
   */
  label?: { size: number; tone: string };
};

/**
 * The ground's props, exported so a surface that wraps `Ground` (the registry
 * kit does) can forward every prop the ground knows, including ones added
 * after the wrapper was written. A wrapper that re-declares this type by hand
 * silently drops whatever it did not know about.
 */
export type GroundProps = {
  /** which vignette from the design doc this screen was drawn with */
  light?: string;
  /** setup screens carry an extra warm wash under the vignette */
  wash?: boolean;
  /** the design doc's own padding for this screen kind */
  pad?: string;
  /**
   * Which kind of room this ground dresses. A frame is the phone: the ground
   * fills a positioned, fixed-height ancestor and nothing scrolls. A run is
   * the desk: the ground is a flowing page that grows with its work and
   * scrolls as one. The paper is the same either way.
   */
  cut?: 'frame' | 'run';
  children: React.ReactNode;
};

export const createCeremonyUI = (theme: CeremonyTheme, opts: CeremonyUIOptions = {}) => {
  const { palette: C, fonts: F } = theme;
  const isPlaceholder = opts.isPlaceholder ?? (() => false);
  const labelSize = opts.label?.size ?? 9.5;
  const labelTone = opts.label?.tone ?? theme.palette.inkQuiet;

  /* ------------------------------------------------------------------ *
   * The ground
   * ------------------------------------------------------------------ */

  /**
   * Laid paper, in the dark. Three layers in order: a woven grain, a dot tooth,
   * and a vignette that moves per screen so no two screens light identically.
   * Every layer is pointer-events:none so nothing here eats a tap.
   *
   * A frame cut is the phone: absolute inside a positioned, fixed-height
   * ancestor, its column pinned to the frame so `Spacer` and `Foot` divide the
   * height between them. A run cut is the desk: the shell sits in the page's
   * own flow and grows with its work, the paper layers stay absolute inside it
   * so they cover the whole run, and the column simply flows. In a run there
   * is no fixed height to divide, so `Spacer` grows nothing and `Foot`'s auto
   * margin resolves to zero; both stand harmless rather than breaking.
   */
  const Ground: React.FC<GroundProps> = ({
    light = 'a',
    wash = false,
    pad = '52px 30px 30px',
    cut = 'frame',
    children,
  }) => (
    <div
      style={{
        ...(cut === 'run'
          ? { position: 'relative' as const, minHeight: '100%' }
          : { position: 'absolute' as const, inset: 0 }),
        background: C.ground,
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.55, backgroundImage: theme.grain }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: theme.tooth, backgroundSize: '7px 7px' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: theme.vignettes[light] }} />
      {wash && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: theme.setupWash }} />}
      <div
        style={{
          ...(cut === 'run' ? { position: 'relative' as const } : { position: 'absolute' as const, inset: 0 }),
          display: 'flex',
          flexDirection: 'column',
          padding: pad,
        }}
      >
        {children}
      </div>
    </div>
  );

  /* ------------------------------------------------------------------ *
   * Type
   * ------------------------------------------------------------------ */

  /** Karla, uppercase, tracked. Labels and eyebrows only. The defaults are
   *  the collector's unless the surface raised the floor with `opts.label`. */
  const Eyebrow: React.FC<{ children: React.ReactNode; tone?: string; size?: number }> = ({
    children,
    tone = labelTone,
    size = labelSize,
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

  /** Cormorant, never under 20px. A frame shows one heading, so `h1` is the
   *  default; a run is a document with sections, and a second `h1` on the
   *  same page breaks the heading order for anyone reading by outline, so
   *  the desk passes `as`. `size` also takes a string, so a run can hand the
   *  heading a clamp() and let it breathe with the window. */
  const Head: React.FC<{
    children: React.ReactNode;
    size?: number | string;
    as?: 'h1' | 'h2' | 'h3';
  }> = ({ children, size = 33, as: As = 'h1' }) => (
    <As
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
    </As>
  );

  /**
   * Marks unwritten copy with a hairline underline, so no placeholder can reach
   * Adrian disguised as finished copy.
   *
   * The span is always rendered; whether the underline shows is decided by
   * `data-marks` on the ceremony root, so a reviewer can switch it off mid walk
   * and read the screens as a visitor would, at no re-render cost.
   */
  const Flag: React.FC<{ text: React.ReactNode }> = ({ text }) => {
    if (typeof text !== 'string' || !isPlaceholder(text)) return <>{text}</>;
    return (
      <span className="collector-ph" title="Placeholder. Not Adrian's words yet.">
        {text}
      </span>
    );
  };

  /** Lora. All body copy. */
  const Body: React.FC<{ children: React.ReactNode; tone?: string; size?: number; top?: number }> = ({
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
  const Note: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 0 }) => (
    <p
      style={{
        margin: `${top}px 0 0`,
        fontFamily: F.body,
        fontSize: 12.5,
        lineHeight: 1.66,
        color: labelTone,
      }}
    >
      <Flag text={children} />
    </p>
  );

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
  const Brass: React.FC<BrassProps> = ({ children, onClick, full = false, lifted = false }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...theme.brassGlass,
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

  /**
   * The same pill as Brass, cut in hairline. This is how the one-brass law
   * survives the desk: a shelf full of equal acts keeps brass for the one
   * that matters and dresses the rest in Quiet, so the eye still lands where
   * it should. `danger` wears the theme's one error tone, because a desk has
   * destructive acts a phone walk never had, and a destructive act should
   * look like what it is before it is pressed.
   */
  const Quiet: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    full?: boolean;
    danger?: boolean;
  }> = ({ children, onClick, full = false, danger = false }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: `1px solid ${danger ? C.wrongEdge : C.hairStrong}`,
        color: danger ? C.wrong : C.inkBody,
        width: full ? '100%' : undefined,
        minHeight: 48,
        padding: '0 34px',
        borderRadius: 999,
        fontFamily: F.label,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );

  /** A text link. Plain, quiet, and it is how you leave. */
  const TLink: React.FC<{ children: React.ReactNode; onClick?: () => void; tone?: string }> = ({
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
  const Foot: React.FC<{ link?: React.ReactNode; children?: React.ReactNode }> = ({ link, children }) => (
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

  /**
   * Foot, inverted: the same shelf of acts, standing at the top of its work
   * instead of pinned to the bottom of a frame. A run has no fixed height for
   * an auto margin to push against, so the desk's toolbar simply sits where
   * it is put and keeps Foot's arrangement, the quiet way out on the left and
   * the acts on the right.
   */
  const Deck: React.FC<{ link?: React.ReactNode; children?: React.ReactNode }> = ({ link, children }) => (
    <div
      style={{
        position: 'relative',
        flex: 'none',
        paddingBottom: 18,
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

  const Row: React.FC<{ label: string; onClick?: () => void; warm?: boolean; last?: boolean }> = ({
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
  const ChoiceRow: React.FC<{ title: string; note?: string; onClick?: () => void }> = ({
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
  const Ledger: React.FC<{ label: string; value: React.ReactNode; warm?: boolean }> = ({
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

  /**
   * A status word. The word carries the meaning entirely; the tone only
   * agrees with it, so nothing here is said by colour alone. Four tones,
   * all already in the theme: quiet for the ordinary, warm for something a
   * person placed, brass for something waiting on Adrian, and the theme's
   * one error tone for something wrong. No new colour, because a desk that
   * invents a fifth state colour has stopped being this room.
   */
  const State: React.FC<{
    children: React.ReactNode;
    tone?: 'quiet' | 'warm' | 'brass' | 'wrong';
  }> = ({ children, tone = 'quiet' }) => (
    <Eyebrow
      tone={{ quiet: labelTone, warm: C.inkWarm, brass: C.brass, wrong: C.wrong }[tone]}
    >
      {children}
    </Eyebrow>
  );

  type LineProps = {
    title: string;
    /** the quiet second line: a date, a code, a place */
    meta?: React.ReactNode;
    /** a State, standing before the action word */
    state?: React.ReactNode;
    /** the uppercase word on the right that says what opening does */
    act?: string;
    /**
     * What to render as. A desk list is made of links that travel, so a
     * router's Link can be handed in here with its own props alongside;
     * the kit stays ignorant of the router. The default is the button the
     * phone's rows always were.
     */
    as?: React.ElementType;
    onClick?: () => void;
    warm?: boolean;
    last?: boolean;
  } & Record<string, unknown>;

  /**
   * The desk's row. Every list in the back end is this shape: a title, some
   * quiet meta under it, sometimes a state word, and one uppercase word on
   * the right naming the act. Not a table; a desk does not need a table, it
   * needs a line per thing. Wears the same `collector-row` class as Row, so
   * the hover-to-brass rule in the kit's stylesheet reaches it for free.
   */
  const Line: React.FC<LineProps> = ({
    title,
    meta,
    state,
    act = 'Open',
    as: As = 'button',
    onClick,
    warm = false,
    last = false,
    ...rest
  }) => (
    <As
      {...(As === 'button' ? { type: 'button' } : null)}
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
        textAlign: 'left' as const,
        cursor: 'pointer',
        textDecoration: 'none',
        fontFamily: F.body,
        fontSize: 15.5,
        color: warm ? C.inkWarm : C.inkBody,
      }}
      {...rest}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block' }}>{title}</span>
        {meta && (
          <span
            style={{
              display: 'block',
              paddingTop: 5,
              fontFamily: F.body,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: labelTone,
            }}
          >
            {meta}
          </span>
        )}
      </span>
      <span style={{ flex: 'none', display: 'flex', alignItems: 'baseline', gap: 14 }}>
        {state}
        <span
          className="collector-chev"
          style={{
            fontFamily: F.label,
            fontSize: labelSize,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: labelTone,
          }}
        >
          {act}
        </span>
      </span>
    </As>
  );

  /* ------------------------------------------------------------------ *
   * Fields: lit, never boxed. The rule under the field holding the cursor
   * is the only light on the screen.
   * ------------------------------------------------------------------ */

  const Field: React.FC<{
    label: string;
    value?: string;
    hint?: string;
    lit?: boolean;
    /** the input's HTML type; defaults to the plain text field this always was */
    type?: string;
    /** the input's autoComplete hint; absent by default, exactly as before */
    autoComplete?: string;
    onChange?: (v: string) => void;
  }> = ({ label, value = '', hint, lit = false, type = 'text', autoComplete, onChange }) => (
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
        type={type}
        autoComplete={autoComplete}
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
  const Area: React.FC<{
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

  const Capsule: React.FC<{
    options: [string, string];
    active: 0 | 1;
    onPick?: (i: 0 | 1) => void;
  }> = ({ options, active, onPick }) => (
    <div style={{ ...theme.trackGlass, display: 'flex', padding: 4, borderRadius: 999 }}>
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
            ...(i === active ? theme.brassGlass : { background: 'none', color: '#a1968a' }),
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  /** A chip pair: the display grain, and anything else with two settled states. */
  const Chip: React.FC<{ label: string; on?: boolean; onClick?: () => void }> = ({
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
  const Lamp: React.FC<{
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

  /** The header every opened row wears. Back renders only when there is a
   *  back to go to; a desk page that is its own destination passes none and
   *  gets no dead control. `aside` holds whatever belongs on the right in
   *  Back's place or beside it, a state word, a quiet act. */
  const RoomHead: React.FC<{
    title: string;
    onBack?: () => void;
    aside?: React.ReactNode;
  }> = ({ title, onBack, aside }) => (
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
      {aside}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{ background: 'none', border: 0, cursor: 'pointer', fontFamily: F.body, fontSize: 13.5, color: C.inkQuiet }}
        >
          Back
        </button>
      )}
    </div>
  );

  /** The scrolling body of a room. Rooms may scroll; setup screens never do. */
  const RoomBody: React.FC<{ children: React.ReactNode; top?: number }> = ({ children, top = 16 }) => (
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
  const Plus: React.FC = () => (
    <span
      style={{
        ...theme.brassGlass,
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

  const Spacer: React.FC = () => <div style={{ position: 'relative', flex: 1 }} />;

  return {
    Ground,
    Eyebrow,
    Head,
    Body,
    Note,
    Flag,
    Brass,
    Quiet,
    TLink,
    Foot,
    Deck,
    Row,
    Line,
    State,
    ChoiceRow,
    Ledger,
    Field,
    Area,
    Capsule,
    Chip,
    Lamp,
    RoomHead,
    RoomBody,
    Plus,
    Spacer,
  };
};

export type CeremonyUI = ReturnType<typeof createCeremonyUI>;
