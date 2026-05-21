import type { ProfileKey, ProfileSequence } from '../lib/astrology/types';

export interface ProfilePositionMeta {
  key: ProfileKey;
  sequence: ProfileSequence;
  label: string;
  planet: 'sun' | 'earth' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter';
  side: 'persona' | 'design';
  /**
   * Anatomical anchor reserved for Adrian to fill in. Empty strings are
   * rendered as just the position label.
   */
  body: string;
  /** One-sentence role description in the site's voice (no em dashes). */
  role: string;
}

/**
 * The eleven positions in display order: Activation Sequence first, then
 * Venus, then Pearl. The order is meaningful — ProfileGraph and
 * YourPositionCallout rely on it.
 *
 * Position copy drafts here for review by Adrian; the `body` field is left
 * empty intentionally so anatomical anchors can be added later without a
 * schema change. The label vocabulary follows the Gene Keys synthesis by
 * Richard Rudd (Activation / Venus / Pearl Sequences). Attribution lives
 * on the OracleProfile page footer.
 */
export const PROFILE_POSITIONS: readonly ProfilePositionMeta[] = [
  {
    key: 'lifesWork', sequence: 'activation', label: "Life's Work",
    planet: 'sun', side: 'persona', body: '',
    role: 'Your core vocation, the work you came here to express.',
  },
  {
    key: 'evolution', sequence: 'activation', label: 'Evolution',
    planet: 'earth', side: 'persona', body: '',
    role: 'The contrast that shapes you, what you learn by living against.',
  },
  {
    key: 'radiance', sequence: 'activation', label: 'Radiance',
    planet: 'sun', side: 'design', body: '',
    role: 'The light you carry into the world, felt before it is named.',
  },
  {
    key: 'purpose', sequence: 'activation', label: 'Purpose',
    planet: 'earth', side: 'design', body: '',
    role: 'The current beneath your work, the reason it bends toward meaning.',
  },

  {
    key: 'attraction', sequence: 'venus', label: 'Attraction',
    planet: 'venus', side: 'persona', body: '',
    role: 'How others first feel you, the quality that draws them close.',
  },
  {
    key: 'iq', sequence: 'venus', label: 'IQ',
    planet: 'mars', side: 'design', body: '',
    role: 'How your mind moves, the shape of your thinking.',
  },
  {
    key: 'eq', sequence: 'venus', label: 'EQ',
    planet: 'mars', side: 'persona', body: '',
    role: 'How you meet feeling, your way through what is felt and unsaid.',
  },
  {
    key: 'sq', sequence: 'venus', label: 'SQ',
    planet: 'venus', side: 'design', body: '',
    role: 'How spirit speaks through you, the quiet intelligence beneath.',
  },

  {
    key: 'core', sequence: 'pearl', label: 'Core',
    planet: 'jupiter', side: 'persona', body: '',
    role: 'What is fundamentally yours, the seed of everything else.',
  },
  {
    key: 'culture', sequence: 'pearl', label: 'Culture',
    planet: 'jupiter', side: 'design', body: '',
    role: 'The field you came from, the inheritance you are reweaving.',
  },
  {
    key: 'pearl', sequence: 'pearl', label: 'Pearl',
    planet: 'mercury', side: 'persona', body: '',
    role: 'The synthesis, where vocation and gift meet your daily choices.',
  },
];

export const POSITIONS_BY_KEY: Record<ProfileKey, ProfilePositionMeta> =
  Object.fromEntries(PROFILE_POSITIONS.map((p) => [p.key, p])) as Record<
    ProfileKey,
    ProfilePositionMeta
  >;

export const SEQUENCE_LABEL: Record<ProfileSequence, string> = {
  activation: 'Activation Sequence',
  venus: 'Venus Sequence',
  pearl: 'The Pearl',
};

/** All position keys in display order. */
export const POSITION_KEYS: readonly ProfileKey[] = PROFILE_POSITIONS.map((p) => p.key);
