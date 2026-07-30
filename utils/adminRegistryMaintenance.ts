export type MaintenanceAcquisitionType =
  | 'sale'
  | 'gift'
  | 'retained'
  | 'loan'
  | 'consignment'
  | 'inheritance'
  | 'other';

const COMMON_MAINTENANCE_CURRENCIES = ['USD', 'IDR', 'KWD', 'CHF', 'NZD', 'CNY'] as const;
type IntlWithSupportedCurrencies = typeof Intl & {
  supportedValuesOf?: (key: 'currency') => string[];
};

function runtimeCurrencyCodes(): string[] {
  const supportedValuesOf = (Intl as IntlWithSupportedCurrencies).supportedValuesOf;
  const runtimeCodes = supportedValuesOf ? supportedValuesOf.call(Intl, 'currency') : [];
  return Array.from(new Set([...COMMON_MAINTENANCE_CURRENCIES, ...runtimeCodes])).sort();
}

/** Runtime-maintained ISO currency choices; the text field also accepts valid codes not suggested here. */
export const MAINTENANCE_CURRENCY_CODES = runtimeCurrencyCodes();

/** Only public fields are allowed to become query-string values. */
export type MaintenanceSearchFilters = {
  publicCode?: string;
  artworkId?: string;
  title?: string;
  editionNumber?: number;
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
  acquisitionType: MaintenanceAcquisitionType;
  acquiredAt: string | null;
  amountMinor: number | null;
  currency: string | null;
  acquirerReference: string | null;
  privateNotes: string | null;
  documentReference: string | null;
  publicProvenance: string | null;
};

export type MaintenanceAcquisition = MaintenanceAcquisitionInput & {
  acquisitionId: string;
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
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error(`Unsupported currency ${code || 'code'}. Enter a valid three-letter ISO currency code.`);
  }
  const supportedValuesOf = (Intl as IntlWithSupportedCurrencies).supportedValuesOf;
  if (supportedValuesOf && !supportedValuesOf.call(Intl, 'currency').includes(code)) {
    throw new Error(`Unsupported currency ${code}. Enter a valid three-letter ISO currency code.`);
  }
  try {
    const options = new Intl.NumberFormat('en', {
      style: 'currency', currency: code, currencyDisplay: 'code', useGrouping: false,
    }).resolvedOptions();
    const exponent = options.maximumFractionDigits;
    if (!Number.isSafeInteger(exponent) || exponent < 0 || exponent > 20) throw new RangeError();
    return { code, exponent };
  } catch {
    throw new Error(`Unsupported currency ${code}. Enter a valid three-letter ISO currency code.`);
  }
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

/** Start one confirmation attempt, or retain its key while its outcome is ambiguous. */
export function beginMaintenanceSaveAttempt(
  currentKey: string | null,
  createKey: () => string = () => crypto.randomUUID(),
): string {
  return currentKey || createKey();
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

type SaveAcquisitionRequest = {
  keeperPieceId: string;
  acquisitionId?: string;
  expectedVersion?: number;
  idempotencyKey: string;
  reason: string;
  acquisition: MaintenanceAcquisitionInput;
};

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
