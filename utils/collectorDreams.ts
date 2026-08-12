export type CollectorDreamScope =
  | 'self'
  | 'family'
  | 'community'
  | 'planet';

export type CollectorDreamVisibility = 'private' | 'anonymous' | 'attributed';

export type CollectorDreamMarkerKind =
  | 'milestone'
  | 'change'
  | 'encounter'
  | 'fulfillment';

export type YearlyRitualAction = 'reinforce' | 'plant-new' | 'fulfilled';

export interface CollectorDream {
  id: string;
  keeperPieceId: string;
  body: string;
  scope: CollectorDreamScope;
  visibility: CollectorDreamVisibility;
  version: number;
  createdAt: string;
  updatedAt: string;
  sharedAt: string | null;
  revokedAt: string | null;
  fulfilledAt: string | null;
  archivedAt: string | null;
}

export interface CollectorDreamMarker {
  id: string;
  dreamId: string;
  kind: CollectorDreamMarkerKind;
  body: string;
  createdAt: string;
}

export interface CollectorDreamState {
  keeperPieceId: string;
  current: CollectorDream | null;
  history: CollectorDream[];
  markers: CollectorDreamMarker[];
}

export interface YearlyRitualEligibility {
  eligible: boolean;
  reason:
    | null
    | 'birth_profile_missing'
    | 'birth_profile_invalid'
    | 'current_dream_missing'
    | 'outside_birthday_window'
    | 'already_completed';
  birthdayYear: number | null;
  actions: YearlyRitualAction[];
  currentDream: CollectorDream | null;
}

export interface CompletedYearlyRitual {
  ritual: {
    id: string;
    keeperPieceId: string;
    birthdayYear: number;
    action: YearlyRitualAction;
    priorDreamId: string;
    resultingDreamId: string;
    completedAt: string;
  };
  state: CollectorDreamState;
  eligibility: YearlyRitualEligibility;
}

export interface PublicCollectorDream {
  body: string;
  scope: CollectorDreamScope;
  visibility: Exclude<CollectorDreamVisibility, 'private'>;
  attribution: string | null;
  sharedAt: string;
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function validPublicDream(value: unknown): value is PublicCollectorDream {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const dream = value as Record<string, unknown>;
  if (!exactKeys(dream, ['body', 'scope', 'visibility', 'attribution', 'sharedAt'])) {
    return false;
  }
  if (typeof dream.body !== 'string' || !dream.body.trim() || dream.body.length > 4000) {
    return false;
  }
  if (!['self', 'family', 'community', 'planet'].includes(String(dream.scope))) return false;
  if (dream.visibility !== 'anonymous' && dream.visibility !== 'attributed') return false;
  if (dream.visibility === 'anonymous' && dream.attribution !== null) return false;
  if (dream.visibility === 'attributed'
    && (typeof dream.attribution !== 'string' || !dream.attribution.trim()
      || dream.attribution.length > 200)) return false;
  return typeof dream.sharedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(dream.sharedAt)
    && Number.isFinite(Date.parse(dream.sharedAt));
}

export async function loadPublicCollectorDream(
  publicCode: string,
): Promise<PublicCollectorDream | null> {
  if (!/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(publicCode)) {
    throw new Error('invalid_public_code');
  }
  const response = await fetch(
    `/api/collector/dreams/public/${encodeURIComponent(publicCode)}`,
    { method: 'GET', credentials: 'omit', cache: 'no-store' },
  );
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('invalid_public_dream');
  }
  if (!response.ok) throw new Error('public_dream_request_failed');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)
    || !exactKeys(payload as Record<string, unknown>, ['dream'])) {
    throw new Error('invalid_public_dream');
  }
  const dream = (payload as { dream?: unknown }).dream;
  if (dream === null) return null;
  if (!validPublicDream(dream)) throw new Error('invalid_public_dream');
  return dream;
}

async function collectorRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? 'collector_dream_request_failed');
  return body as T;
}

export function loadCollectorDream(keeperPieceId: string): Promise<CollectorDreamState> {
  return collectorRequest(
    `/api/collector/dreams?piece=${encodeURIComponent(keeperPieceId)}`,
  );
}

export function createCollectorDream(input: {
  keeperPieceId: string;
  body: string;
  scope: CollectorDreamScope;
  idempotencyKey: string;
}): Promise<CollectorDreamState> {
  return collectorRequest('/api/collector/dreams', {
    method: 'POST', body: JSON.stringify({ action: 'create', ...input }),
  });
}

export function updateCollectorDream(input: {
  keeperPieceId: string;
  body: string;
  scope: CollectorDreamScope;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<CollectorDreamState> {
  return collectorRequest('/api/collector/dreams', {
    method: 'POST', body: JSON.stringify({ action: 'update', ...input }),
  });
}

export function setCollectorDreamSharing(input: {
  keeperPieceId: string;
  visibility: CollectorDreamVisibility;
  idempotencyKey: string;
}): Promise<CollectorDreamState> {
  return collectorRequest('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: input.visibility === 'private' ? 'revoke' : 'share', ...input,
    }),
  });
}

export function addCollectorDreamMarker(input: {
  keeperPieceId: string;
  kind: CollectorDreamMarkerKind;
  body: string;
  idempotencyKey: string;
}): Promise<CollectorDreamState> {
  return collectorRequest('/api/collector/dreams', {
    method: 'POST', body: JSON.stringify({ action: 'marker', ...input }),
  });
}

export function loadYearlyRitual(
  keeperPieceId: string,
): Promise<YearlyRitualEligibility> {
  return collectorRequest(
    `/api/collector/ritual?piece=${encodeURIComponent(keeperPieceId)}`,
  );
}

export function completeYearlyRitual(input: {
  keeperPieceId: string;
  action: YearlyRitualAction;
  idempotencyKey: string;
  body?: string;
  scope?: CollectorDreamScope;
}): Promise<CompletedYearlyRitual> {
  return collectorRequest('/api/collector/ritual', {
    method: 'POST', body: JSON.stringify(input),
  });
}
