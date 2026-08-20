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

export const Ground: React.FC<GroundProps> = ({ tint = null, children, ...rest }) => {
  if (!tint) return <KitGround {...rest}>{children}</KitGround>;
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
        {children}
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
