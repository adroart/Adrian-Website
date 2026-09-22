import { projectIssuedPlateResponse, type IssuedPlatePackage } from './adminArtworkRegistry';

export type MaintenanceAcquisitionType =
  | 'sale'
  | 'gift'
  | 'retained'
  | 'loan'
  | 'consignment'
  | 'inheritance'
  | 'other';

export const MAINTENANCE_CUSTODY_ACQUISITION_TYPES = [
  'retained', 'loan', 'consignment', 'gift', 'inheritance', 'other',
] as const;
export type MaintenanceCustodyAcquisitionType =
  typeof MAINTENANCE_CUSTODY_ACQUISITION_TYPES[number];
export const DEFAULT_MAINTENANCE_ACQUISITION_TYPE: MaintenanceCustodyAcquisitionType = 'retained';

type MaintenanceAcquisitionTypeCarrier = { acquisitionType: MaintenanceAcquisitionType };

export function isLegacySaleAcquisition<T extends MaintenanceAcquisitionTypeCarrier>(
  acquisition: T,
): acquisition is T & { acquisitionType: 'sale' } {
  return acquisition.acquisitionType === 'sale';
}

export function canCorrectMaintenanceAcquisition<T extends MaintenanceAcquisitionTypeCarrier>(
  acquisition: T,
): acquisition is T & { acquisitionType: MaintenanceCustodyAcquisitionType } {
  return !isLegacySaleAcquisition(acquisition);
}

/**
 * Current tender currencies and standard display digits from Unicode CLDR 48.0.0.
 * Source: cldr-json/cldr-core/supplemental/currencyData.json, current region entries
 * with `_tender !== "false"`; digit overrides use `fractions`, default 2.
 */
export const MAINTENANCE_CURRENCY_EXPONENTS: Readonly<Record<string, number>> = Object.freeze({
  AED: 2, AFN: 0, ALL: 0, AMD: 2, AOA: 2, ARS: 2, AUD: 2, AWG: 2, AZN: 2,
  BAM: 2, BBD: 2, BDT: 2, BHD: 3, BIF: 0, BMD: 2, BND: 2, BOB: 2, BRL: 2,
  BSD: 2, BTN: 2, BWP: 2, BYN: 2, BZD: 2, CAD: 2, CDF: 2, CHF: 2, CLP: 0,
  CNY: 2, COP: 0, CRC: 2, CUP: 2, CVE: 2, CZK: 2, DJF: 0, DKK: 2, DOP: 2,
  DZD: 2, EGP: 2, ERN: 2, ETB: 2, EUR: 2, FJD: 2, FKP: 2, GBP: 2, GEL: 2,
  GHS: 2, GIP: 2, GMD: 2, GNF: 0, GTQ: 2, GYD: 2, HKD: 2, HNL: 2, HTG: 2,
  HUF: 0, IDR: 0, ILS: 2, INR: 2, IQD: 0, IRR: 0, ISK: 0, JMD: 2, JOD: 3,
  JPY: 0, KES: 2, KGS: 2, KHR: 2, KMF: 0, KPW: 0, KRW: 0, KWD: 3, KYD: 2,
  KZT: 2, LAK: 0, LBP: 0, LKR: 2, LRD: 2, LSL: 2, LYD: 3, MAD: 2, MDL: 2,
  MGA: 0, MKD: 2, MMK: 0, MNT: 2, MOP: 2, MRU: 2, MUR: 2, MVR: 2, MWK: 2,
  MXN: 2, MYR: 2, MZN: 2, NAD: 2, NGN: 2, NIO: 2, NOK: 2, NPR: 2, NZD: 2,
  OMR: 3, PAB: 2, PEN: 2, PGK: 2, PHP: 2, PKR: 0, PLN: 2, PYG: 0, QAR: 2,
  RON: 2, RSD: 0, RUB: 2, RWF: 0, SAR: 2, SBD: 2, SCR: 2, SDG: 2, SEK: 2,
  SGD: 2, SHP: 2, SLE: 2, SOS: 0, SRD: 2, SSP: 2, STN: 2, SYP: 0, SZL: 2,
  THB: 2, TJS: 2, TMT: 2, TND: 3, TOP: 2, TRY: 2, TTD: 2, TWD: 2, TZS: 2,
  UAH: 2, UGX: 0, USD: 2, UYU: 2, UZS: 2, VES: 2, VND: 0, VUV: 0, WST: 2,
  XAF: 0, XCD: 2, XCG: 2, XOF: 0, XPF: 0, YER: 0, ZAR: 2, ZMW: 2, ZWG: 2,
});

export const MAINTENANCE_CURRENCY_CODES = Object.freeze(Object.keys(MAINTENANCE_CURRENCY_EXPONENTS));

/** Only public fields are allowed to become query-string values. */
export type MaintenanceSearchFilters = {
  publicCode?: string;
  artworkId?: string;
  title?: string;
  editionNumber?: number;
};

export type LegacyAcquisitionSalesContext = {
  acquisitionId: string;
  artworkId: string;
  keeperPieceId: string;
};

export type MaintenanceListItem = {
  id: string;
  artworkId: string;
  title: string;
  editionNumber: number;
  publicCode: string | null;
  plateStatus: string;
};

export type MaintenanceAcquisitionInput = {
  acquisitionType: MaintenanceCustodyAcquisitionType;
  acquiredAt: string | null;
  amountMinor: number | null;
  currency: string | null;
  acquirerReference: string | null;
  privateNotes: string | null;
  documentReference: string | null;
  publicProvenance: string | null;
};

export type MaintenanceAcquisition = Omit<MaintenanceAcquisitionInput, 'acquisitionType'> & {
  acquisitionType: MaintenanceAcquisitionType;
  acquisitionId: string;
  keeperPieceId: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceProvenanceType =
  | 'contributor'
  | 'creation_place'
  | 'intention'
  | 'material'
  | 'technique'
  | 'note';

export type MaintenanceProvenanceVisibility = 'private' | 'steward' | 'public';

export type MaintenanceProvenanceInput = {
  entryType: MaintenanceProvenanceType;
  title: string;
  detail: string | null;
  role: string | null;
  occurredAt: string | null;
  visibility: MaintenanceProvenanceVisibility;
};

export type MaintenanceProvenance = MaintenanceProvenanceInput & {
  provenanceId: string;
  keeperPieceId: string;
  recordVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type MaintenanceHistoryEvent = {
  id: string;
  idempotencyKey: string;
  eventType: string;
  administrator: { userId: string; email: string };
  reason: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  warning?: string;
  outcome: string;
  relatedRecordId: string | null;
  createdAt: string;
};

export type MaintenancePieceDetail = {
  id: string;
  public: {
    artworkId: string;
    title: string;
    series: string | null;
    editionNumber: number;
    editionSize: number | null;
    publicCode: string | null;
    plateStatus: string;
  };
  physical: {
    registeredAt: string | null;
    plateGeneratedAt: string | null;
    plateActivatedAt: string | null;
    recordVersion: number;
    recovery: {
      verifierPresent: boolean;
      envelopePresent: boolean;
      backupStatus: string | null;
      backupAt: string | null;
    };
  };
  stewardVersion: number;
  steward: {
    userId: string;
    email: string | null;
    active: boolean;
    currentDisplayLocation: string | null;
    claimedAt: string | null;
    releasedAt: string | null;
    stewardVersion: number;
  } | null;
  acquisitions: MaintenanceAcquisition[];
  creatorHistory: MaintenanceProvenance[];
  maintenanceHistory: MaintenanceHistoryEvent[];
};

export class MaintenanceRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'MaintenanceRequestError';
    this.status = status;
    this.code = code;
  }
}

function supportedCurrency(value: string) {
  const code = value.trim().toUpperCase();
  const exponent = MAINTENANCE_CURRENCY_EXPONENTS[code];
  if (!/^[A-Z]{3}$/.test(code) || exponent === undefined) {
    throw new Error(`Unsupported currency ${code || 'code'}. Enter a supported three-letter ISO currency code.`);
  }
  return { code, exponent };
}

function decimalPlacesLabel(exponent: number): string {
  if (exponent === 1) return 'one decimal place';
  if (exponent === 2) return 'two decimal places';
  if (exponent === 3) return 'three decimal places';
  return `${exponent} decimal places`;
}

/** Convert a familiar decimal amount to the exact integer stored by the registry. */
export function parseMaintenanceCurrencyAmount(value: string, currencyCode: string): number {
  const currency = supportedCurrency(currencyCode);
  const amount = value.trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new Error('Enter a nonnegative familiar amount using digits and an optional decimal point.');
  const fraction = match[2] || '';
  if (currency.exponent === 0 && fraction) {
    throw new Error(`${currency.code} requires a whole amount without decimals.`);
  }
  if (fraction.length > currency.exponent) {
    throw new Error(`${currency.code} supports up to ${decimalPlacesLabel(currency.exponent)}; the amount was not rounded.`);
  }
  const minorText = `${match[1]}${fraction.padEnd(currency.exponent, '0')}`.replace(/^0+(?=\d)/, '');
  const amountMinor = Number(minorText || '0');
  if (!Number.isSafeInteger(amountMinor)) throw new Error('Amount is too large to store exactly.');
  return amountMinor;
}

/** Convert the stored integer to a decimal string suitable for the amount field. */
export function currencyAmountToInput(amountMinor: number, currencyCode: string): string {
  const currency = supportedCurrency(currencyCode);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error('Stored amount is not an exact nonnegative integer.');
  }
  if (currency.exponent === 0) return String(amountMinor);
  const digits = String(amountMinor).padStart(currency.exponent + 1, '0');
  return `${digits.slice(0, -currency.exponent)}.${digits.slice(-currency.exponent)}`;
}

/** Display the exact familiar amount without floating-point conversion or rounding. */
export function formatMaintenanceCurrencyAmount(amountMinor: number, currencyCode: string): string {
  const currency = supportedCurrency(currencyCode);
  const input = currencyAmountToInput(amountMinor, currency.code);
  const [whole, fraction] = input.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency.code} ${grouped}${fraction === undefined ? '' : `.${fraction}`}`;
}

export type MaintenanceCurrencyAmountDraft = {
  amount: string;
  currency: string;
  preservedUnsupported: { amountMinor: number; currency: string } | null;
};

/** Preserve unknown stored values exactly; their exponent must never be guessed. */
export function maintenanceCurrencyAmountToDraft(
  amountMinor: number | null,
  currencyCode: string | null,
): MaintenanceCurrencyAmountDraft {
  if (amountMinor === null || !currencyCode) {
    return { amount: '', currency: currencyCode || '', preservedUnsupported: null };
  }
  const currency = currencyCode.trim().toUpperCase();
  try {
    return { amount: currencyAmountToInput(amountMinor, currency), currency, preservedUnsupported: null };
  } catch {
    return {
      amount: String(amountMinor),
      currency,
      preservedUnsupported: { amountMinor, currency },
    };
  }
}

export function createMaintenanceRequestGate() {
  let current = 0;
  return {
    next: () => ++current,
    invalidate: () => { current += 1; },
    isCurrent: (generation: number) => generation === current,
  };
}

/** Ambiguous failures and expired authorization keep the key so an unlock can safely replay it. */
export function shouldRetainMaintenanceSaveAttempt(error: unknown): boolean {
  if (error instanceof MaintenanceRequestError
    && (error.code === 'registry_locked' || error.status === 401 || error.status === 403)) {
    return true;
  }
  return !(error instanceof MaintenanceRequestError && error.status >= 400 && error.status < 500);
}

function appendText(params: URLSearchParams, key: string, value: string | undefined) {
  const normalized = value?.trim();
  if (normalized) params.set(key, normalized);
}

export function buildMaintenanceSearchPath(filters: MaintenanceSearchFilters = {}): string {
  const params = new URLSearchParams();
  appendText(params, 'publicCode', filters.publicCode);
  appendText(params, 'artworkId', filters.artworkId);
  appendText(params, 'title', filters.title);
  if (Number.isSafeInteger(filters.editionNumber) && Number(filters.editionNumber) >= 0) {
    params.set('editionNumber', String(filters.editionNumber));
  }
  const query = params.toString();
  return `/api/admin/maintenance${query ? `?${query}` : ''}`;
}

/** Carry only stable record identity into the verified-sales workspace. */
export function buildLegacyAcquisitionSalesPath(
  context: LegacyAcquisitionSalesContext,
): string {
  const params = new URLSearchParams({ source: 'legacy_acquisition' });
  appendText(params, 'acquisitionId', context.acquisitionId);
  appendText(params, 'artworkId', context.artworkId);
  appendText(params, 'keeperPieceId', context.keeperPieceId);
  return `/admin/collector-sales?${params.toString()}`;
}

async function readMaintenanceJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
  if (!response.ok || data.ok !== true) {
    throw new MaintenanceRequestError(response.status, data.error || 'maintenance_request_failed');
  }
  return data as T;
}

export async function searchMaintenance(
  filters: MaintenanceSearchFilters = {},
  signal?: AbortSignal,
): Promise<MaintenanceListItem[]> {
  const response = await fetch(buildMaintenanceSearchPath(filters), {
    cache: 'no-store',
    signal,
  });
  const data = await readMaintenanceJson<{ ok: true; pieces: MaintenanceListItem[] }>(response);
  return (data.pieces || []).map(piece => ({
    id: piece.id,
    artworkId: piece.artworkId,
    title: piece.title,
    editionNumber: piece.editionNumber,
    publicCode: piece.publicCode,
    plateStatus: piece.plateStatus,
  }));
}

export async function getMaintenanceDetail(
  keeperPieceId: string,
  signal?: AbortSignal,
): Promise<MaintenancePieceDetail> {
  const response = await fetch(`/api/admin/maintenance/${encodeURIComponent(keeperPieceId)}`, {
    cache: 'no-store',
    signal,
  });
  const data = await readMaintenanceJson<{ ok: true; piece: MaintenancePieceDetail }>(response);
  return data.piece;
}

export type SaveAcquisitionRequest = {
  keeperPieceId: string;
  acquisitionId?: string;
  expectedVersion?: number;
  idempotencyKey: string;
  reason: string;
  acquisition: MaintenanceAcquisitionInput;
};

export type MaintenanceSaveRequestInput = Omit<SaveAcquisitionRequest, 'idempotencyKey'>;
export type MaintenanceSaveAttempt = Readonly<{ request: Readonly<SaveAcquisitionRequest> }>;

/** Freeze one exact request at the confirmation boundary and reuse it until definitive resolution. */
export function beginMaintenanceSaveRequestAttempt(
  current: MaintenanceSaveAttempt | null,
  request: MaintenanceSaveRequestInput,
  createKey: () => string = () => crypto.randomUUID(),
): MaintenanceSaveAttempt {
  if (current) return current;
  const acquisition = Object.freeze({ ...request.acquisition });
  const immutableRequest = Object.freeze({
    ...request,
    acquisition,
    idempotencyKey: createKey(),
  });
  return Object.freeze({ request: immutableRequest });
}

/** An in-flight request cannot be abandoned by a competing UI transition. */
export function discardMaintenanceSaveAttempt<T>(
  current: T | null,
  inFlight: boolean,
): T | null {
  return inFlight ? current : null;
}

export async function saveMaintenanceAcquisition(
  request: SaveAcquisitionRequest,
): Promise<MaintenanceAcquisition> {
  const idempotencyKey = request.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error('idempotency_key_required');
  const correcting = typeof request.acquisitionId === 'string' && request.acquisitionId.length > 0;
  const base = `/api/admin/maintenance/${encodeURIComponent(request.keeperPieceId)}/acquisitions`;
  const path = correcting
    ? `${base}/${encodeURIComponent(request.acquisitionId!)}`
    : base;
  const body = {
    idempotencyKey,
    reason: request.reason.trim(),
    ...(correcting ? { expectedVersion: request.expectedVersion } : {}),
    acquisition: request.acquisition,
  };
  const response = await fetch(path, {
    method: correcting ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await readMaintenanceJson<{ ok: true; acquisition: MaintenanceAcquisition }>(response);
  return data.acquisition;
}

export type MaintenanceStewardAction = 'transfer_steward';
export type MaintenanceTransferKind = 'sale' | 'gift' | 'inheritance' | 'artist-rebind';

export type MaintenanceStewardActionInput = {
  keeperPieceId: string;
  action: MaintenanceStewardAction;
  targetEmail: string;
  transferKind: MaintenanceTransferKind;
  reason: string;
  expectedStewardVersion: number;
};

export type MaintenanceStewardActionRequest = MaintenanceStewardActionInput & {
  idempotencyKey: string;
};

export type MaintenanceStewardActionAttempt = Readonly<{
  request: Readonly<MaintenanceStewardActionRequest>;
}>;

export type MaintenanceStewardActionResult = {
  keeperPieceId: string;
  artworkId: string;
  keeperUserId: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
  currentDisplayLocation: string | null;
  stewardVersion: number;
};

/** Freeze the exact consequential steward request and retry only that request until resolved. */
export function beginMaintenanceStewardActionAttempt(
  current: MaintenanceStewardActionAttempt | null,
  input: MaintenanceStewardActionInput,
  createKey: () => string = () => crypto.randomUUID(),
): MaintenanceStewardActionAttempt {
  if (current) return current;
  const immutableRequest = Object.freeze({
    keeperPieceId: input.keeperPieceId,
    action: input.action,
    targetEmail: input.targetEmail.trim().toLowerCase(),
    transferKind: input.transferKind,
    reason: input.reason.trim(),
    idempotencyKey: createKey(),
    expectedStewardVersion: input.expectedStewardVersion,
  });
  return Object.freeze({ request: immutableRequest });
}

export async function saveMaintenanceStewardAction(
  request: MaintenanceStewardActionRequest,
): Promise<MaintenanceStewardActionResult> {
  const body = {
    action: request.action,
    targetEmail: request.targetEmail.trim().toLowerCase(),
    transferKind: request.transferKind,
    reason: request.reason.trim(),
    idempotencyKey: request.idempotencyKey.trim(),
    expectedStewardVersion: request.expectedStewardVersion,
  };
  const response = await fetch(
    `/api/admin/maintenance/${encodeURIComponent(request.keeperPieceId)}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = await readMaintenanceJson<{
    ok: true;
    replayed: boolean;
    eventId: string;
    steward: MaintenanceStewardActionResult;
  }>(response);
  return data.steward;
}

export type MaintenancePlateAction = 'correct_link' | 'void_plate' | 'replace_plate';

export type MaintenancePlateActionInput = {
  keeperPieceId: string;
  action: MaintenancePlateAction;
  reason: string;
  expectedRecordVersion: number;
  artworkId?: string;
  editionNumber?: number;
  physicalEngravingMatches?: true;
  physicalDisposition?: string;
};

export type MaintenancePlateActionRequest = MaintenancePlateActionInput & {
  idempotencyKey: string;
};

export type MaintenancePlateActionAttempt = Readonly<{
  request: Readonly<MaintenancePlateActionRequest>;
}>;

export type MaintenancePlateActionResult = {
  action: MaintenancePlateAction;
  record?: {
    keeperPieceId: string;
    pieceId?: string;
    artworkId?: string;
    editionNumber?: number;
    plateStatus?: string;
    physicalDisposition?: string | null;
    recordVersion: number;
  };
  replacement?: IssuedPlatePackage;
};

/** Freeze a plate repair at confirmation so ambiguous retries cannot change its target. */
export function beginMaintenancePlateActionAttempt(
  current: MaintenancePlateActionAttempt | null,
  input: MaintenancePlateActionInput,
  createKey: () => string = () => crypto.randomUUID(),
): MaintenancePlateActionAttempt {
  if (current) return current;
  const request = Object.freeze({
    keeperPieceId: input.keeperPieceId,
    action: input.action,
    ...(input.action === 'correct_link'
      ? {
          artworkId: input.artworkId?.trim().toUpperCase(),
          editionNumber: input.editionNumber,
          physicalEngravingMatches: true as const,
        }
      : { physicalDisposition: input.physicalDisposition?.trim() }),
    reason: input.reason.trim(),
    idempotencyKey: createKey(),
    expectedRecordVersion: input.expectedRecordVersion,
  });
  return Object.freeze({ request });
}

export async function saveMaintenancePlateAction(
  request: MaintenancePlateActionRequest,
): Promise<MaintenancePlateActionResult> {
  const body = {
    action: request.action,
    ...(request.action === 'correct_link'
      ? {
          artworkId: request.artworkId?.trim().toUpperCase(),
          editionNumber: request.editionNumber,
          physicalEngravingMatches: true,
        }
      : { physicalDisposition: request.physicalDisposition?.trim() }),
    reason: request.reason.trim(),
    idempotencyKey: request.idempotencyKey.trim(),
    expectedRecordVersion: request.expectedRecordVersion,
  };
  const response = await fetch(
    `/api/admin/maintenance/${encodeURIComponent(request.keeperPieceId)}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = await readMaintenanceJson<{
    ok: true;
    record?: MaintenancePlateActionResult['record'];
    replacement?: unknown;
  }>(response);
  if (request.action === 'replace_plate') {
    if (!data.record || !Number.isSafeInteger(data.record.recordVersion)) {
      throw new Error('Incomplete plate maintenance response');
    }
    return {
      action: request.action,
      replacement: projectIssuedPlateResponse(data.replacement),
      record: data.record,
    };
  }
  if (!data.record || !Number.isSafeInteger(data.record.recordVersion)) {
    throw new Error('Incomplete plate maintenance response');
  }
  return { action: request.action, record: data.record };
}

export type MaintenanceProvenanceAction = 'create' | 'correct' | 'remove';

export type MaintenanceProvenanceActionInput = {
  keeperPieceId: string;
  action: MaintenanceProvenanceAction;
  provenanceId?: string;
  expectedVersion?: number;
  entry?: MaintenanceProvenanceInput;
  reason: string;
};

export type MaintenanceProvenanceActionRequest = MaintenanceProvenanceActionInput & {
  idempotencyKey: string;
};

export type MaintenanceProvenanceActionAttempt = Readonly<{
  request: Readonly<MaintenanceProvenanceActionRequest>;
}>;

export function beginMaintenanceProvenanceActionAttempt(
  current: MaintenanceProvenanceActionAttempt | null,
  input: MaintenanceProvenanceActionInput,
  createKey: () => string = () => crypto.randomUUID(),
): MaintenanceProvenanceActionAttempt {
  if (current) return current;
  const entry = input.entry ? Object.freeze({ ...input.entry }) : undefined;
  const request = Object.freeze({
    keeperPieceId: input.keeperPieceId,
    action: input.action,
    ...(input.action === 'create' ? { entry } : {}),
    ...(input.action === 'correct'
      ? { provenanceId: input.provenanceId, expectedVersion: input.expectedVersion, entry }
      : {}),
    ...(input.action === 'remove'
      ? { provenanceId: input.provenanceId, expectedVersion: input.expectedVersion }
      : {}),
    reason: input.reason.trim(),
    idempotencyKey: createKey(),
  });
  return Object.freeze({ request });
}

export async function saveMaintenanceProvenanceAction(
  request: MaintenanceProvenanceActionRequest,
): Promise<Record<string, unknown>> {
  const body = {
    action: request.action,
    ...(request.action === 'create' ? { entry: request.entry } : {}),
    ...(request.action === 'correct'
      ? {
          provenanceId: request.provenanceId,
          expectedVersion: request.expectedVersion,
          entry: request.entry,
        }
      : {}),
    ...(request.action === 'remove'
      ? { provenanceId: request.provenanceId, expectedVersion: request.expectedVersion }
      : {}),
    reason: request.reason.trim(),
    idempotencyKey: request.idempotencyKey.trim(),
  };
  const response = await fetch(
    `/api/admin/maintenance/${encodeURIComponent(request.keeperPieceId)}/provenance`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = await readMaintenanceJson<{ ok: true; provenance: Record<string, unknown> }>(response);
  return data.provenance;
}
