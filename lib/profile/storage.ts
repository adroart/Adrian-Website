import type { HologeneticProfile } from '../astrology/types';

export interface ProfilePlace {
  label: string;     // "Denpasar, Bali, Indonesia"
  lat: number;
  lng: number;
  tzId: string;      // IANA, e.g. "Asia/Denpasar"
}

export interface ProfileInputs {
  date: string;      // YYYY-MM-DD local
  time: string;      // HH:MM 24h local
  place: ProfilePlace;
}

export interface StoredProfile {
  inputs: ProfileInputs;
  computed: HologeneticProfile;
  updatedAt: string; // ISO 8601
}

const KEY = 'ul.profile.v1';

/**
 * Read the saved profile from localStorage. Returns null if no profile is
 * saved or the stored shape can't be parsed.
 */
export function loadProfile(): StoredProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    // Minimal shape check so a stale schema doesn't crash the UI.
    if (!parsed?.inputs?.place?.tzId || !parsed?.computed?.lifesWork) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProfile(profile: StoredProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Quota or privacy mode; swallow and surface via UI state.
  }
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
