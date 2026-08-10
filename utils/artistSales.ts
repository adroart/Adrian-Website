export type ArtistSaleMoney = { amountMinor: number; currency: string };
export type ArtistSaleOccurrence =
  | { precision: 'unknown'; value: null }
  | { precision: 'year'; value: string }
  | { precision: 'month'; value: string }
  | { precision: 'exact'; value: string };
export type ArtistSaleEdition =
  | { kind: 'unique' }
  | { kind: 'numbered'; number: number; size: number | null };

export type SaleArtworkInput = {
  artworkRecordId: string | null;
  artworkId: string | null;
  edition: ArtistSaleEdition | null;
  price: ArtistSaleMoney | null;
};

export type CreateReconnectionRequest = {
  action: 'createReconnection';
  recipientEmail: string;
  recipientName: string | null;
  privateContext: string | null;
  idempotencyKey: string;
};
export type CreateArtistSaleRequest = {
  action: 'createSale';
  occurrence: ArtistSaleOccurrence;
  buyerEmail: string | null;
  total: ArtistSaleMoney | null;
  privateReference: string | null;
  privateNotes: string | null;
  reconnectionCaseId: string | null;
  artworks: SaleArtworkInput[];
  idempotencyKey: string;
};
export type ArtistSaleCollectionMutation = CreateReconnectionRequest | CreateArtistSaleRequest;

export type AddReconnectionNoteRequest = {
  action: 'addReconnectionNote'; note: string; idempotencyKey: string;
};
export type RecordReconnectionEmailRequest = {
  action: 'recordReconnectionEmail'; note: string | null;
  idempotencyKey: string;
};
export type ChangeReconnectionStatusRequest = {
  action: 'changeReconnectionStatus';
  newStatus: 'open' | 'partially_resolved' | 'resolved' | 'closed'; idempotencyKey: string;
};
export type CorrectArtistSaleRequest = {
  action: 'correctSale'; expectedSequence: number; occurrence: ArtistSaleOccurrence;
  buyerEmail: string | null; total: ArtistSaleMoney | null; privateReference: string | null;
  privateNotes: string | null; reason: string; idempotencyKey: string;
};
export type IdentifyArtistSaleArtworkRequest = {
  action: 'identifyArtwork'; artworkRecordId: string; artworkId: string;
  edition: ArtistSaleEdition; expectedVersion: number; idempotencyKey: string;
};
export type LinkArtistSaleIdentityRequest = {
  action: 'linkIdentity'; artworkRecordId: string; keeperPieceId: string;
  expectedVersion: number; idempotencyKey: string;
};
export type ArtistSaleDetailMutation = AddReconnectionNoteRequest
  | RecordReconnectionEmailRequest | ChangeReconnectionStatusRequest
  | CorrectArtistSaleRequest | IdentifyArtistSaleArtworkRequest | LinkArtistSaleIdentityRequest;

export type AppendArtistLedgerRequest = {
  action: 'append'; artworkRecordId: string; saleId: string | null;
  message: string | null; mediaId: string | null; idempotencyKey: string;
};
export type AppendSharedArtistSaleMessageRequest = {
  action: 'appendSharedSaleMessage'; saleId: string; artworkRecordIds: string[];
  message: string; idempotencyKey: string;
};
export type SelectCertificateImageRequest = {
  action: 'selectCertificateImage'; artworkRecordId: string; mediaId: string;
  idempotencyKey: string;
};
export type ArtistLedgerMutation = AppendArtistLedgerRequest
  | AppendSharedArtistSaleMessageRequest | SelectCertificateImageRequest;

export type ArtistLedgerMediaRole = 'identification_evidence' | 'certificate_image';
export type ArtistLedgerMediaUpload = {
  artworkRecordId: string;
  role: ArtistLedgerMediaRole;
  idempotencyKey: string;
  file: Blob;
};
export type ArtistLedgerMedia = {
  id: string; artworkRecordId: string; role: ArtistLedgerMediaRole;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'; byteLength: number; createdAt: string;
};
export type ArtistLedgerMediaResponse = { media: ArtistLedgerMedia; replayed: boolean };

export type ArtistSaleSummary = {
  saleId: string;
  reconnectionCaseId: string | null;
  occurrence: ArtistSaleOccurrence;
  buyerEmail: string | null;
  total: ArtistSaleMoney | null;
  privateReference: string | null;
  privateNotes: string | null;
  recordedAt: string;
  sequence: number;
  identificationStatuses?: Array<'unresolved' | 'identified' | 'identity_linked'>;
};
export type ArtistSaleArtworkRecordOption = {
  artworkRecordId: string;
  artworkId: string;
  edition: ArtistSaleStoredEdition;
  identificationStatus: 'identified' | 'identity_linked';
  publicCode: string | null;
};
export type ArtistSaleWorkspaceResponse = {
  ok: true;
  sales: ArtistSaleSummary[];
  reconnectionCases: Array<{
    reconnectionCaseId: string; recipientEmail: string; recipientName: string | null;
    privateContext: string | null; status: 'open' | 'partially_resolved' | 'resolved' | 'closed';
    createdAt: string;
  }>;
  artworkRecords: ArtistSaleArtworkRecordOption[];
  pagination: {
    limit: number; offset: number;
    sales: { hasMore: boolean; nextOffset: number | null };
    reconnectionCases: { hasMore: boolean; nextOffset: number | null };
    artworkRecords: { hasMore: boolean; nextOffset: number | null };
  };
};
export type ArtistSaleStoredEdition =
  | { kind: 'unique'; number: null; size: null }
  | { kind: 'numbered'; number: number; size: number | null };
export type ArtistSalePrivateMedia = {
  role: ArtistLedgerMediaRole; contentType: ArtistLedgerMedia['contentType'];
  byteLength: number;
};
export type ArtistSaleLedgerEntry = {
  ledgerEntryId: string; saleId?: string | null; message: string | null;
  mediaId: string | null; createdAt: string; media: ArtistSalePrivateMedia | null;
};
export type ArtistSalePriceEntry = ArtistSaleMoney & {
  priceEntryId: string; occurrence: ArtistSaleOccurrence; recordedAt: string;
};
export type ArtistSaleItem = {
  saleItemId: string; artworkRecordId: string; artworkId: string | null;
  edition: ArtistSaleStoredEdition | null; keeperPieceId: string | null;
  identificationStatus: 'unresolved' | 'identified' | 'identity_linked'; recordVersion: number;
  price: ArtistSaleMoney | null; priceEntries: ArtistSalePriceEntry[];
  ledgerEntries: ArtistSaleLedgerEntry[];
};
export type ArtistSaleEvent = {
  saleEventId: string; sequence: number; eventType: string;
  reason: string | null; createdAt: string;
};
export type ArtistSaleDetailSummary = Omit<ArtistSaleSummary, 'identificationStatuses'>;
export type ArtistSaleFactSnapshot = {
  reconnectionCaseId: string | null;
  occurrence: ArtistSaleOccurrence;
  buyerEmail: string | null;
  total: ArtistSaleMoney | null;
  privateReference: string | null;
  privateNotes: string | null;
  recordedAt: string;
};
export type ArtistSaleCorrection = {
  saleEventId: string; sequence: number; reason: string; createdAt: string;
  before: ArtistSaleFactSnapshot; after: ArtistSaleFactSnapshot;
};
export type ArtistSaleDetailResponse = {
  ok: true;
  /** Compatibility alias for effectiveSale. */
  sale: ArtistSaleDetailSummary;
  originalSale: ArtistSaleDetailSummary;
  effectiveSale: ArtistSaleDetailSummary;
  corrections: ArtistSaleCorrection[];
  items: ArtistSaleItem[];
  events: ArtistSaleEvent[];
};
export type ArtistArtworkRecordDetail = {
  artworkRecordId: string; artworkId: string | null; edition: ArtistSaleStoredEdition | null;
  keeperPieceId: string | null; identificationStatus: string; recordVersion: number;
  createdAt: string; updatedAt: string;
};
export type ArtistLedgerStoredMedia = ArtistLedgerMedia;
export type SelectedArtistCertificateImage = {
  ledgerEntryId: string; mediaId: string; selectedAt: string;
};
export type ArtistLedgerSaleContext = {
  sale: ArtistSaleSummary; item: ArtistSaleItem | null; events: ArtistSaleEvent[];
};
export type ArtistLedgerDetailResponse = {
  ok: true;
  artworkRecord: ArtistArtworkRecordDetail;
  ledgerEntries: ArtistSaleLedgerEntry[];
  media: ArtistLedgerStoredMedia[];
  selectedCertificateImage: SelectedArtistCertificateImage | null;
  saleContext: ArtistLedgerSaleContext | null;
};

export type FrozenArtistSaleAttempt<T extends { idempotencyKey: string }> = Readonly<{
  request: Readonly<T>;
}>;

type WithoutKey<T> = T extends unknown ? Omit<T, 'idempotencyKey'> : never;

function cloneAttemptValue<T>(value: T): T {
  if (value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(cloneAttemptValue) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, cloneAttemptValue(child)])) as T;
  }
  return value;
}

function freezeValue<T>(value: T): T {
  if (value && typeof value === 'object' && !(value instanceof Blob) && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeValue(child);
  }
  return value;
}

export function beginArtistSaleAttempt<T extends { idempotencyKey: string }>(
  current: FrozenArtistSaleAttempt<T> | null,
  input: WithoutKey<T>,
): FrozenArtistSaleAttempt<T> {
  if (current) return current;
  const request = {
    ...cloneAttemptValue(input), idempotencyKey: crypto.randomUUID(),
  } as unknown as T;
  return Object.freeze({ request: freezeValue(request) });
}

export type ArtistSaleAttemptOutcome =
  | { kind: 'success' }
  | { kind: 'network_error' }
  | { kind: 'http'; status: number };

export function finishArtistSaleAttempt<T extends { idempotencyKey: string }>(
  attempt: FrozenArtistSaleAttempt<T>,
  outcome: ArtistSaleAttemptOutcome,
): FrozenArtistSaleAttempt<T> | null {
  if (outcome.kind === 'success') return null;
  if (outcome.kind === 'http' && outcome.status >= 400 && outcome.status < 500) return null;
  return attempt;
}

export const retainArtistSaleAttempt = finishArtistSaleAttempt;

export function shouldClearArtistSaleAttempt(outcome: ArtistSaleAttemptOutcome): boolean {
  return outcome.kind === 'success'
    || (outcome.kind === 'http' && outcome.status >= 400 && outcome.status < 500);
}

export const completeArtistSaleAttempt = finishArtistSaleAttempt;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_response');
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const record = object(value);
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('invalid_response');
  }
  return record;
}

function string(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('invalid_response');
  return value;
}
function privateId(value: unknown): string {
  const id = string(value);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('invalid_response');
  return id;
}
function timestamp(value: unknown): string {
  const text = string(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text)
    || new Date(text).toISOString() !== text) throw new Error('invalid_response');
  return text;
}
function nullableEmail(value: unknown): string | null {
  if (value === null) return null;
  const email = string(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email !== email.toLowerCase()) {
    throw new Error('invalid_response');
  }
  return email;
}
function normalizedEmail(value: unknown): string {
  const email = nullableEmail(value);
  if (email === null) throw new Error('invalid_response');
  return email;
}
function nullableString(value: unknown): string | null {
  return value === null ? null : string(value);
}
function integer(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error('invalid_response');
  return value as number;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('invalid_response');
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('invalid_response');
  return value.map(string);
}

function nullableInteger(value: unknown): number | null {
  return value === null ? null : integer(value);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('invalid_response');
  return value;
}
function parseMoney(value: unknown): ArtistSaleMoney | null {
  if (value === null) return null;
  const money = exact(value, ['amountMinor', 'currency']);
  const currency = string(money.currency);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('invalid_response');
  return { amountMinor: integer(money.amountMinor), currency };
}
function parseOccurrence(value: unknown): ArtistSaleOccurrence {
  const occurrence = exact(value, ['precision', 'value']);
  const precision = string(occurrence.precision);
  if (precision === 'unknown' && occurrence.value === null) return { precision, value: null };
  const date = string(occurrence.value);
  if (precision === 'year' && /^\d{4}$/.test(date)
    && new Date(`${date}-01-01T00:00:00.000Z`).getUTCFullYear() === Number(date)) {
    return { precision, value: date };
  }
  if (precision === 'month' && /^\d{4}-\d{2}$/.test(date)
    && new Date(`${date}-01T00:00:00.000Z`).toISOString().slice(0, 7) === date) {
    return { precision, value: date };
  }
  if (precision === 'exact' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date) {
    return { precision, value: date };
  }
  throw new Error('invalid_response');
}
function parseStoredEdition(value: unknown): ArtistSaleStoredEdition | null {
  if (value === null) return null;
  const edition = object(value);
  if (edition.kind === 'unique') {
    const parsed = exact(edition, ['kind', 'number', 'size']);
    if (parsed.number !== null || parsed.size !== null) throw new Error('invalid_response');
    return parsed as ArtistSaleStoredEdition;
  }
  const parsed = exact(edition, ['kind', 'number', 'size']);
  if (parsed.kind !== 'numbered') throw new Error('invalid_response');
  integer(parsed.number, 1);
  if (parsed.size !== null) integer(parsed.size, 1);
  if (parsed.size !== null && Number(parsed.size) < Number(parsed.number)) {
    throw new Error('invalid_response');
  }
  return parsed as ArtistSaleStoredEdition;
}
function parseSale(value: unknown, statuses = false): ArtistSaleSummary {
  const keys = [
    'saleId', 'reconnectionCaseId', 'occurrence', 'buyerEmail', 'total',
    'privateReference', 'privateNotes', 'recordedAt', 'sequence',
    ...(statuses ? ['identificationStatuses'] : []),
  ];
  const sale = exact(value, keys);
  const parsed: ArtistSaleSummary = {
    saleId: privateId(sale.saleId), reconnectionCaseId: sale.reconnectionCaseId === null
      ? null : privateId(sale.reconnectionCaseId),
    occurrence: parseOccurrence(sale.occurrence), buyerEmail: nullableEmail(sale.buyerEmail),
    total: parseMoney(sale.total), privateReference: nullableString(sale.privateReference),
    privateNotes: nullableString(sale.privateNotes), recordedAt: timestamp(sale.recordedAt),
    sequence: integer(sale.sequence),
  };
  if (statuses) {
    const values = strings(sale.identificationStatuses);
    if (values.some((status) => !['unresolved', 'identified', 'identity_linked'].includes(status))) {
      throw new Error('invalid_response');
    }
    parsed.identificationStatuses = values as ArtistSaleSummary['identificationStatuses'];
  }
  return parsed;
}
function parsePage(value: unknown): { hasMore: boolean; nextOffset: number | null } {
  const page = exact(value, ['hasMore', 'nextOffset']);
  return { hasMore: bool(page.hasMore), nextOffset: nullableInteger(page.nextOffset) };
}

export function parseArtistSaleWorkspaceResponse(value: unknown): ArtistSaleWorkspaceResponse {
  const response = exact(value, ['ok', 'sales', 'reconnectionCases', 'artworkRecords', 'pagination']);
  if (response.ok !== true) throw new Error('invalid_response');
  const pagination = exact(response.pagination, [
    'limit', 'offset', 'sales', 'reconnectionCases', 'artworkRecords',
  ]);
  return {
    ok: true,
    sales: array(response.sales).map((sale) => parseSale(sale, true)),
    reconnectionCases: array(response.reconnectionCases).map((value) => {
      const item = exact(value, [
        'reconnectionCaseId', 'recipientEmail', 'recipientName', 'privateContext', 'status', 'createdAt',
      ]);
      const status = string(item.status);
      if (!['open', 'partially_resolved', 'resolved', 'closed'].includes(status)) {
        throw new Error('invalid_response');
      }
      return {
        reconnectionCaseId: privateId(item.reconnectionCaseId),
        recipientEmail: normalizedEmail(item.recipientEmail),
        recipientName: nullableString(item.recipientName), privateContext: nullableString(item.privateContext),
        status: status as ArtistSaleWorkspaceResponse['reconnectionCases'][number]['status'],
        createdAt: timestamp(item.createdAt),
      };
    }),
    artworkRecords: array(response.artworkRecords).map((value) => {
      const item = exact(value, [
        'artworkRecordId', 'artworkId', 'edition', 'identificationStatus', 'publicCode',
      ]);
      const identificationStatus = string(item.identificationStatus);
      if (!['identified', 'identity_linked'].includes(identificationStatus)) {
        throw new Error('invalid_response');
      }
      const publicCode = nullableString(item.publicCode);
      if (publicCode !== null && !/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(publicCode)) {
        throw new Error('invalid_response');
      }
      const artworkId = privateId(item.artworkId);
      const edition = parseStoredEdition(item.edition);
      if (edition === null) throw new Error('invalid_response');
      return {
        artworkRecordId: privateId(item.artworkRecordId),
        artworkId,
        edition,
        identificationStatus: identificationStatus as ArtistSaleArtworkRecordOption['identificationStatus'],
        publicCode,
      };
    }),
    pagination: {
      limit: integer(pagination.limit, 1), offset: integer(pagination.offset),
      sales: parsePage(pagination.sales), reconnectionCases: parsePage(pagination.reconnectionCases),
      artworkRecords: parsePage(pagination.artworkRecords),
    },
  };
}

function parsePrivateMedia(value: unknown): ArtistSalePrivateMedia | null {
  if (value === null) return null;
  const media = exact(value, ['role', 'contentType', 'byteLength']);
  const role = string(media.role);
  const contentType = string(media.contentType);
  if (!['identification_evidence', 'certificate_image'].includes(role)
    || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new Error('invalid_response');
  }
  return {
    role: role as ArtistLedgerMediaRole,
    contentType: contentType as ArtistLedgerMedia['contentType'],
    byteLength: integer(media.byteLength, 1),
  };
}
function parseLedgerEntry(value: unknown, includeSaleId: boolean): ArtistSaleLedgerEntry {
  const keys = ['ledgerEntryId', ...(includeSaleId ? ['saleId'] : []),
    'message', 'mediaId', 'createdAt', 'media'];
  const entry = exact(value, keys);
  return {
    ledgerEntryId: privateId(entry.ledgerEntryId),
    ...(includeSaleId ? { saleId: entry.saleId === null ? null : privateId(entry.saleId) } : {}),
    message: nullableString(entry.message),
    mediaId: entry.mediaId === null ? null : privateId(entry.mediaId),
    createdAt: timestamp(entry.createdAt), media: parsePrivateMedia(entry.media),
  };
}
function parsePriceEntry(value: unknown): ArtistSalePriceEntry {
  const price = exact(value, [
    'priceEntryId', 'amountMinor', 'currency', 'occurrence', 'recordedAt',
  ]);
  const money = parseMoney({ amountMinor: price.amountMinor, currency: price.currency });
  if (!money) throw new Error('invalid_response');
  return {
    priceEntryId: privateId(price.priceEntryId), ...money,
    occurrence: parseOccurrence(price.occurrence), recordedAt: timestamp(price.recordedAt),
  };
}
function parseSaleItem(value: unknown): ArtistSaleItem {
  const item = exact(value, [
    'saleItemId', 'artworkRecordId', 'artworkId', 'edition', 'keeperPieceId',
    'identificationStatus', 'recordVersion', 'price', 'priceEntries', 'ledgerEntries',
  ]);
  const status = string(item.identificationStatus);
  if (!['unresolved', 'identified', 'identity_linked'].includes(status)) {
    throw new Error('invalid_response');
  }
  return {
    saleItemId: privateId(item.saleItemId), artworkRecordId: privateId(item.artworkRecordId),
    artworkId: item.artworkId === null ? null : privateId(item.artworkId),
    edition: parseStoredEdition(item.edition),
    keeperPieceId: item.keeperPieceId === null ? null : privateId(item.keeperPieceId),
    identificationStatus: status as ArtistSaleItem['identificationStatus'],
    recordVersion: integer(item.recordVersion, 1), price: parseMoney(item.price),
    priceEntries: array(item.priceEntries).map(parsePriceEntry),
    ledgerEntries: array(item.ledgerEntries).map((entry) => parseLedgerEntry(entry, false)),
  };
}
function parseSaleEvent(value: unknown): ArtistSaleEvent {
  const event = exact(value, ['saleEventId', 'sequence', 'eventType', 'reason', 'createdAt']);
  return {
    saleEventId: privateId(event.saleEventId), sequence: integer(event.sequence, 1),
    eventType: string(event.eventType), reason: nullableString(event.reason),
    createdAt: timestamp(event.createdAt),
  };
}

function parseSaleFactSnapshot(value: unknown): ArtistSaleFactSnapshot {
  const fact = exact(value, [
    'reconnectionCaseId', 'occurrence', 'buyerEmail', 'total',
    'privateReference', 'privateNotes', 'recordedAt',
  ]);
  return {
    reconnectionCaseId: fact.reconnectionCaseId === null
      ? null : privateId(fact.reconnectionCaseId),
    occurrence: parseOccurrence(fact.occurrence),
    buyerEmail: nullableEmail(fact.buyerEmail),
    total: parseMoney(fact.total),
    privateReference: nullableString(fact.privateReference),
    privateNotes: nullableString(fact.privateNotes),
    recordedAt: timestamp(fact.recordedAt),
  };
}

function parseSaleCorrection(value: unknown): ArtistSaleCorrection {
  const correction = exact(value, [
    'saleEventId', 'sequence', 'reason', 'createdAt', 'before', 'after',
  ]);
  return {
    saleEventId: privateId(correction.saleEventId),
    sequence: integer(correction.sequence, 1),
    reason: string(correction.reason),
    createdAt: timestamp(correction.createdAt),
    before: parseSaleFactSnapshot(correction.before),
    after: parseSaleFactSnapshot(correction.after),
  };
}

function sameParsedValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function saleFacts(sale: ArtistSaleDetailSummary): ArtistSaleFactSnapshot {
  return {
    reconnectionCaseId: sale.reconnectionCaseId,
    occurrence: sale.occurrence,
    buyerEmail: sale.buyerEmail,
    total: sale.total,
    privateReference: sale.privateReference,
    privateNotes: sale.privateNotes,
    recordedAt: sale.recordedAt,
  };
}

export function parseArtistSaleDetailResponse(value: unknown): ArtistSaleDetailResponse {
  const response = exact(value, [
    'ok', 'sale', 'originalSale', 'effectiveSale', 'corrections', 'items', 'events',
  ]);
  if (response.ok !== true) throw new Error('invalid_response');
  const sale = parseSale(response.sale) as ArtistSaleDetailSummary;
  const originalSale = parseSale(response.originalSale) as ArtistSaleDetailSummary;
  const effectiveSale = parseSale(response.effectiveSale) as ArtistSaleDetailSummary;
  const corrections = array(response.corrections).map(parseSaleCorrection);
  const events = array(response.events).map(parseSaleEvent);
  let priorFacts = saleFacts(originalSale);
  for (const correction of corrections) {
    if (!sameParsedValue(correction.before, priorFacts)) throw new Error('invalid_response');
    priorFacts = correction.after;
  }
  const latestSequence = events.length === 0 ? 0 : events.at(-1)!.sequence;
  if (originalSale.sequence !== 0 || sale.saleId !== originalSale.saleId
    || sale.saleId !== effectiveSale.saleId || !sameParsedValue(sale, effectiveSale)
    || effectiveSale.sequence !== latestSequence
    || !sameParsedValue(priorFacts, saleFacts(effectiveSale))
    || events.some((event, index) => event.sequence !== index + 1)
    || corrections.some((correction, index) => index > 0
      && correction.sequence <= corrections[index - 1].sequence)
    || corrections.some((correction) => !events.some((event) =>
      event.eventType === 'corrected'
      && event.saleEventId === correction.saleEventId
      && event.sequence === correction.sequence
      && event.reason === correction.reason
      && event.createdAt === correction.createdAt))) {
    throw new Error('invalid_response');
  }
  return {
    ok: true, sale, originalSale, effectiveSale, corrections,
    items: array(response.items).map(parseSaleItem),
    events,
  };
}

export function parseArtistLedgerDetailResponse(value: unknown): ArtistLedgerDetailResponse {
  const response = exact(value, [
    'ok', 'artworkRecord', 'ledgerEntries', 'media', 'selectedCertificateImage', 'saleContext',
  ]);
  if (response.ok !== true) throw new Error('invalid_response');
  const record = exact(response.artworkRecord, [
    'artworkRecordId', 'artworkId', 'edition', 'keeperPieceId', 'identificationStatus',
    'recordVersion', 'createdAt', 'updatedAt',
  ]);
  const artworkRecord = {
    artworkRecordId: privateId(record.artworkRecordId),
    artworkId: record.artworkId === null ? null : privateId(record.artworkId),
    edition: parseStoredEdition(record.edition),
    keeperPieceId: record.keeperPieceId === null ? null : privateId(record.keeperPieceId),
    identificationStatus: string(record.identificationStatus),
    recordVersion: integer(record.recordVersion, 1), createdAt: timestamp(record.createdAt),
    updatedAt: timestamp(record.updatedAt),
  };
  if (!['unresolved', 'identified', 'identity_linked']
    .includes(artworkRecord.identificationStatus)) throw new Error('invalid_response');
  const media = array(response.media).map((value) => {
    const item = exact(value, [
      'id', 'artworkRecordId', 'role', 'contentType', 'byteLength', 'createdAt',
    ]);
    return {
      id: privateId(item.id), artworkRecordId: privateId(item.artworkRecordId),
      ...parsePrivateMedia({
        role: item.role, contentType: item.contentType,
        byteLength: item.byteLength,
      }) as ArtistSalePrivateMedia,
      createdAt: timestamp(item.createdAt),
    };
  });
  let selectedCertificateImage = null;
  if (response.selectedCertificateImage !== null) {
    const selected = exact(response.selectedCertificateImage, ['ledgerEntryId', 'mediaId', 'selectedAt']);
    selectedCertificateImage = {
      ledgerEntryId: privateId(selected.ledgerEntryId), mediaId: privateId(selected.mediaId),
      selectedAt: timestamp(selected.selectedAt),
    };
  }
  let saleContext = null;
  if (response.saleContext !== null) {
    const context = exact(response.saleContext, ['sale', 'item', 'events']);
    saleContext = {
      sale: parseSale(context.sale),
      item: context.item === null ? null : parseSaleItem(context.item),
      events: array(context.events).map(parseSaleEvent),
    };
  }
  return {
    ok: true, artworkRecord,
    ledgerEntries: array(response.ledgerEntries).map((entry) => parseLedgerEntry(entry, true)),
    media, selectedCertificateImage, saleContext,
  };
}

export type CreateReconnectionResult = {
  reconnectionCaseId: string; recipientEmail: string;
  status: 'open' | 'partially_resolved' | 'resolved' | 'closed'; replayed: boolean;
};
export type CreateArtistSaleResult = {
  saleId: string; itemIds: string[]; artworkRecordIds: string[];
  priceEntryIds: string[]; replayed: boolean;
};
export type ReconnectionEventResult = {
  reconnectionEventId: string; eventType: 'note_added' | 'email_sent' | 'status_changed';
  status?: 'open' | 'partially_resolved' | 'resolved' | 'closed'; replayed: boolean;
};
export type CorrectArtistSaleResult = {
  saleEventId: string; saleId: string; sequence: number; reason: string; replayed: boolean;
};
export type ArtistArtworkIdentityResult = {
  artworkRecordId: string; identificationStatus: 'unresolved' | 'identified' | 'identity_linked';
  artworkId: string | null; edition: ArtistSaleStoredEdition | null; keeperPieceId: string | null;
  recordVersion: number; replayed: boolean;
};
export type AppendArtistLedgerResult = {
  ledgerEntryId: string; artworkRecordId: string; saleId: string | null;
  message: string | null; mediaId: string | null; replayed: boolean;
};
export type AppendSharedArtistSaleMessageResult = {
  saleEventId: string; saleId: string; sequence: number;
  entries: Array<{ ledgerEntryId: string; artworkRecordId: string }>; replayed: boolean;
};
export type ArtistSaleMutationResult = CreateReconnectionResult | CreateArtistSaleResult
  | ReconnectionEventResult | CorrectArtistSaleResult | ArtistArtworkIdentityResult
  | AppendArtistLedgerResult | AppendSharedArtistSaleMessageResult;
export type ArtistSaleMutationResponse = { ok: true; result: ArtistSaleMutationResult };

const RESULT_SHAPES = [
  ['reconnectionCaseId', 'recipientEmail', 'status', 'replayed'],
  ['saleId', 'itemIds', 'artworkRecordIds', 'priceEntryIds', 'replayed'],
  ['reconnectionEventId', 'eventType', 'replayed'],
  ['reconnectionEventId', 'eventType', 'status', 'replayed'],
  ['saleEventId', 'saleId', 'sequence', 'reason', 'replayed'],
  ['artworkRecordId', 'identificationStatus', 'artworkId', 'edition', 'keeperPieceId', 'recordVersion', 'replayed'],
  ['ledgerEntryId', 'artworkRecordId', 'saleId', 'message', 'mediaId', 'replayed'],
  ['saleEventId', 'saleId', 'sequence', 'entries', 'replayed'],
] as const;

function parseMutationResult(value: unknown): ArtistSaleMutationResult {
  const record = object(value);
  const shape = RESULT_SHAPES.find((keys) => {
    const actual = Object.keys(record).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
  });
  if (!shape) throw new Error('invalid_response');
  for (const key of shape) {
    const item = record[key];
    if (['replayed'].includes(key)) bool(item);
    else if (['sequence', 'recordVersion'].includes(key)) integer(item);
    else if (['itemIds', 'artworkRecordIds', 'priceEntryIds'].includes(key)) {
      strings(item).forEach(privateId);
    }
    else if (key === 'entries') {
      if (!Array.isArray(item)) throw new Error('invalid_response');
      item.forEach((entry) => {
        const parsed = exact(entry, ['ledgerEntryId', 'artworkRecordId']);
        privateId(parsed.ledgerEntryId); privateId(parsed.artworkRecordId);
      });
    } else if (['saleId', 'reason', 'artworkId', 'edition', 'keeperPieceId', 'message', 'mediaId'].includes(key)) {
      if (key === 'saleId') {
        if (Object.hasOwn(record, 'ledgerEntryId')) {
          if (item !== null) privateId(item);
        } else privateId(item);
      } else if (key === 'edition') parseStoredEdition(item);
      else if (['artworkId', 'keeperPieceId', 'mediaId'].includes(key)) {
        if (item !== null) privateId(item);
      } else nullableString(item);
    } else if (['recipientEmail'].includes(key)) normalizedEmail(item);
    else if (['replayed'].includes(key)) bool(item);
    else if (['status'].includes(key)) {
      if (!['open', 'partially_resolved', 'resolved', 'closed'].includes(string(item))) {
        throw new Error('invalid_response');
      }
    } else if (['eventType'].includes(key)) {
      if (!['note_added', 'email_sent', 'status_changed'].includes(string(item))) {
        throw new Error('invalid_response');
      }
    } else if (key === 'identificationStatus') {
      if (!['unresolved', 'identified', 'identity_linked'].includes(string(item))) {
        throw new Error('invalid_response');
      }
    } else privateId(item);
  }
  return record as ArtistSaleMutationResult;
}

export function parseArtistSaleMutationResponse(value: unknown): ArtistSaleMutationResponse {
  const record = exact(value, ['ok', 'result']);
  if (record.ok !== true) throw new Error('invalid_response');
  return { ok: true, result: parseMutationResult(record.result) };
}

export type ArtistSalesErrorResponse = { ok: false; error: string };
export function parseArtistSalesErrorResponse(value: unknown): ArtistSalesErrorResponse {
  const response = exact(value, ['ok', 'error']);
  if (response.ok !== false) throw new Error('invalid_response');
  return { ok: false, error: string(response.error) };
}

export function parseArtistLedgerMediaResponse(value: unknown): ArtistLedgerMediaResponse {
  const response = exact(value, ['media', 'replayed']);
  const media = exact(response.media, [
    'id', 'artworkRecordId', 'role', 'contentType', 'byteLength', 'createdAt',
  ]);
  const role = string(media.role);
  const contentType = string(media.contentType);
  if (!['identification_evidence', 'certificate_image'].includes(role)
    || !['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('invalid_response');
  return {
    media: {
      id: privateId(media.id), artworkRecordId: privateId(media.artworkRecordId),
      role: role as ArtistLedgerMediaRole,
      contentType: contentType as ArtistLedgerMedia['contentType'],
      byteLength: integer(media.byteLength, 1), createdAt: timestamp(media.createdAt),
    },
    replayed: bool(response.replayed),
  };
}

export async function uploadArtistLedgerMedia(
  input: ArtistLedgerMediaUpload,
  fetcher: typeof fetch = fetch,
): Promise<ArtistLedgerMediaResponse> {
  if (!input.file || !Number.isSafeInteger(input.file.size) || input.file.size < 1
    || input.file.size > 15 * 1024 * 1024
    || !['image/jpeg', 'image/png', 'image/webp'].includes(input.file.type)) {
    throw new Error('invalid_media_upload');
  }
  const response = await fetcher('/api/admin/collector-ledger/media', {
    method: 'POST', credentials: 'same-origin', body: input.file,
    headers: {
      'Content-Type': input.file.type,
      'X-Content-Length': String(input.file.size),
      'X-Artwork-Record-Id': input.artworkRecordId,
      'X-Artwork-Media-Role': input.role,
      'X-Idempotency-Key': input.idempotencyKey,
    },
  });
  const value: unknown = await response.json();
  if (!response.ok) throw Object.assign(new Error('artist_media_upload_failed'), { status: response.status });
  return parseArtistLedgerMediaResponse(value);
}
