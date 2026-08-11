export type ArtworkWorkspaceSelector = {
  artworkId?: string;
  keeperPieceId?: string;
  artistArtworkRecordId?: string;
};

export type ArtworkSalesRecordState = 'unresolved' | 'identified' | 'identity_linked';
export type ArtworkIdentityState = 'registered';
export type ArtworkCertificateState = 'unavailable' | 'missing' | 'incomplete' | 'complete';
export type ArtworkInvitationState = 'available' | 'redeemed' | 'revoked' | 'expired';
export type ArtworkCaretakerState = 'not_registered' | 'unclaimed' | 'active' | 'released';
export type ArtworkPlateState = 'legacy' | 'generated' | 'active' | 'void' | 'superseded';
export type ArtworkRecoveryState =
  | 'identity_missing' | 'identity_stale' | 'plate_backup_missing'
  | 'plate_recovery_missing' | 'plate_recovery_stale' | 'current' | 'not_required';
export type ArtworkSaleState = 'verified' | 'legacy_candidate';
export type ArtworkActivityKind =
  | 'sales_record_created' | 'identity_changed' | 'sale_verified'
  | 'identity_registered' | 'caretaker_claimed' | 'caretaker_released'
  | 'plate_generated' | 'plate_activated' | 'invitation_created'
  | 'invitation_revoked' | 'invitation_redeemed' | 'maintenance_recorded';

export type ArtworkWorkspace = {
  catalog: { artworkId: string; title: string } | null;
  salesRecord: { artworkRecordId: string; state: ArtworkSalesRecordState } | null;
  identity: { keeperPieceId: string; publicCode: string; state: ArtworkIdentityState } | null;
  certificate: { state: ArtworkCertificateState; missingFields: CertificateField[] };
  invitation: { state: ArtworkInvitationState; invitationId: string } | null;
  caretaker: { state: ArtworkCaretakerState };
  plate: { state: ArtworkPlateState; recoveryState: ArtworkRecoveryState } | null;
  sale: { state: ArtworkSaleState; verifiedSaleId: string | null } | null;
  nextAction: { label: string; href: string; reason: string } | null;
  activity: Array<{ kind: ArtworkActivityKind; occurredAt: string; label: string }>;
};

type CertificateField =
  | 'materials' | 'makers' | 'origin' | 'techniques' | 'yearWording'
  | 'editionWording' | 'certificateWording' | 'openingWording';

const CERTIFICATE_FIELDS: CertificateField[] = [
  'certificateWording', 'editionWording', 'makers', 'materials',
  'openingWording', 'origin', 'techniques', 'yearWording',
];
const RECORD_STATES: ArtworkSalesRecordState[] = ['unresolved', 'identified', 'identity_linked'];
const INVITATION_STATES: ArtworkInvitationState[] = ['available', 'redeemed', 'revoked', 'expired'];
const CARETAKER_STATES: ArtworkCaretakerState[] = ['not_registered', 'unclaimed', 'active', 'released'];
const PLATE_STATES: ArtworkPlateState[] = ['legacy', 'generated', 'active', 'void', 'superseded'];
const RECOVERY_STATES: ArtworkRecoveryState[] = [
  'identity_missing', 'identity_stale', 'plate_backup_missing',
  'plate_recovery_missing', 'plate_recovery_stale', 'current', 'not_required',
];
const SALE_STATES: ArtworkSaleState[] = ['verified', 'legacy_candidate'];
const ACTIVITY_KINDS: ArtworkActivityKind[] = [
  'sales_record_created', 'identity_changed', 'sale_verified', 'identity_registered',
  'caretaker_claimed', 'caretaker_released', 'plate_generated', 'plate_activated',
  'invitation_created', 'invitation_revoked', 'invitation_redeemed', 'maintenance_recorded',
];

function invalid(): never { throw new Error('invalid_artwork_workspace'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) invalid();
}
function text(value: unknown, maximum = 500): string {
  if (typeof value !== 'string' || !value || value.length > maximum
    || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) invalid();
  return value;
}
function state<T extends string>(value: unknown, allowed: T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid();
  return value as T;
}

const SENSITIVE_KEY = /ownershipcode|invitationtoken|tokenhash|verifier|ciphertext|nonce|recoverykey|storagereference|storagekey|buyer(?:email|name)|private(?:notes?|reference|context)|amount|price|birth/i;
const SENSITIVE_VALUE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:ciphertext|nonce|recovery key|ownership code)\b/i;

function assertNoSensitiveData(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoSensitiveData(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key.replace(/[^a-z0-9]/gi, ''))) invalid();
      assertNoSensitiveData(child);
    }
    return;
  }
  if (typeof value === 'string' && SENSITIVE_VALUE.test(value)) invalid();
}

function nullable<T>(value: unknown, parse: (value: unknown) => T): T | null {
  return value === null ? null : parse(value);
}

function parseCatalog(value: unknown) {
  const item = object(value); exact(item, ['artworkId', 'title']);
  return { artworkId: text(item.artworkId, 80), title: text(item.title, 240) };
}
function parseSalesRecord(value: unknown) {
  const item = object(value); exact(item, ['artworkRecordId', 'state']);
  return {
    artworkRecordId: text(item.artworkRecordId, 128),
    state: state(item.state, RECORD_STATES),
  };
}
function parseIdentity(value: unknown) {
  const item = object(value); exact(item, ['keeperPieceId', 'publicCode', 'state']);
  const publicCode = text(item.publicCode, 32);
  if (!/^AR-[A-Z0-9]{8}$/.test(publicCode)) invalid();
  return {
    keeperPieceId: text(item.keeperPieceId, 128), publicCode,
    state: state(item.state, ['registered'] as ArtworkIdentityState[]),
  };
}
function parseCertificate(value: unknown) {
  const item = object(value); exact(item, ['state', 'missingFields']);
  const certificateState = state(item.state,
    ['unavailable', 'missing', 'incomplete', 'complete'] as ArtworkCertificateState[]);
  if (!Array.isArray(item.missingFields)) invalid();
  const missingFields = item.missingFields.map((field) => state(field, CERTIFICATE_FIELDS));
  if ([...new Set(missingFields)].sort().join('\0') !== missingFields.join('\0')) invalid();
  if ((certificateState === 'complete' || certificateState === 'unavailable') && missingFields.length) invalid();
  if (certificateState === 'missing' && missingFields.length !== CERTIFICATE_FIELDS.length) invalid();
  if (certificateState === 'incomplete'
    && (!missingFields.length || missingFields.length === CERTIFICATE_FIELDS.length)) invalid();
  return { state: certificateState, missingFields };
}
function parseInvitation(value: unknown) {
  const item = object(value); exact(item, ['state', 'invitationId']);
  return {
    state: state(item.state, INVITATION_STATES), invitationId: text(item.invitationId, 128),
  };
}
function parseCaretaker(value: unknown) {
  const item = object(value); exact(item, ['state']);
  return { state: state(item.state, CARETAKER_STATES) };
}
function parsePlate(value: unknown) {
  const item = object(value); exact(item, ['state', 'recoveryState']);
  return {
    state: state(item.state, PLATE_STATES),
    recoveryState: state(item.recoveryState, RECOVERY_STATES),
  };
}
function parseSale(value: unknown) {
  const item = object(value); exact(item, ['state', 'verifiedSaleId']);
  const saleState = state(item.state, SALE_STATES);
  const verifiedSaleId = item.verifiedSaleId === null ? null : text(item.verifiedSaleId, 128);
  if ((saleState === 'verified') !== (verifiedSaleId !== null)) invalid();
  return { state: saleState, verifiedSaleId };
}

const ACTION_ROUTES: Record<string, Set<string>> = {
  '/admin/collector-sales': new Set([
    'artistArtworkRecordId', 'source', 'acquisitionId', 'artworkId', 'keeperPieceId',
  ]),
  '/admin/pieces/wizard': new Set(['keeperPieceId']),
  '/admin/registrations': new Set(['artworkId', 'artistArtworkRecordId']),
  '/admin/certificates': new Set(['artworkId']),
  '/admin/invitations': new Set(['keeperPieceId']),
  '/admin/pieces': new Set(['keeperPieceId']),
  '/admin/maintenance': new Set(['artworkId', 'keeperPieceId']),
};

function safeActionHref(value: unknown): string {
  const href = text(value, 1000);
  if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\')) invalid();
  const url = new URL(href, 'https://internal.invalid');
  if (url.origin !== 'https://internal.invalid' || url.hash || !ACTION_ROUTES[url.pathname]) invalid();
  const allowed = ACTION_ROUTES[url.pathname];
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) invalid();
  }
  for (const value of url.searchParams.values()) text(value, 128);
  const keys = [...url.searchParams.keys()].sort();
  const exactQuery = (required: string[]) => keys.join('\0') === [...required].sort().join('\0');
  if (url.pathname === '/admin/collector-sales') {
    const recordLookup = exactQuery(['artistArtworkRecordId']);
    const legacyLookup = exactQuery([
      'acquisitionId', 'artworkId', 'keeperPieceId', 'source',
    ]) && url.searchParams.get('source') === 'legacy_acquisition';
    if (!recordLookup && !legacyLookup) invalid();
  } else if (url.pathname === '/admin/pieces/wizard'
    || url.pathname === '/admin/invitations' || url.pathname === '/admin/pieces') {
    if (!exactQuery(['keeperPieceId'])) invalid();
  } else if (url.pathname === '/admin/registrations') {
    if (!exactQuery(['artistArtworkRecordId', 'artworkId'])) invalid();
  } else if (url.pathname === '/admin/certificates') {
    if (!exactQuery(['artworkId'])) invalid();
  } else if (url.pathname === '/admin/maintenance') {
    if (!exactQuery(['artworkId']) && !exactQuery(['keeperPieceId'])
      && !exactQuery(['artworkId', 'keeperPieceId'])) invalid();
  }
  return href;
}

function parseNextAction(value: unknown) {
  const item = object(value); exact(item, ['label', 'href', 'reason']);
  return { label: text(item.label, 120), href: safeActionHref(item.href), reason: text(item.reason, 500) };
}
function parseActivity(value: unknown) {
  if (!Array.isArray(value) || value.length > 20) invalid();
  const activity = value.map((candidate) => {
    const item = object(candidate); exact(item, ['kind', 'occurredAt', 'label']);
    const occurredAt = text(item.occurredAt, 40);
    if (Number.isNaN(Date.parse(occurredAt))) invalid();
    return {
      kind: state(item.kind, ACTIVITY_KINDS), occurredAt, label: text(item.label, 160),
    };
  });
  for (let index = 1; index < activity.length; index += 1) {
    if (activity[index - 1].occurredAt < activity[index].occurredAt) invalid();
  }
  return activity;
}

export function parseArtworkWorkspaceResponse(value: unknown): ArtworkWorkspace {
  assertNoSensitiveData(value);
  const body = object(value); exact(body, ['ok', 'workspace']);
  if (body.ok !== true) invalid();
  const workspace = object(body.workspace);
  exact(workspace, [
    'catalog', 'salesRecord', 'identity', 'certificate', 'invitation', 'caretaker',
    'plate', 'sale', 'nextAction', 'activity',
  ]);
  const parsed: ArtworkWorkspace = {
    catalog: nullable(workspace.catalog, parseCatalog),
    salesRecord: nullable(workspace.salesRecord, parseSalesRecord),
    identity: nullable(workspace.identity, parseIdentity),
    certificate: parseCertificate(workspace.certificate),
    invitation: nullable(workspace.invitation, parseInvitation),
    caretaker: parseCaretaker(workspace.caretaker),
    plate: nullable(workspace.plate, parsePlate),
    sale: nullable(workspace.sale, parseSale),
    nextAction: nullable(workspace.nextAction, parseNextAction),
    activity: parseActivity(workspace.activity),
  };
  if (parsed.identity && !parsed.catalog) invalid();
  if (parsed.salesRecord?.state === 'unresolved'
    && (parsed.catalog !== null || parsed.identity !== null)) invalid();
  if (parsed.salesRecord?.state === 'identified'
    && (parsed.catalog === null || parsed.identity !== null)) invalid();
  if (parsed.salesRecord?.state === 'identity_linked'
    && (parsed.catalog === null || parsed.identity === null)) invalid();
  if (parsed.identity === null) {
    if (parsed.caretaker.state !== 'not_registered' || parsed.invitation || parsed.plate) invalid();
  } else if (parsed.caretaker.state === 'not_registered') invalid();
  if (parsed.sale?.state === 'legacy_candidate' && !parsed.identity) invalid();
  return parsed;
}

const SELECTOR_LIMITS: Record<keyof ArtworkWorkspaceSelector, number> = {
  artworkId: 80,
  keeperPieceId: 128,
  artistArtworkRecordId: 128,
};

export function buildArtworkWorkspacePath(selector: ArtworkWorkspaceSelector): string {
  const source = object(selector);
  if (Object.keys(source).some((key) => !Object.hasOwn(SELECTOR_LIMITS, key))) invalid();
  const params = new URLSearchParams();
  for (const key of Object.keys(SELECTOR_LIMITS) as Array<keyof ArtworkWorkspaceSelector>) {
    if (source[key] === undefined) continue;
    const value = text(source[key], SELECTOR_LIMITS[key]);
    params.set(key, value);
  }
  if (![...params.keys()].length) invalid();
  return `/api/admin/artwork-workspace?${params.toString()}`;
}

export async function loadArtworkWorkspace(
  selector: ArtworkWorkspaceSelector,
  signal?: AbortSignal,
): Promise<ArtworkWorkspace> {
  const response = await fetch(buildArtworkWorkspacePath(selector), { cache: 'no-store', signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = body && typeof body === 'object' && typeof body.error === 'string'
      ? body.error : 'artwork_workspace_request_failed';
    throw new Error(code);
  }
  return parseArtworkWorkspaceResponse(body);
}
