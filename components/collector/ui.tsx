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

import { espresso } from '../ceremony/tokens';
import { createCeremonyUI } from '../ceremony/ui';
import { isPlaceholder } from './copy';

const kit = createCeremonyUI(espresso, { isPlaceholder });

export const {
  Ground,
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
