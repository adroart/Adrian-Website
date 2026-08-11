export type ContributorInvitationStatus =
  | 'available'
  | 'accepted'
  | 'revoked'
  | 'expired';

export type ContributorProofStatus =
  | 'available'
  | 'used'
  | 'expired'
  | 'revoked'
  | 'already_active'
  | 'claim_pending';

export type ContributorInviteRequest = Readonly<{
  action: 'invite';
  keeperPieceId: string;
  intendedRecipientEmail: string;
  expiresAt: string;
  idempotencyKey: string;
}>;

export type ContributorRevokeRequest = Readonly<{
  action: 'revoke';
  keeperPieceId: string;
  idempotencyKey: string;
} & (
  | { invitationId: string; accessId?: never }
  | { accessId: string; invitationId?: never }
)>;

export type ContributorRevokeDraft = Readonly<{
  keeperPieceId: string;
} & (
  | { invitationId: string; accessId?: never }
  | { accessId: string; invitationId?: never }
)>;

export type ContributorAcceptRequest = Readonly<{
  action: 'accept';
  token: string;
  idempotencyKey: string;
}>;

export type ContributorAttempt<T> = Readonly<{ request: T }>;

export type ContributorInvitation = Readonly<{
  invitationId: string;
  recipientEmail: string;
  invitedAt: string;
  expiresAt: string;
  status: ContributorInvitationStatus;
}>;

export type ActiveArtworkContributor = Readonly<{
  accessId: string;
  grantedAt: string;
  status: 'active';
}>;

export type ArtworkContributorList = Readonly<{
  invitations: ContributorInvitation[];
  contributors: ActiveArtworkContributor[];
}>;

export type ContributorInviteResult = Readonly<{
  invitationId: string;
  status: 'created' | 'replay';
  token: string | null;
}>;

export type ContributorMutationResult = Readonly<{
  invitationId: string;
  status: 'accepted' | 'revoked' | 'replay';
}>;

export type ContributorInvitationInspection = Readonly<{
  invitationId: string;
  artwork: Readonly<{
    artworkId: string;
    publicCode: string | null;
    edition:
      | Readonly<{ kind: 'unique' }>
      | Readonly<{ kind: 'numbered'; number: number; size: number | null }>;
  }>;
  status: ContributorProofStatus;
}>;

export class ArtworkContributorRequestError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length
    && actual.every((key, index) => key === sorted[index]);
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, maximum = 512): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= maximum;
}

function instant(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function invalidResponse(): never {
  throw new ArtworkContributorRequestError(502, 'invalid_contributor_response');
}

function parseInvitation(value: unknown): ContributorInvitation {
  if (!record(value)
    || !exactKeys(value, [
      'invitationId', 'recipientEmail', 'invitedAt', 'expiresAt', 'status',
    ])
    || !text(value.invitationId, 128)
    || !text(value.recipientEmail, 254)
    || !instant(value.invitedAt)
    || !instant(value.expiresAt)
    || !['available', 'accepted', 'revoked', 'expired'].includes(String(value.status))) {
    return invalidResponse();
  }
  return value as ContributorInvitation;
}

function parseContributor(value: unknown): ActiveArtworkContributor {
  if (!record(value)
    || !exactKeys(value, ['accessId', 'grantedAt', 'status'])
    || !text(value.accessId, 128)
    || !instant(value.grantedAt)
    || value.status !== 'active') return invalidResponse();
  return value as ActiveArtworkContributor;
}

function parseArtwork(value: unknown): ContributorInvitationInspection['artwork'] {
  if (!record(value)
    || !exactKeys(value, ['artworkId', 'publicCode', 'edition'])
    || !text(value.artworkId, 128)
    || !(value.publicCode === null || text(value.publicCode, 64))
    || !record(value.edition)) return invalidResponse();
  const edition = value.edition;
  if (edition.kind === 'unique') {
    if (!exactKeys(edition, ['kind'])) return invalidResponse();
  } else if (edition.kind === 'numbered') {
    if (!exactKeys(edition, ['kind', 'number', 'size'])
      || !Number.isSafeInteger(edition.number) || Number(edition.number) < 1
      || !(edition.size === null
        || (Number.isSafeInteger(edition.size) && Number(edition.size) > 0))) {
      return invalidResponse();
    }
  } else return invalidResponse();
  return value as ContributorInvitationInspection['artwork'];
}

async function contributorRequest(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new ArtworkContributorRequestError(0, 'contributor_network_error');
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ArtworkContributorRequestError(response.status, 'invalid_contributor_response');
  }
  if (!response.ok) {
    if (!record(payload)
      || !(exactKeys(payload, ['error']) || exactKeys(payload, ['ok', 'error']))
      || (Object.hasOwn(payload, 'ok') && payload.ok !== false)
      || !text(payload.error, 128)) invalidResponse();
    throw new ArtworkContributorRequestError(response.status, payload.error);
  }
  return payload;
}

function attempt<T>(request: T): ContributorAttempt<Readonly<T>> {
  return Object.freeze({ request: Object.freeze(request) });
}

export function beginContributorInviteAttempt(
  current: ContributorAttempt<ContributorInviteRequest> | null,
  draft: Omit<ContributorInviteRequest, 'action' | 'idempotencyKey'>,
  createKey: () => string = () => crypto.randomUUID(),
): ContributorAttempt<ContributorInviteRequest> {
  if (current) return current;
  return attempt({
    action: 'invite' as const,
    keeperPieceId: draft.keeperPieceId.trim(),
    intendedRecipientEmail: draft.intendedRecipientEmail.trim().toLowerCase(),
    expiresAt: draft.expiresAt,
    idempotencyKey: createKey(),
  });
}

export function beginContributorRevokeAttempt(
  current: ContributorAttempt<ContributorRevokeRequest> | null,
  draft: ContributorRevokeDraft,
  createKey: () => string = () => crypto.randomUUID(),
): ContributorAttempt<ContributorRevokeRequest> {
  if (current) return current;
  if (typeof draft.invitationId === 'string') {
    return attempt({
      action: 'revoke' as const,
      keeperPieceId: draft.keeperPieceId.trim(),
      invitationId: draft.invitationId.trim(),
      idempotencyKey: createKey(),
    });
  }
  return attempt({
    action: 'revoke' as const,
    keeperPieceId: draft.keeperPieceId.trim(),
    accessId: draft.accessId.trim(),
    idempotencyKey: createKey(),
  });
}

export function beginContributorAcceptAttempt(
  current: ContributorAttempt<ContributorAcceptRequest> | null,
  draft: { token: string },
  createKey: () => string = () => crypto.randomUUID(),
): ContributorAttempt<ContributorAcceptRequest> {
  if (current) return current;
  return attempt({
    action: 'accept' as const,
    token: draft.token.trim(),
    idempotencyKey: createKey(),
  });
}

export async function loadArtworkContributors(
  keeperPieceId: string,
): Promise<ArtworkContributorList> {
  const payload = await contributorRequest(
    `/api/keeper/contributors?keeperPieceId=${encodeURIComponent(keeperPieceId.trim())}`,
  );
  if (!record(payload)
    || !exactKeys(payload, ['ok', 'invitations', 'contributors'])
    || payload.ok !== true
    || !Array.isArray(payload.invitations)
    || !Array.isArray(payload.contributors)) return invalidResponse();
  return {
    invitations: payload.invitations.map(parseInvitation),
    contributors: payload.contributors.map(parseContributor),
  };
}

export async function createArtworkContributorInvitation(
  request: ContributorInviteRequest,
): Promise<ContributorInviteResult> {
  const payload = await contributorRequest('/api/keeper/contributors', {
    method: 'POST', body: JSON.stringify(request),
  });
  if (!record(payload) || payload.ok !== true || !text(payload.invitationId, 128)) {
    return invalidResponse();
  }
  if (payload.status === 'created') {
    if (!exactKeys(payload, ['ok', 'invitationId', 'status', 'token'])
      || !text(payload.token, 512)) return invalidResponse();
    return { invitationId: payload.invitationId, status: 'created', token: payload.token };
  }
  if (payload.status === 'replay'
    && exactKeys(payload, ['ok', 'invitationId', 'status'])) {
    return { invitationId: payload.invitationId, status: 'replay', token: null };
  }
  return invalidResponse();
}

export function clearContributorInvitationToken(
  result: ContributorInviteResult,
): ContributorInviteResult {
  return { invitationId: result.invitationId, status: result.status, token: null };
}

export async function inspectArtworkContributorInvitation(
  token: string,
): Promise<ContributorInvitationInspection> {
  const payload = await contributorRequest('/api/contributor-invitations', {
    method: 'POST', body: JSON.stringify({ action: 'inspect', token }),
  });
  if (!record(payload)
    || !exactKeys(payload, ['ok', 'invitationId', 'artwork', 'status'])
    || payload.ok !== true
    || !text(payload.invitationId, 128)
    || ![
      'available', 'used', 'expired', 'revoked', 'already_active', 'claim_pending',
    ].includes(String(payload.status))) return invalidResponse();
  return {
    invitationId: payload.invitationId,
    artwork: parseArtwork(payload.artwork),
    status: payload.status as ContributorProofStatus,
  };
}

export async function acceptArtworkContributorInvitation(
  request: ContributorAcceptRequest,
): Promise<ContributorMutationResult> {
  return parseMutation(await contributorRequest('/api/contributor-invitations', {
    method: 'POST', body: JSON.stringify(request),
  }), ['accepted', 'replay']);
}

export async function revokeArtworkContributor(
  request: ContributorRevokeRequest,
): Promise<ContributorMutationResult> {
  return parseMutation(await contributorRequest('/api/keeper/contributors', {
    method: 'POST', body: JSON.stringify(request),
  }), ['revoked', 'replay']);
}

function parseMutation(
  payload: unknown,
  statuses: ContributorMutationResult['status'][],
): ContributorMutationResult {
  if (!record(payload)
    || !exactKeys(payload, ['ok', 'invitationId', 'status'])
    || payload.ok !== true
    || !text(payload.invitationId, 128)
    || !statuses.includes(payload.status as ContributorMutationResult['status'])) {
    return invalidResponse();
  }
  return {
    invitationId: payload.invitationId,
    status: payload.status as ContributorMutationResult['status'],
  };
}
