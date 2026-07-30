export type MaintenanceAcquisitionType =
  | 'sale'
  | 'gift'
  | 'retained'
  | 'loan'
  | 'consignment'
  | 'inheritance'
  | 'other';

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
  reason: string;
  acquisition: MaintenanceAcquisitionInput;
};

export async function saveMaintenanceAcquisition(
  request: SaveAcquisitionRequest,
): Promise<MaintenanceAcquisition> {
  const correcting = typeof request.acquisitionId === 'string' && request.acquisitionId.length > 0;
  const base = `/api/admin/maintenance/${encodeURIComponent(request.keeperPieceId)}/acquisitions`;
  const path = correcting
    ? `${base}/${encodeURIComponent(request.acquisitionId!)}`
    : base;
  const body = {
    idempotencyKey: crypto.randomUUID(),
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
