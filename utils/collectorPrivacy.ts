export interface CollectorPrivacyState {
  ring1: { privateRecord: true };
  ring2: { shareCity: boolean; cityId: string | null };
  ring3: { shareDerivedChart: boolean };
  ring4: {
    shareFace: boolean;
    shareName: boolean;
    shareIntention: boolean;
    shareBusiness: boolean;
    shareMission: boolean;
  };
  policyVersion: string | null;
}

export type CollectorPersonChoices = CollectorPrivacyState['ring4'] &
  CollectorPrivacyState['ring3'];

export const CLOSED_COLLECTOR_PRIVACY: CollectorPrivacyState = {
  ring1: { privateRecord: true },
  ring2: { shareCity: false, cityId: null },
  ring3: { shareDerivedChart: false },
  ring4: {
    shareFace: false,
    shareName: false,
    shareIntention: false,
    shareBusiness: false,
    shareMission: false,
  },
  policyVersion: null,
};
export const COLLECTOR_PRIVACY_POLICY_VERSION = 'collector-privacy-v1';

async function privacyRequest(
  url: string,
  init?: RequestInit,
): Promise<CollectorPrivacyState> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'privacy_request_failed');
  return body as CollectorPrivacyState;
}

export function loadCollectorPrivacy(keeperPieceId?: string): Promise<CollectorPrivacyState> {
  const query = keeperPieceId ? `?piece=${encodeURIComponent(keeperPieceId)}` : '';
  return privacyRequest(`/api/collector/privacy${query}`);
}

export async function loadCollectorCuratedCities(): Promise<Array<{ id: string; label: string }>> {
  const response = await fetch('/api/collector/privacy?view=cities', {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'privacy_cities_failed');
  return Array.isArray(body?.cities) ? body.cities : [];
}

export function saveCollectorPrivacy(input: {
  person?: CollectorPersonChoices;
  piece?: { keeperPieceId: string; shareCity: boolean; cityId: string | null };
}): Promise<CollectorPrivacyState> {
  return privacyRequest('/api/collector/privacy', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
