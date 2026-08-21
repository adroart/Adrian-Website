/**
 * The collector journey's six interaction primitives, plus the ground they sit
 * on: the shared ceremony kit, dressed in the espresso theme and told about
 * this surface's placeholder marks. Everything on every screen is built from
 * these; nothing here invents a token that is not in `tokens.ts`.
 *
 * The implementations live in `components/ceremony/ui.tsx`, so the artist-side
 * registration ceremony builds from the same primitives. This file only
 * applies the theme; the rendered output is unchanged.
 *
 * The laws these encode:
 *   Rows open in place; links travel.
 *   Brass appears only on something you can act on, and never shifts with season.
 *   No icons, no emoji, no glyphs. Text and colour only for states.
 *   No count, bar, streak, badge, or any line that asks the caretaker for anything.
 */

import React from 'react';
import { espresso } from '../ceremony/tokens';
import { createCeremonyUI } from '../ceremony/ui';
import { isPlaceholder } from './copy';
import { C, F } from './tokens';

const kit = createCeremonyUI(espresso, { isPlaceholder });

/* ------------------------------------------------------------------ *
 * The ground's tint: the GROUND axis made visible (utils/collectorGround.ts,
 * wording record §6 "Season, hour, and the birthday month"). The reading
 * arrives as two CSS custom properties, --ground-warmth (0..1) and
 * --ground-hue (degrees), set on the page Ground and consumed here as a
 * faint warm wash under everything — background warmth and hue ONLY. Brass
 * never shifts: nothing below touches the kit's brass, and the tint's
 * ceiling (a few percent of alpha) keeps it a tint, never a takeover.
 * ------------------------------------------------------------------ */

const KitGround = kit.Ground;

type GroundProps = React.ComponentProps<typeof KitGround> & {
  /** the composed GROUND reading; null or absent renders the kit ground untouched */
  tint?: { warmth: number; hueShiftDeg: number } | null;
};

const GROUND_BASE_HUE_DEG = 36; // the espresso room's own amber

/**
 * The reading column.
 *
 * Every screen in the journey was drawn at 390 wide, and a line of type set
 * across a 1900-wide desk is not that drawing made bigger, it is a different
 * and worse one. So the ground fills whatever screen it is given and the words
 * hold a measure inside it, centred. `--cc-measure` is undefined at phone
 * width, the fallback is the full width the screens already used, and nothing
 * about the phone changes.
 *
 * The piece page is exempt: it has a drawing of its own at desk width and sets
 * its own measures (see display.tsx). The frame withholds `--cc-measure` from
 * it rather than this file knowing which screen it is holding.
 */
const Column: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: 'var(--cc-measure,100%)',
      marginInline: 'auto',
    }}
  >
    {children}
  </div>
);

export const Ground: React.FC<GroundProps> = ({ tint = null, children, ...rest }) => {
  if (!tint) return <KitGround {...rest}><Column>{children}</Column></KitGround>;
  const vars = {
    '--ground-warmth': String(Math.min(1, Math.max(0, tint.warmth))),
    '--ground-hue': String(GROUND_BASE_HUE_DEG + tint.hueShiftDeg),
  } as React.CSSProperties;
  return (
    <div style={{ position: 'absolute', inset: 0, ...vars }}>
      <KitGround {...rest}>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(120% 100% at 50% 100%,' +
              ' hsla(var(--ground-hue), 42%, 46%, calc(var(--ground-warmth) * 0.09)) 0%,' +
              ' hsla(var(--ground-hue), 42%, 46%, calc(var(--ground-warmth) * 0.035)) 55%,' +
              ' transparent 100%)',
          }}
        />
        <Column>{children}</Column>
      </KitGround>
    </div>
  );
};

export const {
  Eyebrow,
  Head,
  Body,
  Note,
  Flag,
  Brass,
  TLink,
  Foot,
  Row,
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
} = kit;

/**
 * SegmentedTabs: the pill toggle lifted verbatim from the history room's tab
 * strip (rooms.tsx's HistoryRoom, before this extraction), so any screen that
 * needs a two-or-more-way segmented choice wears the same glass instead of
 * re-deriving it. Options and the active index are the only inputs; callers
 * own the labels and where the state lives. Built from plain buttons, so
 * keyboard reach and the shared `.collector-root :focus-visible` ring (see
 * ceremony/styles.tsx) come for free.
 */
export const SegmentedTabs: React.FC<{
  options: string[];
  active: number;
  onChange: (i: number) => void;
}> = ({ options, active, onChange }) => (
  <div
    style={{
      display: 'flex',
      padding: 4,
      borderRadius: 999,
      background: 'rgba(52,43,34,.34)',
      backdropFilter: 'blur(30px) saturate(140%)',
      boxShadow: 'inset 0 0 0 1px rgba(237,233,226,.06)',
    }}
  >
    {options.map((label, i) => (
      <button
        key={label}
        type="button"
        onClick={() => onChange(i)}
        style={{
          flex: 1,
          border: 0,
          borderRadius: 999,
          padding: '10px 12px',
          cursor: 'pointer',
          fontFamily: F.label,
          fontSize: 10,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          background: i === active ? 'rgba(212,170,110,.13)' : 'none',
          boxShadow:
            i === active
              ? 'inset 0 .5px 0 rgba(255,244,220,.18),inset 0 0 0 1px rgba(226,190,134,.11)'
              : undefined,
          color: i === active ? C.inkBrass : '#a1968a',
        }}
      >
        {label}
      </button>
    ))}
  </div>
);
