import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FULL_ARCHIVE } from '../../data/mockData';
import {
  beginArtistSaleAttempt,
  finishArtistSaleAttempt,
  parseArtistLedgerDetailResponse,
  parseArtistSaleDetailResponse,
  parseArtistSaleMutationResponse,
  parseArtistSaleWorkspaceResponse,
  uploadArtistLedgerMedia,
  type ArtistLedgerDetailResponse,
  type ArtistLedgerMediaRole,
  type ArtistSaleCollectionMutation,
  type ArtistSaleDetailMutation,
  type ArtistSaleDetailResponse,
  type ArtistSaleEdition,
  type ArtistSaleItem,
  type ArtistSaleCorrection,
  type ArtistLedgerMutation,
  type ArtistSaleMoney,
  type ArtistSaleOccurrence,
  type ArtistSaleWorkspaceResponse,
  type FrozenArtistSaleAttempt,
} from '../../utils/artistSales';
import { loadArtworkWorkspace } from '../../utils/artworkWorkspace';
import {
  currencyAmountToInput,
  getMaintenanceDetail,
  isLegacySaleAcquisition,
} from '../../utils/adminRegistryMaintenance';
import {
  beginInvitationCreateAttempt,
  type AdminInvitation,
  type InvitationCreateAttempt,
} from '../../utils/artworkInvitations';
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection } from './AdminPage';

type StartMode = 'records' | 'reconnection' | 'sale';
type WithoutKey<T> = T extends unknown ? Omit<T, 'idempotencyKey'> : never;
type RecordSelection = { kind: 'sale' | 'reconnection'; id: string };
type LegacySaleTarget = { acquisitionId: string; artworkId: string; keeperPieceId: string };
type LegacyLinkCompletion = {
  saleId: string;
  artworkRecordId: string;
  expectedVersion: number;
  attempt: FrozenArtistSaleAttempt<Extract<ArtistSaleDetailMutation, { action: 'linkIdentity' }>> | null;
};
type ReconnectionStatus = ArtistSaleWorkspaceResponse['reconnectionCases'][number]['status'];
type ArtworkDraft = {
  rowId: string;
  artworkId: string;
  editionKind: 'unique' | 'numbered';
  editionNumber: string;
  editionSize: string;
  price: string;
  currency: string;
};
type RegistrationRequest = {
  artworkId: string;
  edition: ArtistSaleEdition;
  idempotencyKey: string;
};
type MediaUploadRequest = {
  artworkRecordId: string;
  role: ArtistLedgerMediaRole;
  file: File;
  idempotencyKey: string;
};

class WorkspaceRequestError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

const inputClass = 'mt-2 block min-h-11 w-full rounded-none border border-wood-300 bg-white px-3 py-2 font-sans text-base text-wood-900';
const labelClass = 'block font-sans text-base font-semibold text-wood-800';
const buttonPrimary = 'collector-button-primary text-base! disabled:cursor-not-allowed';
const buttonSecondary = 'collector-button-secondary text-base! disabled:cursor-not-allowed';
const quietButton = 'min-h-11 border border-wood-300 px-4 py-2 font-sans text-base font-semibold text-wood-800 hover:border-bronze-500';
const statusText: Record<ReconnectionStatus, string> = {
  open: 'Open', partially_resolved: 'Partially resolved', resolved: 'Resolved', closed: 'Closed',
};

const emptyArtwork = (index = 0): ArtworkDraft => ({
  rowId: `${Date.now()}-${index}-${crypto.randomUUID()}`,
  artworkId: '', editionKind: 'unique', editionNumber: '1', editionSize: '',
  price: '', currency: 'USD',
});

function invitationExpiryValue(): string {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

function recordScopeKey(selection: RecordSelection): string {
  return `${selection.kind}:${selection.id}`;
}

function saleArtworkScopeKey(saleId: string, artworkRecordId: string): string {
  return `${saleId}:${artworkRecordId}`;
}

function setScopedValue<T>(current: Record<string, T>, key: string, value: T | null): Record<string, T> {
  if (value === null) {
    if (!Object.hasOwn(current, key)) return current;
    const next = { ...current };
    delete next[key];
    return next;
  }
  return { ...current, [key]: value };
}

function money(amount: string, currency: string): ArtistSaleMoney | null {
  const normalized = amount.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || !/^[A-Za-z]{3}$/.test(currency.trim())) {
    throw new Error('invalid_money');
  }
  return { amountMinor: Math.round(parsed * 100), currency: currency.trim().toUpperCase() };
}

function edition(draft: ArtworkDraft): ArtistSaleEdition | null {
  if (!draft.artworkId) return null;
  if (draft.editionKind === 'unique') return { kind: 'unique' };
  const number = Number(draft.editionNumber);
  const size = draft.editionSize ? Number(draft.editionSize) : null;
  if (!Number.isSafeInteger(number) || number < 1 || (size !== null
    && (!Number.isSafeInteger(size) || size < number))) throw new Error('invalid_edition');
  return { kind: 'numbered', number, size };
}

function occurrence(precision: ArtistSaleOccurrence['precision'], value: string): ArtistSaleOccurrence {
  if (precision === 'unknown') return { precision, value: null };
  if (!value) throw new Error('invalid_occurrence');
  return { precision, value } as ArtistSaleOccurrence;
}

function occurrenceLabel(value: ArtistSaleOccurrence): string {
  if (value.precision === 'unknown') return 'Date unknown';
  if (value.precision === 'year') return value.value;
  if (value.precision === 'month') {
    return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value.value}-01T00:00:00.000Z`));
  }
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value.value}T00:00:00.000Z`));
}

function moneyLabel(value: ArtistSaleMoney | null): string {
  if (!value) return 'Not recorded';
  return `${value.currency} ${(value.amountMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function artworkTitle(artworkId: string | null): string {
  if (!artworkId) return 'Artwork not identified yet';
  const artwork = FULL_ARCHIVE.find(item => item.id === artworkId);
  return artwork ? `${artwork.title} · ${artwork.id}` : artworkId;
}

function editionLabel(value: ArtistSaleItem['edition']): string {
  if (!value) return 'Edition not identified';
  if (value.kind === 'unique') return 'Unique work';
  return value.size ? `Number ${value.number} of ${value.size}` : `Number ${value.number}`;
}

async function jsonRequest(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init });
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const code = value && typeof value === 'object' && 'error' in value && typeof value.error === 'string'
      ? value.error : 'request_failed';
    throw new WorkspaceRequestError(response.status, code);
  }
  return value;
}

function outcome(error: unknown) {
  if (error instanceof WorkspaceRequestError) return { kind: 'http' as const, status: error.status };
  if (error && typeof error === 'object' && 'status' in error && Number.isInteger(Number(error.status))) {
    return { kind: 'http' as const, status: Number(error.status) };
  }
  return { kind: 'network_error' as const };
}

function recoveryMessage(error: unknown): string {
  if (error instanceof WorkspaceRequestError) {
    if (error.status === 401) return 'Administrator sign-in expired. Sign in again, then return to this workspace.';
    if (error.status === 403) return 'The private registry is locked. Unlock it from Artwork registration, then retry here.';
    if (error.status === 409) return 'This record changed elsewhere. Refresh the record, reconcile the new version, then try again.';
    if (error.status >= 500) return 'The response was not definitive. Editing is frozen so this exact attempt can be retried safely.';
    return `The request was not accepted (${error.code}). Correct the highlighted facts and save a new attempt.`;
  }
  return 'The response was not definitive. Editing is frozen so this exact attempt can be retried safely.';
}

function detailRecoveryMessage(error: unknown): string {
  if (error instanceof WorkspaceRequestError) return recoveryMessage(error);
  return 'This sale record could not be verified. No unverified facts are shown. Retry the record or return to the records list.';
}

function saleDraftFrom(detail: ArtistSaleDetailResponse) {
  const sale = detail.effectiveSale;
  return {
    precision: sale.occurrence.precision,
    occurrenceValue: sale.occurrence.value || '',
    buyerEmail: sale.buyerEmail || '',
    totalAmount: sale.total ? String(sale.total.amountMinor / 100) : '',
    totalCurrency: sale.total?.currency || 'USD',
    privateReference: sale.privateReference || '',
    privateNotes: sale.privateNotes || '',
  };
}

function privateText(value: string | null): string {
  return value || 'Not recorded';
}

function reconnectionLabel(value: string | null): string {
  return value ? 'Linked to a private reconnection record' : 'Not linked';
}

function correctionChanges(correction: ArtistSaleCorrection): Array<{
  label: string; before: string; after: string;
}> {
  const changes: Array<{ label: string; before: string; after: string }> = [];
  const add = (label: string, before: string, after: string) => {
    if (before !== after) changes.push({ label, before, after });
  };
  add('Occurrence', occurrenceLabel(correction.before.occurrence), occurrenceLabel(correction.after.occurrence));
  add('Buyer, private', privateText(correction.before.buyerEmail), privateText(correction.after.buyerEmail));
  add('Total, private', moneyLabel(correction.before.total), moneyLabel(correction.after.total));
  add('Private reference', privateText(correction.before.privateReference), privateText(correction.after.privateReference));
  add('Private notes', privateText(correction.before.privateNotes), privateText(correction.after.privateNotes));
  add('Reconnection', reconnectionLabel(correction.before.reconnectionCaseId), reconnectionLabel(correction.after.reconnectionCaseId));
  return changes;
}

const CollectorSales: React.FC = () => {
  const [searchParams] = useSearchParams();
  const deepLinkQuery = searchParams.toString();
  const deepLinkParams = new URLSearchParams(deepLinkQuery);
  const deepLinkedArtworkRecordId = deepLinkParams.getAll('artistArtworkRecordId').length === 1
    ? deepLinkParams.get('artistArtworkRecordId') : null;
  const deepLinkedKeeperPieceId = deepLinkParams.getAll('keeperPieceId').length === 1
    ? deepLinkParams.get('keeperPieceId') : null;
  const deepLinkKeys = [...deepLinkParams.keys()].sort().join('\0');
  const legacySource = deepLinkParams.getAll('source').length === 1
    ? deepLinkParams.get('source') : null;
  const legacyAcquisitionId = deepLinkParams.getAll('acquisitionId').length === 1
    ? deepLinkParams.get('acquisitionId') : null;
  const legacyArtworkId = deepLinkParams.getAll('artworkId').length === 1
    ? deepLinkParams.get('artworkId') : null;
  const legacyKeeperPieceId = deepLinkParams.getAll('keeperPieceId').length === 1
    ? deepLinkParams.get('keeperPieceId') : null;
  const hasExactLegacyTarget = legacySource === 'legacy_acquisition'
    && Boolean(legacyAcquisitionId && legacyArtworkId && legacyKeeperPieceId)
    && deepLinkKeys === 'acquisitionId\0artworkId\0keeperPieceId\0source';
  const hasRecordTarget = Boolean(deepLinkedArtworkRecordId)
    && (deepLinkKeys === 'artistArtworkRecordId'
      || deepLinkKeys === 'artistArtworkRecordId\0keeperPieceId');
  const [workspace, setWorkspace] = useState<ArtistSaleWorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState<StartMode>('records');
  const [selection, setSelection] = useState<RecordSelection | null>(null);
  const [detail, setDetail] = useState<ArtistSaleDetailResponse | null>(null);
  const [detailLoadError, setDetailLoadError] = useState('');
  const [ledgers, setLedgers] = useState<Record<string, ArtistLedgerDetailResponse>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkedTargetLoading, setLinkedTargetLoading] = useState(false);
  const [legacyTarget, setLegacyTarget] = useState<LegacySaleTarget | null>(null);
  const [legacyLinkCompletion, setLegacyLinkCompletion] = useState<LegacyLinkCompletion | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ReconnectionStatus>('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState('');
  const [reconnectionAttempt, setReconnectionAttempt] = useState<FrozenArtistSaleAttempt<ArtistSaleCollectionMutation> | null>(null);
  const [saleAttempt, setSaleAttempt] = useState<FrozenArtistSaleAttempt<ArtistSaleCollectionMutation> | null>(null);
  const [detailAttempts, setDetailAttempts] = useState<Record<string, FrozenArtistSaleAttempt<ArtistSaleDetailMutation | ArtistLedgerMutation>>>({});
  const [ownershipSecrets, setOwnershipSecrets] = useState<Record<string, string>>({});
  const [invitationSecrets, setInvitationSecrets] = useState<Record<string, string>>({});
  const [invitationAttempts, setInvitationAttempts] = useState<Record<string, InvitationCreateAttempt>>({});
  const [registrationAttempts, setRegistrationAttempts] = useState<Record<string, FrozenArtistSaleAttempt<RegistrationRequest>>>({});
  const [uploadAttempts, setUploadAttempts] = useState<Record<string, FrozenArtistSaleAttempt<MediaUploadRequest>>>({});
  const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({});
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const statusRef = useRef<HTMLDivElement>(null);
  const activeSaleIdRef = useRef<string | null>(null);
  const activeSelectionRef = useRef<RecordSelection | null>(null);
  const previousSaleIdRef = useRef<string | null>(null);
  const requestedArtworkRecordIdRef = useRef<string | null>(null);
  const requestedKeeperPieceIdRef = useRef<string | null>(null);

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [privateContext, setPrivateContext] = useState('');
  const [precision, setPrecision] = useState<ArtistSaleOccurrence['precision']>('unknown');
  const [occurrenceValue, setOccurrenceValue] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [totalCurrency, setTotalCurrency] = useState('USD');
  const [privateReference, setPrivateReference] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [linkedCaseId, setLinkedCaseId] = useState('');
  const [artworks, setArtworks] = useState<ArtworkDraft[]>([emptyArtwork()]);
  requestedArtworkRecordIdRef.current = hasRecordTarget ? deepLinkedArtworkRecordId : null;
  requestedKeeperPieceIdRef.current = hasRecordTarget ? deepLinkedKeeperPieceId : null;
  activeSaleIdRef.current = selection?.kind === 'sale' ? selection.id : null;
  activeSelectionRef.current = selection;
  const activeRecordScope = selection ? recordScopeKey(selection) : null;
  const detailAttempt = selection ? detailAttempts[recordScopeKey(selection)] || null : null;

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      const value = await jsonRequest('/api/admin/collector-sales', { signal });
      setWorkspace(parseArtistSaleWorkspaceResponse(value));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setLoadError(recoveryMessage(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!hasRecordTarget) return;
    const controller = new AbortController();
    setSelection(null);
    setDetail(null);
    setDetailLoadError('');
    setLegacyTarget(null);
    setLegacyLinkCompletion(null);
    setMode('records');
    setLinkedTargetLoading(true);
    void loadArtworkWorkspace({
      artistArtworkRecordId: deepLinkedArtworkRecordId!,
      ...(deepLinkedKeeperPieceId ? { keeperPieceId: deepLinkedKeeperPieceId } : {}),
    }, controller.signal).then((linkedWorkspace) => {
      if (controller.signal.aborted) return;
      const saleId = linkedWorkspace.sale?.verifiedSaleId;
      if (linkedWorkspace.salesRecord?.artworkRecordId !== deepLinkedArtworkRecordId || !saleId) {
        throw new Error('linked_sale_not_found');
      }
      setSelection({ kind: 'sale', id: saleId });
    }).catch((error: unknown) => {
      if (controller.signal.aborted
        || (error instanceof DOMException && error.name === 'AbortError')) return;
      setActionError('The linked artwork sale record could not be opened. Return to the artwork workspace and try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLinkedTargetLoading(false);
    });
    return () => controller.abort();
  }, [deepLinkQuery]);

  useEffect(() => {
    if (!hasExactLegacyTarget) return;
    const controller = new AbortController();
    setSelection(null);
    setDetail(null);
    setDetailLoadError('');
    setLegacyTarget(null);
    setLegacyLinkCompletion(null);
    setMode('records');
    setLinkedTargetLoading(true);
    void getMaintenanceDetail(legacyKeeperPieceId!, controller.signal).then((piece) => {
      if (controller.signal.aborted) return;
      const acquisition = piece.acquisitions.find((candidate) => (
        candidate.acquisitionId === legacyAcquisitionId && isLegacySaleAcquisition(candidate)
      ));
      if (piece.id !== legacyKeeperPieceId || piece.public.artworkId !== legacyArtworkId
        || !acquisition || acquisition.keeperPieceId !== legacyKeeperPieceId) {
        throw new Error('legacy_sale_target_mismatch');
      }
      const numbered = piece.public.editionNumber > 0;
      setPrecision(acquisition.acquiredAt ? 'exact' : 'unknown');
      setOccurrenceValue(acquisition.acquiredAt || '');
      setTotalAmount(acquisition.amountMinor !== null && acquisition.currency
        ? currencyAmountToInput(acquisition.amountMinor, acquisition.currency) : '');
      setTotalCurrency(acquisition.currency || 'USD');
      setPrivateReference(acquisition.acquirerReference || '');
      setPrivateNotes(acquisition.privateNotes || '');
      setArtworks([{
        ...emptyArtwork(), artworkId: legacyArtworkId!,
        editionKind: numbered ? 'numbered' : 'unique',
        editionNumber: numbered ? String(piece.public.editionNumber) : '1',
        editionSize: numbered && piece.public.editionSize ? String(piece.public.editionSize) : '',
        price: acquisition.amountMinor !== null && acquisition.currency
          ? currencyAmountToInput(acquisition.amountMinor, acquisition.currency) : '',
        currency: acquisition.currency || 'USD',
      }]);
      setLegacyTarget({
        acquisitionId: legacyAcquisitionId!, artworkId: legacyArtworkId!,
        keeperPieceId: legacyKeeperPieceId!,
      });
      setMode('sale');
    }).catch((error: unknown) => {
      if (controller.signal.aborted
        || (error instanceof DOMException && error.name === 'AbortError')) return;
      setActionError('The exact legacy acquisition could not be verified. No sale can be recorded from this link.');
    }).finally(() => {
      if (!controller.signal.aborted) setLinkedTargetLoading(false);
    });
    return () => controller.abort();
  }, [deepLinkQuery]);

  const loadSale = useCallback(async (saleId: string, signal?: AbortSignal) => {
    setDetailLoading(true);
    setDetailLoadError('');
    try {
      const value = await jsonRequest(`/api/admin/collector-sales/${saleId}`, { signal });
      const parsed = parseArtistSaleDetailResponse(value);
      if (activeSaleIdRef.current !== saleId) return;
      const requestedRecordId = requestedArtworkRecordIdRef.current;
      const requestedKeeperPieceId = requestedKeeperPieceIdRef.current;
      if (requestedRecordId && !parsed.items.some((item) => (
        item.artworkRecordId === requestedRecordId
        && (!requestedKeeperPieceId || item.keeperPieceId === requestedKeeperPieceId)
      ))) throw new Error('linked_artwork_record_missing');
      setDetail(parsed);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (activeSaleIdRef.current !== saleId) return;
      setDetailLoadError(error instanceof Error && error.message === 'linked_artwork_record_missing'
        ? 'This verified sale does not contain the requested artwork record. No mutation target was opened.'
        : detailRecoveryMessage(error));
      setDetail(null);
    } finally {
      if (!signal?.aborted && activeSaleIdRef.current === saleId) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const nextSaleId = selection?.kind === 'sale' ? selection.id : null;
    if (previousSaleIdRef.current && previousSaleIdRef.current !== nextSaleId) setNotice('');
    previousSaleIdRef.current = nextSaleId;
    setDetail(null);
    setInvitations([]);
    setActionError('');
    setDetailLoadError('');
    setLedgers({});
    if (selection?.kind !== 'sale') { setDetailLoading(false); return; }
    const controller = new AbortController();
    void loadSale(selection.id, controller.signal);
    return () => controller.abort();
  }, [selection, loadSale]);

  useEffect(() => {
    if (!detail) return;
    const controller = new AbortController();
    void Promise.all(detail.items.map(async item => {
      try {
        const value = await jsonRequest(`/api/admin/collector-ledger?artworkRecordId=${encodeURIComponent(item.artworkRecordId)}`, { signal: controller.signal });
        const parsed = parseArtistLedgerDetailResponse(value);
        if (!controller.signal.aborted) setLedgers(current => ({ ...current, [item.artworkRecordId]: parsed }));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError(recoveryMessage(error));
      }
    }));
    return () => controller.abort();
  }, [detail?.sale.saleId, detail?.items.map(item => `${item.artworkRecordId}:${item.recordVersion}`).join('|')]);

  useEffect(() => {
    if (!detail?.items.some(item => item.keeperPieceId)) return;
    const controller = new AbortController();
    void jsonRequest('/api/admin/invitations', { signal: controller.signal })
      .then(value => {
        if (!controller.signal.aborted && value && typeof value === 'object' && 'invitations' in value
          && Array.isArray(value.invitations)) setInvitations(value.invitations as AdminInvitation[]);
      })
      .catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setActionError(recoveryMessage(error));
      });
    return () => controller.abort();
  }, [detail?.items.map(item => item.keeperPieceId || '').join('|')]);

  useEffect(() => {
    if (notice || actionError) window.requestAnimationFrame(() => statusRef.current?.focus());
  }, [notice, actionError]);

  const filteredRecords = useMemo(() => {
    if (!workspace) return [];
    const needle = search.trim().toLowerCase();
    const cases = workspace.reconnectionCases
      .filter(item => statusFilter === 'all' || item.status === statusFilter)
      .filter(item => !needle || [item.recipientEmail, item.recipientName, item.privateContext]
        .some(value => value?.toLowerCase().includes(needle)))
      .map(item => ({ kind: 'reconnection' as const, id: item.reconnectionCaseId, sort: item.createdAt, item }));
    const sales = workspace.sales
      .filter(item => !needle || [item.buyerEmail, item.privateReference, item.privateNotes, occurrenceLabel(item.occurrence)]
        .some(value => value?.toLowerCase().includes(needle)))
      .map(item => ({ kind: 'sale' as const, id: item.saleId, sort: item.recordedAt, item }));
    return [...cases, ...sales].sort((a, b) => b.sort.localeCompare(a.sort));
  }, [workspace, search, statusFilter]);

  const resetReconnection = () => {
    setRecipientEmail(''); setRecipientName(''); setPrivateContext(''); setReconnectionAttempt(null);
  };
  const resetSale = () => {
    setPrecision('unknown'); setOccurrenceValue(''); setBuyerEmail(''); setTotalAmount('');
    setTotalCurrency('USD'); setPrivateReference(''); setPrivateNotes(''); setLinkedCaseId('');
    setArtworks([emptyArtwork()]); setSaleAttempt(null); setLegacyLinkCompletion(null);
  };

  const saveReconnection = async (addAnother: boolean) => {
    setBusy('reconnection'); setActionError(''); setNotice('');
    let usedAttempt = reconnectionAttempt;
    try {
      const draft = {
        action: 'createReconnection' as const,
        recipientEmail: recipientEmail.trim().toLowerCase(),
        recipientName: recipientName.trim() || null,
        privateContext: privateContext.trim() || null,
      };
      const attempt = beginArtistSaleAttempt(reconnectionAttempt, draft);
      usedAttempt = attempt;
      setReconnectionAttempt(attempt);
      const value = await jsonRequest('/api/admin/collector-sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.request),
      });
      const parsed = parseArtistSaleMutationResponse(value).result;
      if (!('reconnectionCaseId' in parsed)) throw new Error('invalid_response');
      setReconnectionAttempt(finishArtistSaleAttempt(attempt, { kind: 'success' }));
      await loadWorkspace();
      setNotice('Reconnection saved.');
      if (addAnother) { resetReconnection(); setMode('reconnection'); }
      else { setMode('records'); setSelection({ kind: 'reconnection', id: parsed.reconnectionCaseId }); }
    } catch (error) {
      if (usedAttempt) setReconnectionAttempt(finishArtistSaleAttempt(usedAttempt, outcome(error)));
      setActionError(recoveryMessage(error));
    } finally { setBusy(''); }
  };

  const completeLegacyRelationship = async (completion: LegacyLinkCompletion) => {
    if (!legacyTarget) return false;
    const attempt = beginArtistSaleAttempt(completion.attempt, {
      action: 'linkIdentity',
      artworkRecordId: completion.artworkRecordId,
      keeperPieceId: legacyTarget.keeperPieceId,
      expectedVersion: completion.expectedVersion,
    });
    const pending = { ...completion, attempt };
    setLegacyLinkCompletion(pending);
    setBusy('legacy-link');
    setActionError('');
    try {
      const value = await jsonRequest(`/api/admin/collector-sales/${encodeURIComponent(completion.saleId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.request),
      });
      const linked = parseArtistSaleMutationResponse(value).result;
      if (!('identificationStatus' in linked)
        || linked.artworkRecordId !== completion.artworkRecordId
        || linked.keeperPieceId !== legacyTarget.keeperPieceId
        || linked.identificationStatus !== 'identity_linked') {
        throw new Error('legacy_identity_link_mismatch');
      }
      const completed = await loadArtworkWorkspace({
        artworkId: legacyTarget.artworkId,
        keeperPieceId: legacyTarget.keeperPieceId,
        artistArtworkRecordId: completion.artworkRecordId,
      });
      if (completed.salesRecord?.state !== 'identity_linked'
        || completed.salesRecord.artworkRecordId !== completion.artworkRecordId
        || completed.identity?.keeperPieceId !== legacyTarget.keeperPieceId
        || completed.nextAction?.href.includes('source=legacy_acquisition')) {
        throw new Error('legacy_relationship_incomplete');
      }
      setLegacyLinkCompletion(null);
      setNotice(`Legacy sale verified and linked to ${legacyTarget.keeperPieceId}.`);
      await loadWorkspace();
      setMode('records');
      setSelection({ kind: 'sale', id: completion.saleId });
      return true;
    } catch (error) {
      const retained = error instanceof WorkspaceRequestError
        ? finishArtistSaleAttempt(attempt, { kind: 'http', status: error.status })
        : attempt;
      setLegacyLinkCompletion({ ...completion, attempt: retained });
      setActionError('The verified sale exists, but its exact physical identity link is not confirmed. Retry the unchanged identity link before creating anything else.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveSale = async (addAnother: boolean) => {
    if (legacyLinkCompletion) {
      await completeLegacyRelationship(legacyLinkCompletion);
      return;
    }
    setBusy('sale'); setActionError(''); setNotice('');
    let usedAttempt = saleAttempt;
    try {
      if (legacyTarget && (artworks.length !== 1
        || artworks[0].artworkId !== legacyTarget.artworkId)) {
        throw new Error('legacy_sale_target_mismatch');
      }
      const draft = {
        action: 'createSale' as const,
        occurrence: occurrence(precision, occurrenceValue),
        buyerEmail: buyerEmail.trim().toLowerCase() || null,
        total: money(totalAmount, totalCurrency),
        privateReference: privateReference.trim() || null,
        privateNotes: privateNotes.trim() || null,
        reconnectionCaseId: linkedCaseId || null,
        artworks: artworks.map(row => ({
          artworkRecordId: null, artworkId: row.artworkId || null,
          edition: edition(row), price: money(row.price, row.currency),
        })),
      };
      const attempt = beginArtistSaleAttempt(saleAttempt, draft);
      usedAttempt = attempt;
      setSaleAttempt(attempt);
      const value = await jsonRequest('/api/admin/collector-sales', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.request),
      });
      const parsed = parseArtistSaleMutationResponse(value).result;
      if (!('saleId' in parsed) || !('artworkRecordIds' in parsed)) throw new Error('invalid_response');
      setSaleAttempt(finishArtistSaleAttempt(attempt, { kind: 'success' }));
      if (legacyTarget) {
        if (parsed.artworkRecordIds.length !== 1) throw new Error('legacy_sale_fragment_mismatch');
        const detailValue = await jsonRequest(`/api/admin/collector-sales/${encodeURIComponent(parsed.saleId)}`);
        const createdDetail = parseArtistSaleDetailResponse(detailValue);
        const createdItem = createdDetail.items.find((item) => (
          item.artworkRecordId === parsed.artworkRecordIds[0]
        ));
        if (!createdItem || createdItem.artworkId !== legacyTarget.artworkId
          || createdItem.keeperPieceId !== null || createdItem.identificationStatus !== 'identified') {
          throw new Error('legacy_sale_fragment_mismatch');
        }
        const completion: LegacyLinkCompletion = {
          saleId: parsed.saleId,
          artworkRecordId: createdItem.artworkRecordId,
          expectedVersion: createdItem.recordVersion,
          attempt: null,
        };
        setLegacyLinkCompletion(completion);
        await completeLegacyRelationship(completion);
        return;
      }
      await loadWorkspace();
      setNotice('Verified sale saved.');
      if (addAnother) { resetSale(); setMode('sale'); }
      else { setMode('records'); setSelection({ kind: 'sale', id: parsed.saleId }); }
    } catch (error) {
      if (usedAttempt) setSaleAttempt(finishArtistSaleAttempt(usedAttempt, outcome(error)));
      setActionError(recoveryMessage(error));
    } finally { setBusy(''); }
  };

  const postDetailForScope = async (
    scopedSelection: RecordSelection,
    pathId: string,
    draft: WithoutKey<ArtistSaleDetailMutation | ArtistLedgerMutation>,
    success: string,
  ) => {
    const scopeKey = recordScopeKey(scopedSelection);
    const scopedSaleId = scopedSelection.kind === 'sale' ? scopedSelection.id : null;
    const scopeIsActive = () => activeSelectionRef.current?.kind === scopedSelection.kind
      && activeSelectionRef.current.id === scopedSelection.id;
    setBusy(draft.action); setActionError(''); setNotice('');
    const url = ['append', 'appendSharedSaleMessage', 'selectCertificateImage'].includes(draft.action)
      ? '/api/admin/collector-ledger' : `/api/admin/collector-sales/${pathId}`;
    const attempt = beginArtistSaleAttempt(detailAttempts[scopeKey] || null, draft);
    setDetailAttempts(value => setScopedValue(value, scopeKey, attempt));
    try {
      const value = await jsonRequest(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.request),
      });
      parseArtistSaleMutationResponse(value);
      setDetailAttempts(current => setScopedValue(current, scopeKey, finishArtistSaleAttempt(attempt, { kind: 'success' })));
      if (scopeIsActive()) {
        setNotice(success);
        if (scopedSaleId) await loadSale(scopedSaleId);
      }
      await loadWorkspace();
      return true;
    } catch (error) {
      setDetailAttempts(current => setScopedValue(current, scopeKey, finishArtistSaleAttempt(attempt, outcome(error))));
      if (scopeIsActive()) setActionError(recoveryMessage(error));
      if (scopeIsActive() && error instanceof WorkspaceRequestError && error.status === 409 && scopedSaleId) {
        await loadSale(scopedSaleId);
        await loadWorkspace();
      }
      return false;
    } finally { setBusy(''); }
  };

  const postDetail = async (
    pathId: string,
    draft: WithoutKey<ArtistSaleDetailMutation | ArtistLedgerMutation>,
    success: string,
  ) => {
    if (!selection) return false;
    return postDetailForScope(selection, pathId, draft, success);
  };

  const retryDetail = async () => {
    if (!detailAttempt || !selection) return;
    const scopedSelection = selection;
    const scopeKey = recordScopeKey(scopedSelection);
    const scopedSaleId = scopedSelection.kind === 'sale' ? scopedSelection.id : null;
    const scopeIsActive = () => activeSelectionRef.current?.kind === scopedSelection.kind
      && activeSelectionRef.current.id === scopedSelection.id;
    setBusy('retry-detail'); setActionError(''); setNotice('');
    const action = detailAttempt.request.action;
    const url = ['append', 'appendSharedSaleMessage', 'selectCertificateImage'].includes(action)
      ? '/api/admin/collector-ledger' : `/api/admin/collector-sales/${scopedSelection.id}`;
    try {
      const value = await jsonRequest(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailAttempt.request),
      });
      parseArtistSaleMutationResponse(value);
      setDetailAttempts(current => setScopedValue(current, scopeKey, finishArtistSaleAttempt(detailAttempt, { kind: 'success' })));
      if (scopeIsActive()) {
        setNotice('The frozen action completed with its original request and key.');
        if (scopedSaleId) await loadSale(scopedSaleId);
      }
      await loadWorkspace();
    } catch (error) {
      setDetailAttempts(current => setScopedValue(current, scopeKey, finishArtistSaleAttempt(detailAttempt, outcome(error))));
      if (scopeIsActive()) setActionError(recoveryMessage(error));
    } finally { setBusy(''); }
  };

  const selectedCase = selection?.kind === 'reconnection'
    ? workspace?.reconnectionCases.find(item => item.reconnectionCaseId === selection.id) || null : null;

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Verified sales"
        description="Record real artwork history and reconnect personally with collectors. Buyer details, prices, notes, and evidence remain private to this studio workspace."
      />

      <div ref={statusRef} tabIndex={-1} role="status" className="outline-none">
        {notice && <AdminAlert tone="success" live>{notice}</AdminAlert>}
        {actionError && <AdminAlert tone="error" live>{actionError}</AdminAlert>}
      </div>
      {linkedTargetLoading && (
        <div role="status" aria-label="Loading linked artwork record" className="h-20 animate-pulse bg-wood-100 motion-reduce:animate-none">
          <span className="sr-only">Loading linked artwork record</span>
        </div>
      )}
      {detailAttempt && activeRecordScope && <AdminAlert tone="warning"><p>A detail action has an uncertain response. Every other record action is frozen until this exact body and key are retried, or you explicitly cancel after checking the record.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><button type="button" className={buttonPrimary} disabled={Boolean(busy)} onClick={() => void retryDetail()}>Retry exact action</button><button type="button" className={buttonSecondary} disabled={Boolean(busy)} onClick={() => { setDetailAttempts(value => setScopedValue(value, activeRecordScope, null)); setActionError('Frozen action cancelled. Refresh and verify the record before making a new change.'); }}>Cancel frozen action</button></div></AdminAlert>}

      <div className="grid gap-3 sm:grid-cols-2" aria-label="Start a record">
        <button type="button" className={`${buttonSecondary} w-full text-left`} onClick={() => { setMode('reconnection'); setSelection(null); setNotice(''); setActionError(''); }}>
          <span className="block font-serif text-xl normal-case tracking-normal">Start a reconnection</span>
          <span className="mt-1 block font-sans text-base font-normal normal-case tracking-normal">Make a private place for personal follow-up.</span>
        </button>
        <button type="button" className={`${buttonSecondary} w-full text-left`} onClick={() => { setMode('sale'); setSelection(null); setNotice(''); setActionError(''); }}>
          <span className="block font-serif text-xl normal-case tracking-normal">Record a verified sale</span>
          <span className="mt-1 block font-sans text-base font-normal normal-case tracking-normal">Preserve what is known, including uncertainty.</span>
        </button>
      </div>

      {mode === 'reconnection' && (
        <AdminSection title="Start a reconnection" description="Email is the only required fact. This is a personal follow-up record. The site does not send email.">
          <form className="space-y-5" onSubmit={event => { event.preventDefault(); void saveReconnection(false); }}>
            <label className={labelClass}>Recipient email<input className={inputClass} type="email" required disabled={Boolean(reconnectionAttempt)} value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} /></label>
            <label className={labelClass}>Name, optional<input className={inputClass} disabled={Boolean(reconnectionAttempt)} value={recipientName} onChange={event => setRecipientName(event.target.value)} /></label>
            <label className={labelClass}>Private context, optional<textarea className={`${inputClass} min-h-28`} disabled={Boolean(reconnectionAttempt)} value={privateContext} onChange={event => setPrivateContext(event.target.value)} /></label>
            {reconnectionAttempt && <AdminAlert tone="warning">This exact attempt is frozen after an uncertain response. Retry it unchanged, or cancel after confirming the original did not complete.</AdminAlert>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className={buttonPrimary} disabled={busy === 'reconnection'} type="submit">{reconnectionAttempt ? 'Retry exact reconnection' : 'Save reconnection'}</button>
              <button className={buttonSecondary} disabled={Boolean(reconnectionAttempt) || busy === 'reconnection'} type="button" onClick={() => void saveReconnection(true)}>Save and add another</button>
              {reconnectionAttempt && <button className={buttonSecondary} type="button" onClick={() => { setReconnectionAttempt(null); setActionError('Attempt cancelled. Review the record list before saving again.'); }}>Cancel frozen attempt</button>}
              <button className={buttonSecondary} type="button" onClick={() => setMode('records')}>Back to records</button>
            </div>
          </form>
        </AdminSection>
      )}

      {mode === 'sale' && (
        <AdminSection
          title={legacyTarget ? 'Verify legacy sale' : 'Record a verified sale'}
          description={legacyTarget
            ? 'Review this exact legacy acquisition, then preserve it in the verified sales ledger.'
            : 'Unknown dates and unidentified artworks are valid records. Private buyer and price evidence is never published here.'}
        >
          <form className="space-y-7" onSubmit={event => { event.preventDefault(); void saveSale(false); }}>
            {legacyTarget && (
              <AdminAlert tone="info">
                Legacy acquisition {legacyTarget.acquisitionId} · exact artwork {legacyTarget.artworkId} · physical identity {legacyTarget.keeperPieceId}
              </AdminAlert>
            )}
            {legacyLinkCompletion && (
              <AdminAlert tone="warning">
                The verified sale fragment already exists. Only its frozen exact identity link can be retried here.
              </AdminAlert>
            )}
            <fieldset className="space-y-3" disabled={Boolean(saleAttempt)}>
              <legend className="font-serif text-xl text-wood-900">When did the sale occur?</legend>
              <div className="grid gap-2 sm:grid-cols-4">
                {([['unknown', 'Unknown'], ['year', 'Year'], ['month', 'Month'], ['exact', 'Exact date']] as const).map(([value, label]) => (
                  <label key={value} className="flex min-h-11 items-center gap-3 font-sans text-base text-wood-800"><input className="h-5 w-5" type="radio" name="sale-precision" checked={precision === value} onChange={() => { setPrecision(value); setOccurrenceValue(''); }} />{label}</label>
                ))}
              </div>
            </fieldset>
            {precision === 'year' && <label className={labelClass}>Sale year<input className={inputClass} type="number" min="1000" max="9999" inputMode="numeric" required disabled={Boolean(saleAttempt)} value={occurrenceValue} onChange={event => setOccurrenceValue(event.target.value)} /></label>}
            {precision === 'month' && <label className={labelClass}>Sale month<input className={inputClass} type="month" required disabled={Boolean(saleAttempt)} value={occurrenceValue} onChange={event => setOccurrenceValue(event.target.value)} /></label>}
            {precision === 'exact' && <label className={labelClass}>Sale date<input className={inputClass} type="date" required disabled={Boolean(saleAttempt)} value={occurrenceValue} onChange={event => setOccurrenceValue(event.target.value)} /></label>}
            <div className="grid gap-5 md:grid-cols-2">
              <label className={labelClass}>Buyer email, optional<input className={inputClass} type="email" disabled={Boolean(saleAttempt)} value={buyerEmail} onChange={event => setBuyerEmail(event.target.value)} /></label>
              <label className={labelClass}>Link to reconnection, optional<select className={inputClass} disabled={Boolean(saleAttempt)} value={linkedCaseId} onChange={event => setLinkedCaseId(event.target.value)}><option value="">No linked reconnection</option>{workspace?.reconnectionCases.map(item => <option key={item.reconnectionCaseId} value={item.reconnectionCaseId}>{item.recipientEmail} · {statusText[item.status]}</option>)}</select></label>
              <label className={labelClass}>Total, optional<input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal" disabled={Boolean(saleAttempt)} value={totalAmount} onChange={event => setTotalAmount(event.target.value)} /></label>
              <label className={labelClass}>Total currency<select className={inputClass} disabled={Boolean(saleAttempt)} value={totalCurrency} onChange={event => setTotalCurrency(event.target.value)}>{['USD', 'IDR', 'EUR', 'AUD', 'GBP'].map(value => <option key={value}>{value}</option>)}</select></label>
              <label className={labelClass}>Private reference, optional<input className={inputClass} disabled={Boolean(saleAttempt)} value={privateReference} onChange={event => setPrivateReference(event.target.value)} /></label>
              <label className={labelClass}>Private notes, optional<textarea className={`${inputClass} min-h-24`} disabled={Boolean(saleAttempt)} value={privateNotes} onChange={event => setPrivateNotes(event.target.value)} /></label>
            </div>
            <p className="font-sans text-base text-wood-700">Private buyer and price evidence. Artwork prices can remain blank and do not need to add up to the sale total.</p>
            <div className="border-t border-wood-200">
              {artworks.map((row, index) => (
                <fieldset key={row.rowId} className="space-y-4 border-b border-wood-200 py-6" disabled={Boolean(saleAttempt) || Boolean(legacyTarget)}>
                  <legend className="font-serif text-xl text-wood-900">Artwork {index + 1}</legend>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className={labelClass}>Artwork {index + 1}<select className={inputClass} value={row.artworkId} onChange={event => setArtworks(current => current.map(item => item.rowId === row.rowId ? { ...item, artworkId: event.target.value } : item))}><option value="">Artwork not identified yet</option>{FULL_ARCHIVE.map(item => <option key={item.id} value={item.id}>{item.title} · {item.id}</option>)}</select></label>
                    <label className={labelClass}>Edition kind<select className={inputClass} value={row.editionKind} onChange={event => setArtworks(current => current.map(item => item.rowId === row.rowId ? { ...item, editionKind: event.target.value as ArtworkDraft['editionKind'] } : item))}><option value="unique">Unique work</option><option value="numbered">Numbered edition</option></select></label>
                    {row.editionKind === 'numbered' && <><label className={labelClass}>Edition number<input className={inputClass} type="number" min="1" value={row.editionNumber} onChange={event => setArtworks(current => current.map(item => item.rowId === row.rowId ? { ...item, editionNumber: event.target.value } : item))} /></label><label className={labelClass}>Edition size, optional<input className={inputClass} type="number" min={row.editionNumber || '1'} value={row.editionSize} onChange={event => setArtworks(current => current.map(item => item.rowId === row.rowId ? { ...item, editionSize: event.target.value } : item))} /></label></>}
                    <label className={labelClass}>Price, optional<input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal" value={row.price} onChange={event => setArtworks(current => current.map(item => item.rowId === row.rowId ? { ...item, price: event.target.value } : item))} /></label>
                    <label className={labelClass}>Currency<select className={inputClass} value={row.currency} onChange={event => setArtworks(current => current.map(item => item.rowId === row.rowId ? { ...item, currency: event.target.value } : item))}>{['USD', 'IDR', 'EUR', 'AUD', 'GBP'].map(value => <option key={value}>{value}</option>)}</select></label>
                  </div>
                  {artworks.length > 1 && <button type="button" className={quietButton} onClick={() => setArtworks(current => current.filter(item => item.rowId !== row.rowId))}>Remove artwork {index + 1}</button>}
                </fieldset>
              ))}
            </div>
            {!legacyTarget && <button type="button" className={buttonSecondary} disabled={Boolean(saleAttempt)} onClick={() => setArtworks(current => [...current, emptyArtwork(current.length)])}>Add another artwork</button>}
            {saleAttempt && <AdminAlert tone="warning">This exact request and key are frozen after an uncertain response. Retry without editing, or cancel only after checking the records.</AdminAlert>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button className={buttonPrimary} disabled={Boolean(busy)} type="submit">{legacyLinkCompletion ? 'Retry identity link' : saleAttempt ? 'Retry exact sale' : 'Save verified sale'}</button>
              {!legacyTarget && <button className={buttonSecondary} disabled={Boolean(saleAttempt) || busy === 'sale'} type="button" onClick={() => void saveSale(true)}>Save and add another</button>}
              {saleAttempt && <button className={buttonSecondary} type="button" onClick={() => { setSaleAttempt(null); setActionError('Attempt cancelled. Check the record list before saving again.'); }}>Cancel frozen attempt</button>}
              {!legacyTarget && <button className={buttonSecondary} type="button" onClick={() => setMode('records')}>Back to records</button>}
            </div>
          </form>
        </AdminSection>
      )}

      {mode === 'records' && (
        <AdminSection title="Sales and reconnections" description="Filter the bounded private workspace, then continue one record at a time.">
          <div className="grid gap-5 md:grid-cols-[minmax(16rem,0.75fr)_minmax(0,1.6fr)]">
            <div className={selection ? 'hidden md:block' : 'block'}>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
                <label className={labelClass}>Search records<input className={inputClass} type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
                <label className={labelClass}>Reconnection status<select className={inputClass} value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">All statuses</option>{Object.entries(statusText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              {loading ? (
                <div className="mt-6 space-y-3" role="status" aria-label="Loading verified sales"><div className="h-16 animate-pulse bg-wood-100 motion-reduce:animate-none" /><div className="h-16 animate-pulse bg-wood-100 motion-reduce:animate-none" /><span className="sr-only">Loading verified sales</span></div>
              ) : loadError ? (
                <AdminAlert tone="error"><p>{loadError}</p><button type="button" className={`${buttonSecondary} mt-3`} onClick={() => void loadWorkspace()}>Retry</button></AdminAlert>
              ) : filteredRecords.length === 0 ? (
                <AdminEmptyState title="No records yet" description="Start with the collector email you know, or record a sale with unidentified artworks and refine it later." />
              ) : (
                <div className="mt-6 border-t border-wood-200">
                  {filteredRecords.map(record => (
                    <button key={`${record.kind}-${record.id}`} type="button" className={`block min-h-16 w-full border-b border-wood-200 px-2 py-3 text-left font-sans text-base ${selection?.id === record.id ? 'bg-paper-200' : 'hover:bg-paper-100'}`} onClick={() => setSelection({ kind: record.kind, id: record.id })}>
                      <span className="block font-semibold text-wood-900">{record.kind === 'sale' ? `Sale from ${occurrenceLabel(record.item.occurrence)}` : record.item.recipientName || record.item.recipientEmail}</span>
                      <span className="mt-1 block text-wood-600">{record.kind === 'sale' ? record.item.buyerEmail || 'Buyer not recorded' : `${record.item.recipientEmail} · ${statusText[record.item.status]}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div role="region" aria-label="Selected record workspace" className={selection ? 'block min-w-0' : 'hidden md:block'}>
              {selection && <button type="button" className={`${buttonSecondary} mb-5 md:hidden`} onClick={() => setSelection(null)}>Back to records</button>}
              {!selection ? <AdminEmptyState title="Choose a record" description="Select a sale or reconnection to continue its private history." /> : null}
              {selectedCase && <ReconnectionDetail value={selectedCase} busy={busy || (detailAttempt ? 'frozen' : '')} onAction={async draft => {
                const success = await postDetail(selectedCase.reconnectionCaseId, draft, draft.action === 'recordReconnectionEmail' ? 'Email-sent activity recorded.' : draft.action === 'changeReconnectionStatus' ? 'Reconnection status changed.' : 'Private note added.');
                if (success && draft.action === 'changeReconnectionStatus') await loadWorkspace();
              }} onRecordSale={() => { setLinkedCaseId(selectedCase.reconnectionCaseId); setBuyerEmail(selectedCase.recipientEmail); setMode('sale'); setSelection(null); }} />}
              {selection?.kind === 'sale' && detailLoading && <div role="status" aria-label="Loading sale detail" className="h-40 animate-pulse bg-wood-100 motion-reduce:animate-none" />}
              {selection?.kind === 'sale' && detailLoadError && !detailLoading && <AdminAlert tone="error" live><p>{detailLoadError}</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><button type="button" className={buttonPrimary} onClick={() => void loadSale(selection.id)}>Retry record</button><button type="button" className={buttonSecondary} onClick={() => { setDetailLoadError(''); setSelection(null); }}>Back to records</button></div></AdminAlert>}
              {selection?.kind === 'sale' && detail?.effectiveSale.saleId === selection.id && <SaleDetail
                key={detail.effectiveSale.saleId} detail={detail} ledgers={ledgers} busy={busy || (detailAttempt ? 'frozen' : '')}
                targetArtworkRecordId={deepLinkedArtworkRecordId}
                invitations={invitations}
                registrationAttempts={registrationAttempts} invitationAttempts={invitationAttempts}
                uploadAttempts={uploadAttempts} pendingLinks={pendingLinks}
                ownershipSecrets={ownershipSecrets} invitationSecrets={invitationSecrets}
                onDismissOwnership={artworkRecordId => setOwnershipSecrets(value => setScopedValue(value, saleArtworkScopeKey(detail.effectiveSale.saleId, artworkRecordId), null))}
                onDismissInvitation={artworkRecordId => setInvitationSecrets(value => setScopedValue(value, saleArtworkScopeKey(detail.effectiveSale.saleId, artworkRecordId), null))}
                onRefreshLedger={async artworkRecordId => {
                  const saleId = detail.effectiveSale.saleId;
                  const value = await jsonRequest(`/api/admin/collector-ledger?artworkRecordId=${encodeURIComponent(artworkRecordId)}`);
                  const parsed = parseArtistLedgerDetailResponse(value);
                  if (activeSaleIdRef.current !== saleId) return;
                  setLedgers(current => ({ ...current, [artworkRecordId]: parsed }));
                }}
                onPost={postDetail}
                onUpload={async (item, role, file) => {
                  const saleId = detail.effectiveSale.saleId;
                  const scopeKey = saleArtworkScopeKey(saleId, item.artworkRecordId);
                  const current = uploadAttempts[scopeKey] || null;
                  if (!current && !file) return;
                  const attempt = beginArtistSaleAttempt(current, { artworkRecordId: item.artworkRecordId, role, file: file! });
                  setUploadAttempts(value => setScopedValue(value, scopeKey, attempt));
                  setBusy(`upload-${item.artworkRecordId}`); setActionError('');
                  try {
                    await uploadArtistLedgerMedia(attempt.request);
                    setUploadAttempts(value => setScopedValue(value, scopeKey, finishArtistSaleAttempt(attempt, { kind: 'success' })));
                    const value = await jsonRequest(`/api/admin/collector-ledger?artworkRecordId=${encodeURIComponent(item.artworkRecordId)}`);
                    if (activeSaleIdRef.current !== saleId) return;
                    setLedgers(current => ({ ...current, [item.artworkRecordId]: parseArtistLedgerDetailResponse(value) }));
                    setNotice(`${attempt.request.role === 'certificate_image' ? 'Certificate image' : 'Identification evidence'} uploaded as an immutable media item.`);
                  } catch (error) {
                    setUploadAttempts(value => setScopedValue(value, scopeKey, finishArtistSaleAttempt(attempt, outcome(error))));
                    if (activeSaleIdRef.current === saleId) setActionError(recoveryMessage(error));
                  }
                  finally { setBusy(''); }
                }}
                onCancelUpload={artworkRecordId => {
                  setUploadAttempts(value => setScopedValue(value, saleArtworkScopeKey(detail.effectiveSale.saleId, artworkRecordId), null));
                  setActionError('Frozen upload cancelled. Check private media before trying again.');
                }}
                onRegister={async item => {
                  if (!item.artworkId || !item.edition) return;
                  const saleId = detail.effectiveSale.saleId;
                  const scopeKey = saleArtworkScopeKey(saleId, item.artworkRecordId);
                  setBusy(`register-${item.artworkRecordId}`); setActionError('');
                  const registrationDraft = {
                    artworkId: item.artworkId,
                    edition: item.edition.kind === 'unique' ? { kind: 'unique' as const } : { kind: 'numbered' as const, number: item.edition.number, size: item.edition.size },
                  };
                  const attempt = beginArtistSaleAttempt(registrationAttempts[scopeKey] || null, registrationDraft);
                  setRegistrationAttempts(value => setScopedValue(value, scopeKey, attempt));
                  try {
                    const registration = await jsonRequest('/api/admin/registrations', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(attempt.request),
                    }) as { keeperPieceId?: string; ownershipCode?: string };
                    if (!registration.keeperPieceId) throw new Error('invalid_response');
                    setRegistrationAttempts(value => setScopedValue(value, scopeKey, finishArtistSaleAttempt(attempt, { kind: 'success' })));
                    setPendingLinks(value => setScopedValue(value, scopeKey, registration.keeperPieceId!));
                    if (registration.ownershipCode) setOwnershipSecrets(value => setScopedValue(value, scopeKey, registration.ownershipCode!));
                    const linked = await postDetailForScope({ kind: 'sale', id: saleId }, saleId, {
                      action: 'linkIdentity', artworkRecordId: item.artworkRecordId,
                      keeperPieceId: registration.keeperPieceId, expectedVersion: item.recordVersion,
                    }, 'Artwork registered and linked to this sale record.');
                    if (linked) setPendingLinks(value => setScopedValue(value, scopeKey, null));
                    else if (activeSaleIdRef.current === saleId) setActionError('Registration completed, but identity linking is unresolved. Retry the identity link before creating an invitation.');
                  } catch (error) {
                    setRegistrationAttempts(value => setScopedValue(value, scopeKey, finishArtistSaleAttempt(attempt, outcome(error))));
                    if (activeSaleIdRef.current === saleId) setActionError(recoveryMessage(error));
                  }
                  finally { setBusy(''); }
                }}
                onInvite={async (item, email, expiresAt) => {
                  if (!item.keeperPieceId) return;
                  const saleId = detail.effectiveSale.saleId;
                  const scopeKey = saleArtworkScopeKey(saleId, item.artworkRecordId);
                  setBusy(`invite-${item.artworkRecordId}`); setActionError('');
                  const current = invitationAttempts[scopeKey] || null;
                  const attempt = beginInvitationCreateAttempt(current, { keeperPieceId: item.keeperPieceId, intendedRecipientEmail: email, expiresAt });
                  setInvitationAttempts(value => setScopedValue(value, scopeKey, attempt));
                  try {
                    const value = await jsonRequest('/api/admin/invitations', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(attempt.request),
                    }) as { invitationId?: string; token?: string | null };
                    if (!value.invitationId) throw new Error('invalid_response');
                    setInvitationAttempts(currentValue => setScopedValue(currentValue, scopeKey, null));
                    if (value.token) setInvitationSecrets(currentValue => setScopedValue(currentValue, scopeKey, value.token!));
                    const listed = await jsonRequest('/api/admin/invitations') as { invitations?: AdminInvitation[] };
                    if (activeSaleIdRef.current !== saleId) return;
                    if (Array.isArray(listed.invitations)) setInvitations(listed.invitations);
                    setNotice('Invitation created but not redeemed. The token exists only in this screen memory.');
                  } catch (error) {
                    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
                    if (status >= 400 && status < 500) setInvitationAttempts(value => setScopedValue(value, scopeKey, null));
                    if (activeSaleIdRef.current === saleId) setActionError(recoveryMessage(error));
                  } finally { setBusy(''); }
                }}
                onCancelRegistration={artworkRecordId => { setRegistrationAttempts(value => setScopedValue(value, saleArtworkScopeKey(detail.effectiveSale.saleId, artworkRecordId), null)); setActionError('Frozen registration cancelled. Check registration records before trying again.'); }}
                onCancelInvitation={artworkRecordId => { setInvitationAttempts(value => setScopedValue(value, saleArtworkScopeKey(detail.effectiveSale.saleId, artworkRecordId), null)); setActionError('Frozen invitation cancelled. Check invitation records before trying again.'); }}
                onRetryLink={async item => {
                  const scopeKey = saleArtworkScopeKey(detail.effectiveSale.saleId, item.artworkRecordId);
                  const keeperPieceId = pendingLinks[scopeKey];
                  if (!keeperPieceId) return;
                  const linked = await postDetailForScope({ kind: 'sale', id: detail.effectiveSale.saleId }, detail.effectiveSale.saleId, { action: 'linkIdentity', artworkRecordId: item.artworkRecordId, keeperPieceId, expectedVersion: item.recordVersion }, 'Artwork identity linked to this sale record.');
                  if (linked) setPendingLinks(value => setScopedValue(value, scopeKey, null));
                }}
              />}
            </div>
          </div>
        </AdminSection>
      )}
    </AdminPage>
  );
};

const ReconnectionDetail: React.FC<{
  value: ArtistSaleWorkspaceResponse['reconnectionCases'][number]; busy: string;
  onAction: (draft: WithoutKey<ArtistSaleDetailMutation>) => Promise<void>;
  onRecordSale: () => void;
}> = ({ value, busy, onAction, onRecordSale }) => {
  const [note, setNote] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [status, setStatus] = useState<ReconnectionStatus>(value.status);
  return <div className="space-y-6" aria-labelledby="reconnection-detail-title">
    <div><h3 id="reconnection-detail-title" className="font-serif text-3xl text-wood-900">Reconnection with {value.recipientName || value.recipientEmail}</h3><p className="mt-2 font-sans text-base text-wood-700">{value.recipientEmail} · {statusText[value.status]}</p>{value.privateContext && <p className="mt-3 font-sans text-base text-wood-700">Private context: {value.privateContext}</p>}</div>
    <AdminAlert tone="info">This is a private personal follow-up record. The site does not send email.</AdminAlert>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void onAction({ action: 'addReconnectionNote', note }).then(() => setNote('')); }}><label className={labelClass}>Add private note<textarea required className={`${inputClass} min-h-24`} value={note} onChange={event => setNote(event.target.value)} /></label><button type="submit" className={buttonPrimary} disabled={Boolean(busy)}>Add private note</button></form>
    <form className="space-y-3 border-t border-wood-200 pt-5" onSubmit={event => { event.preventDefault(); void onAction({ action: 'recordReconnectionEmail', note: emailNote.trim() || null }).then(() => setEmailNote('')); }}><label className={labelClass}>Email-sent note, optional<textarea className={`${inputClass} min-h-20`} value={emailNote} onChange={event => setEmailNote(event.target.value)} /></label><button type="submit" className={buttonSecondary} disabled={Boolean(busy)}>Record email sent</button></form>
    <form className="space-y-3 border-t border-wood-200 pt-5" onSubmit={event => { event.preventDefault(); void onAction({ action: 'changeReconnectionStatus', newStatus: status }); }}><label className={labelClass}>Status<select className={inputClass} value={status} onChange={event => setStatus(event.target.value as ReconnectionStatus)}>{Object.entries(statusText).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="submit" className={buttonSecondary} disabled={Boolean(busy)}>Change status</button></form>
    <button type="button" className={buttonPrimary} onClick={onRecordSale}>Record a sale for this reconnection</button>
  </div>;
};

const SaleFactsPanel: React.FC<{
  title: string;
  sale: ArtistSaleDetailResponse['originalSale'];
}> = ({ title, sale }) => <section className="border-y border-wood-200 py-5">
  <h4 className="font-serif text-xl text-wood-900">{title}</h4>
  <p className="mt-1 font-sans text-base text-wood-600">Private studio facts. Buyer details, prices, references, and notes are not public.</p>
  <dl className="mt-4 grid min-w-0 gap-4 font-sans text-base text-wood-700 sm:grid-cols-2">
    <div className="min-w-0"><dt className="font-semibold text-wood-800">Occurrence</dt><dd className="break-words">{occurrenceLabel(sale.occurrence)}</dd></div>
    <div className="min-w-0"><dt className="font-semibold text-wood-800">Buyer, private</dt><dd className="break-words">{privateText(sale.buyerEmail)}</dd></div>
    <div className="min-w-0"><dt className="font-semibold text-wood-800">Total, private</dt><dd>{moneyLabel(sale.total)}</dd></div>
    <div className="min-w-0"><dt className="font-semibold text-wood-800">Private reference</dt><dd className="break-words">{privateText(sale.privateReference)}</dd></div>
    <div className="min-w-0 sm:col-span-2"><dt className="font-semibold text-wood-800">Private notes</dt><dd className="whitespace-pre-wrap break-words">{privateText(sale.privateNotes)}</dd></div>
  </dl>
</section>;

const CorrectionHistory: React.FC<{ corrections: ArtistSaleCorrection[] }> = ({ corrections }) => {
  if (corrections.length === 0) return null;
  return <section>
    <h4 className="font-serif text-xl text-wood-900">Correction history</h4>
    <p className="mt-1 font-sans text-base text-wood-600">Each correction is appended in order. The originally recorded facts above remain unchanged.</p>
    <ol aria-label="Correction history" className="mt-4 border-t border-wood-200">
      {corrections.map((correction, index) => {
        const changes = correctionChanges(correction);
        return <li key={correction.saleEventId} className="min-w-0 border-b border-wood-200 py-4 font-sans text-base text-wood-700">
          <p><strong className="text-wood-900">Correction {index + 1}</strong> · <time dateTime={correction.createdAt}>{new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(correction.createdAt))}</time></p>
          <p className="mt-2 break-words"><span className="font-semibold text-wood-800">Reason:</span> {correction.reason}</p>
          <ul className="mt-3 space-y-2" aria-label={`Changed facts for correction ${index + 1}`}>
            {changes.map(change => <li key={change.label} className="break-words"><span className="font-semibold text-wood-800">{change.label}:</span> {change.before} → {change.after}</li>)}
          </ul>
        </li>;
      })}
    </ol>
  </section>;
};

const SaleDetail: React.FC<{
  detail: ArtistSaleDetailResponse;
  ledgers: Record<string, ArtistLedgerDetailResponse>; invitations: AdminInvitation[];
  targetArtworkRecordId: string | null;
  registrationAttempts: Record<string, FrozenArtistSaleAttempt<RegistrationRequest>>;
  invitationAttempts: Record<string, InvitationCreateAttempt>;
  uploadAttempts: Record<string, FrozenArtistSaleAttempt<MediaUploadRequest>>; busy: string;
  pendingLinks: Record<string, string>;
  ownershipSecrets: Record<string, string>;
  invitationSecrets: Record<string, string>;
  onDismissOwnership: (artworkRecordId: string) => void; onDismissInvitation: (artworkRecordId: string) => void;
  onRefreshLedger: (artworkRecordId: string) => Promise<void>;
  onPost: (pathId: string, draft: WithoutKey<ArtistSaleDetailMutation | ArtistLedgerMutation>, success: string) => Promise<boolean>;
  onUpload: (item: ArtistSaleItem, role: ArtistLedgerMediaRole, file: File | null) => Promise<void>;
  onCancelUpload: (artworkRecordId: string) => void;
  onRegister: (item: ArtistSaleItem) => Promise<void>;
  onInvite: (item: ArtistSaleItem, email: string, expiresAt: string) => Promise<void>;
  onCancelRegistration: (artworkRecordId: string) => void;
  onCancelInvitation: (artworkRecordId: string) => void;
  onRetryLink: (item: ArtistSaleItem) => Promise<void>;
}> = ({ detail, ledgers, invitations, targetArtworkRecordId, registrationAttempts, invitationAttempts, uploadAttempts, pendingLinks, busy, ownershipSecrets, invitationSecrets, onDismissOwnership, onDismissInvitation, onRefreshLedger, onPost, onUpload, onCancelUpload, onRegister, onInvite, onCancelRegistration, onCancelInvitation, onRetryLink }) => {
  const [sharedMessage, setSharedMessage] = useState('');
  const [showCorrection, setShowCorrection] = useState(false);
  const initial = saleDraftFrom(detail);
  const [correction, setCorrection] = useState(initial);
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    setSharedMessage('');
    setShowCorrection(false);
    setCorrection(saleDraftFrom(detail));
    setCorrectionReason('');
  }, [detail.effectiveSale.saleId]);
  useEffect(() => { setCorrection(saleDraftFrom(detail)); }, [detail.effectiveSale.sequence]);

  const hasCorrections = detail.corrections.length > 0;

  return <div className="space-y-8" aria-labelledby="sale-detail-title">
    <div><h3 id="sale-detail-title" className="font-serif text-3xl text-wood-900">Sale from {occurrenceLabel(detail.effectiveSale.occurrence)}</h3><p className="mt-2 font-sans text-base text-wood-700">{detail.items.length} artwork{detail.items.length === 1 ? '' : 's'} · {detail.items.filter(item => item.identificationStatus === 'unresolved').length} unresolved</p></div>
    <SaleFactsPanel title="Originally recorded" sale={detail.originalSale} />
    {hasCorrections && <SaleFactsPanel title="Current corrected record" sale={detail.effectiveSale} />}
    <CorrectionHistory corrections={detail.corrections} />
    <div><button type="button" className={buttonSecondary} onClick={() => setShowCorrection(value => !value)}>Correct sale facts</button>{showCorrection && <form className="mt-5 space-y-4 border-t border-bronze-500 pt-5" onSubmit={async event => { event.preventDefault(); const ok = await onPost(detail.effectiveSale.saleId, { action: 'correctSale', expectedSequence: detail.effectiveSale.sequence, occurrence: occurrence(correction.precision, correction.occurrenceValue), buyerEmail: correction.buyerEmail.trim().toLowerCase() || null, total: money(correction.totalAmount, correction.totalCurrency), privateReference: correction.privateReference.trim() || null, privateNotes: correction.privateNotes.trim() || null, reason: correctionReason }, 'Correction appended. Originally recorded facts remain unchanged.'); if (ok) { setShowCorrection(false); setCorrectionReason(''); } }}><fieldset disabled={Boolean(busy)} className="contents"><p className="font-sans text-base text-wood-700">Corrections append history. They do not erase the originally recorded facts.</p><fieldset><legend className="font-sans text-base font-semibold text-wood-800">Corrected occurrence precision</legend><div className="grid gap-2 sm:grid-cols-4">{([['unknown', 'Unknown'], ['year', 'Year'], ['month', 'Month'], ['exact', 'Exact date']] as const).map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-3 font-sans text-base"><input className="h-5 w-5" type="radio" name="correction-precision" checked={correction.precision === value} onChange={() => setCorrection(current => ({ ...current, precision: value, occurrenceValue: '' }))} />{label}</label>)}</div></fieldset>{correction.precision === 'year' && <label className={labelClass}>Corrected sale year<input className={inputClass} type="number" min="1000" max="9999" required value={correction.occurrenceValue} onChange={event => setCorrection(value => ({ ...value, occurrenceValue: event.target.value }))} /></label>}{correction.precision === 'month' && <label className={labelClass}>Corrected sale month<input className={inputClass} type="month" required value={correction.occurrenceValue} onChange={event => setCorrection(value => ({ ...value, occurrenceValue: event.target.value }))} /></label>}{correction.precision === 'exact' && <label className={labelClass}>Corrected sale date<input className={inputClass} type="date" required value={correction.occurrenceValue} onChange={event => setCorrection(value => ({ ...value, occurrenceValue: event.target.value }))} /></label>}<label className={labelClass}>Corrected buyer email<input className={inputClass} type="email" value={correction.buyerEmail} onChange={event => setCorrection(value => ({ ...value, buyerEmail: event.target.value }))} /></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Corrected total<input className={inputClass} type="number" min="0" step="0.01" value={correction.totalAmount} onChange={event => setCorrection(value => ({ ...value, totalAmount: event.target.value }))} /></label><label className={labelClass}>Corrected currency<select className={inputClass} value={correction.totalCurrency} onChange={event => setCorrection(value => ({ ...value, totalCurrency: event.target.value }))}>{['USD', 'IDR', 'EUR', 'AUD', 'GBP'].map(value => <option key={value}>{value}</option>)}</select></label></div><label className={labelClass}>Corrected private reference<input className={inputClass} value={correction.privateReference} onChange={event => setCorrection(value => ({ ...value, privateReference: event.target.value }))} /></label><label className={labelClass}>Corrected private notes<textarea className={`${inputClass} min-h-24`} value={correction.privateNotes} onChange={event => setCorrection(value => ({ ...value, privateNotes: event.target.value }))} /></label><label className={labelClass}>Correction reason<input className={inputClass} required value={correctionReason} onChange={event => setCorrectionReason(event.target.value)} /></label><button type="submit" className={buttonPrimary}>Save correction</button></fieldset></form>}</div>

    <form className="space-y-3 border-y border-wood-200 py-6" onSubmit={async event => { event.preventDefault(); const ok = await onPost(detail.effectiveSale.saleId, { action: 'appendSharedSaleMessage', saleId: detail.effectiveSale.saleId, artworkRecordIds: detail.items.map(item => item.artworkRecordId), message: sharedMessage }, 'Shared sealed message appended to every artwork in this sale.'); if (ok) setSharedMessage(''); }}><label className={labelClass}>Shared sealed message<textarea className={`${inputClass} min-h-24`} required disabled={Boolean(busy) || Boolean(targetArtworkRecordId)} value={sharedMessage} onChange={event => setSharedMessage(event.target.value)} /></label><p className="font-sans text-base text-wood-700">This sealed note becomes visible only when that artwork is claimed.</p><button className={buttonPrimary} type="submit" disabled={Boolean(busy) || Boolean(targetArtworkRecordId)}>Seal shared message</button></form>

    <div className="border-t border-wood-200">
      {detail.items.map((item, index) => {
        const scopeKey = saleArtworkScopeKey(detail.effectiveSale.saleId, item.artworkRecordId);
        return <ArtworkActions key={scopeKey} index={index} item={item} deepLinkScoped={Boolean(targetArtworkRecordId)} targeted={item.artworkRecordId === targetArtworkRecordId} sale={detail.effectiveSale} ledger={ledgers[item.artworkRecordId]} invitation={invitations.find(value => value.keeperPieceId === item.keeperPieceId)} registrationFrozen={Boolean(registrationAttempts[scopeKey])} invitationFrozen={Boolean(invitationAttempts[scopeKey])} uploadFrozen={Boolean(uploadAttempts[scopeKey])} linkPending={Boolean(pendingLinks[scopeKey])} busy={busy} ownershipSecret={ownershipSecrets[scopeKey] || null} invitationSecret={invitationSecrets[scopeKey] || null} onDismissOwnership={() => onDismissOwnership(item.artworkRecordId)} onDismissInvitation={() => onDismissInvitation(item.artworkRecordId)} onRefreshLedger={onRefreshLedger} onPost={onPost} onUpload={onUpload} onCancelUpload={onCancelUpload} onRegister={onRegister} onInvite={onInvite} onCancelRegistration={onCancelRegistration} onCancelInvitation={onCancelInvitation} onRetryLink={onRetryLink} />;
      })}
    </div>
  </div>;
};

const ArtworkActions: React.FC<{
  index: number; item: ArtistSaleItem; deepLinkScoped: boolean; targeted: boolean; sale: ArtistSaleDetailResponse['sale']; ledger?: ArtistLedgerDetailResponse; invitation?: AdminInvitation; registrationFrozen: boolean; invitationFrozen: boolean; uploadFrozen: boolean; linkPending: boolean; busy: string;
  ownershipSecret: string | null; invitationSecret: string | null;
  onDismissOwnership: () => void; onDismissInvitation: () => void; onRefreshLedger: (id: string) => Promise<void>;
  onPost: (pathId: string, draft: WithoutKey<ArtistSaleDetailMutation | ArtistLedgerMutation>, success: string) => Promise<boolean>;
  onUpload: (item: ArtistSaleItem, role: ArtistLedgerMediaRole, file: File | null) => Promise<void>;
  onCancelUpload: (artworkRecordId: string) => void;
  onRegister: (item: ArtistSaleItem) => Promise<void>; onInvite: (item: ArtistSaleItem, email: string, expiresAt: string) => Promise<void>;
  onCancelRegistration: (artworkRecordId: string) => void; onCancelInvitation: (artworkRecordId: string) => void;
  onRetryLink: (item: ArtistSaleItem) => Promise<void>;
}> = ({ index, item, deepLinkScoped, targeted, sale, ledger, invitation, registrationFrozen, invitationFrozen, uploadFrozen, linkPending, busy, ownershipSecret, invitationSecret, onDismissOwnership, onDismissInvitation, onRefreshLedger, onPost, onUpload, onCancelUpload, onRegister, onInvite, onCancelRegistration, onCancelInvitation, onRetryLink }) => {
  const targetRef = useRef<HTMLFieldSetElement>(null);
  const [identifyId, setIdentifyId] = useState('');
  const [editionKind, setEditionKind] = useState<'unique' | 'numbered'>('unique');
  const [editionNumber, setEditionNumber] = useState('1');
  const [editionSize, setEditionSize] = useState('');
  const [mediaRole, setMediaRole] = useState<ArtistLedgerMediaRole>('identification_evidence');
  const [file, setFile] = useState<File | null>(null);
  const [specificMessage, setSpecificMessage] = useState('');
  const [invitationEmail, setInvitationEmail] = useState(sale.buyerEmail || '');
  const [expiresAt, setExpiresAt] = useState(invitationExpiryValue);
  useEffect(() => {
    setIdentifyId('');
    setEditionKind('unique');
    setEditionNumber('1');
    setEditionSize('');
    setMediaRole('identification_evidence');
    setFile(null);
    setSpecificMessage('');
    setInvitationEmail(sale.buyerEmail || '');
    setExpiresAt(invitationExpiryValue());
  }, [sale.saleId]);
  useEffect(() => {
    if (targeted) window.requestAnimationFrame(() => targetRef.current?.focus());
  }, [targeted, item.artworkRecordId]);
  const artworkWorkspacePath = item.identificationStatus !== 'unresolved' && item.artworkId
    ? `/admin/artworks/${encodeURIComponent(item.artworkId)}?${new URLSearchParams(item.keeperPieceId
        ? { instance: item.keeperPieceId, record: item.artworkRecordId }
        : { record: item.artworkRecordId })}`
    : null;
  return <fieldset ref={targetRef} tabIndex={targeted ? -1 : undefined} className={`space-y-5 border-b py-7 outline-none ${targeted ? 'border-bronze-500 border-l-2 pl-4 focus:ring-2 focus:ring-bronze-400' : 'border-wood-200'}`} aria-label={`Artwork ${index + 1} actions`} disabled={busy === 'frozen' || (deepLinkScoped && !targeted)}>
    <legend className="font-serif text-2xl text-wood-900">Artwork {index + 1}</legend>
    <div><p className="font-sans text-base font-semibold text-wood-900">{artworkTitle(item.artworkId)}</p><p className="mt-1 font-sans text-base text-wood-600">{editionLabel(item.edition)} · {item.identificationStatus === 'unresolved' ? 'Unresolved identification' : item.identificationStatus === 'identity_linked' ? 'Identity linked' : 'Identified'}</p><p className="mt-1 font-sans text-base text-wood-600">Private price: {moneyLabel(item.price)}</p>{artworkWorkspacePath && <p className="mt-3"><Link className={quietButton} to={artworkWorkspacePath}>Open artwork</Link></p>}</div>
    {item.identificationStatus === 'unresolved' && <form className="grid gap-4 sm:grid-cols-2" onSubmit={async event => { event.preventDefault(); const selectedEdition: ArtistSaleEdition = editionKind === 'unique' ? { kind: 'unique' } : { kind: 'numbered', number: Number(editionNumber), size: editionSize ? Number(editionSize) : null }; await onPost(sale.saleId, { action: 'identifyArtwork', artworkRecordId: item.artworkRecordId, artworkId: identifyId, edition: selectedEdition, expectedVersion: item.recordVersion }, 'Artwork identification appended.'); }}><label className={labelClass}>Identify artwork<select className={inputClass} required value={identifyId} onChange={event => setIdentifyId(event.target.value)}><option value="">Choose exact catalog artwork</option>{FULL_ARCHIVE.map(value => <option key={value.id} value={value.id}>{value.title} · {value.id}</option>)}</select></label><label className={labelClass}>Edition<select className={inputClass} value={editionKind} onChange={event => setEditionKind(event.target.value as typeof editionKind)}><option value="unique">Unique work</option><option value="numbered">Numbered edition</option></select></label>{editionKind === 'numbered' && <><label className={labelClass}>Edition number<input className={inputClass} type="number" min="1" value={editionNumber} onChange={event => setEditionNumber(event.target.value)} /></label><label className={labelClass}>Edition size, optional<input className={inputClass} type="number" min={editionNumber || '1'} value={editionSize} onChange={event => setEditionSize(event.target.value)} /></label></>}<button className={buttonPrimary} type="submit" disabled={Boolean(busy)}>Confirm identification</button></form>}
    {uploadFrozen ? <AdminAlert tone="warning"><p>The exact media upload and key are frozen after an uncertain response.</p><div className="mt-3 flex flex-col gap-3 sm:flex-row"><button type="button" className={buttonPrimary} disabled={Boolean(busy)} onClick={() => void onUpload(item, mediaRole, null)}>Retry exact upload</button><button type="button" className={buttonSecondary} disabled={Boolean(busy)} onClick={() => onCancelUpload(item.artworkRecordId)}>Cancel frozen upload</button></div></AdminAlert> : <form className="space-y-4 border-l-2 border-wood-200 pl-4" onSubmit={event => { event.preventDefault(); if (file) void onUpload(item, mediaRole, file).then(() => setFile(null)); }}><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Media role<select className={inputClass} value={mediaRole} onChange={event => setMediaRole(event.target.value as ArtistLedgerMediaRole)}><option value="identification_evidence">Identification evidence</option><option value="certificate_image">Certificate image</option></select></label><label className={labelClass}>Evidence image<input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp" required onChange={event => setFile(event.target.files?.[0] || null)} /></label></div><p className="font-sans text-base text-wood-700">Uploads are immutable collector evidence. Existing evidence is never overwritten or deleted.</p><button className={buttonSecondary} type="submit" disabled={!file || Boolean(busy)}>Upload evidence</button></form>}
    {ledger?.media.length ? <div><h5 className="font-serif text-xl text-wood-900">Private media</h5><div className="mt-2 border-t border-wood-200">{ledger.media.map(media => <div key={media.id} className="flex flex-col gap-2 border-b border-wood-200 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="font-sans text-base text-wood-700">{media.role === 'certificate_image' ? 'Certificate image' : 'Identification evidence'} · Immutable · {Math.ceil(media.byteLength / 1024)} KB {ledger.selectedCertificateImage?.mediaId === media.id && <strong>· Selected certificate image</strong>}</p>{media.role === 'certificate_image' && ledger.selectedCertificateImage?.mediaId !== media.id && <button type="button" className={quietButton} onClick={async () => { const ok = await onPost(sale.saleId, { action: 'selectCertificateImage', artworkRecordId: item.artworkRecordId, mediaId: media.id }, 'Certificate image selection appended.'); if (ok) await onRefreshLedger(item.artworkRecordId); }}>Select as certificate image</button>}</div>)}</div></div> : null}
    <form className="space-y-3" onSubmit={async event => { event.preventDefault(); const ok = await onPost(sale.saleId, { action: 'append', artworkRecordId: item.artworkRecordId, saleId: sale.saleId, message: specificMessage, mediaId: null }, 'Artwork-specific sealed message appended.'); if (ok) setSpecificMessage(''); }}><label className={labelClass}>Artwork-specific sealed message<textarea className={`${inputClass} min-h-24`} required value={specificMessage} onChange={event => setSpecificMessage(event.target.value)} /></label><p className="font-sans text-base text-wood-700">This sealed note becomes visible only when that artwork is claimed.</p><button className={buttonSecondary} type="submit" disabled={Boolean(busy)}>Seal artwork message</button></form>
    {item.ledgerEntries.some(entry => entry.message) && <div><h5 className="font-serif text-xl text-wood-900">Sealed creator messages</h5>{item.ledgerEntries.filter(entry => entry.message).map(entry => <p key={entry.ledgerEntryId} className="mt-2 border-l-2 border-bronze-400 pl-3 font-sans text-base text-wood-700">{entry.message}</p>)}</div>}
    {item.identificationStatus === 'identified' && <div><p className="font-sans text-base text-wood-700">Registration is explicit and optional. It creates an identity but does not claim it for anyone.</p>{linkPending ? <><p className="mt-2 font-sans text-base text-wood-700">Registration completed. The sale identity link still needs a definitive response.</p><button type="button" className={`${buttonPrimary} mt-3`} disabled={Boolean(busy)} onClick={() => void onRetryLink(item)}>Retry identity link</button></> : <button type="button" className={`${buttonPrimary} mt-3`} disabled={Boolean(busy)} onClick={() => void onRegister(item)}>{registrationFrozen ? 'Retry exact registration' : 'Register artwork'}</button>}{registrationFrozen && <AdminAlert tone="warning"><p>The exact registration request and key are frozen after an uncertain response.</p><button type="button" className={`${buttonSecondary} mt-3`} onClick={() => onCancelRegistration(item.artworkRecordId)}>Cancel frozen registration</button></AdminAlert>}</div>}
    {ownershipSecret && <AdminAlert tone="warning"><p>Copy the Ownership Code now. It lives only in this screen memory and cannot be shown again here.</p><p className="mt-2 break-all font-mono text-lg select-all">{ownershipSecret}</p><button type="button" className={`${buttonSecondary} mt-3`} onClick={onDismissOwnership}>Dismiss Ownership Code</button></AdminAlert>}
    {item.identificationStatus === 'identity_linked' && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void onInvite(item, invitationEmail, new Date(expiresAt).toISOString()); }}><p className="font-sans text-base text-wood-700">Creating an invitation is separate and optional. It does not redeem or claim the artwork.</p><label className={labelClass}>Invitation recipient<input className={inputClass} type="email" required disabled={invitationFrozen} value={invitationEmail} onChange={event => setInvitationEmail(event.target.value)} /></label><label className={labelClass}>Invitation expires<input className={inputClass} type="datetime-local" required disabled={invitationFrozen} value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label><button type="submit" className={buttonPrimary} disabled={Boolean(busy)}>{invitationFrozen ? 'Retry exact invitation' : 'Create invitation'}</button>{invitationFrozen && <AdminAlert tone="warning"><p>The exact invitation request and key are frozen after an uncertain response.</p><button type="button" className={`${buttonSecondary} mt-3`} onClick={() => onCancelInvitation(item.artworkRecordId)}>Cancel frozen invitation</button></AdminAlert>}</form>}
    {invitation && <p className="font-sans text-base text-wood-700">Invitation state: <strong>{invitation.status}</strong>. The private token is not retained here.</p>}
    {invitationSecret && <AdminAlert tone="warning"><p>Copy this invitation token now. It is memory-only and the invitation has not been redeemed.</p><p className="mt-2 break-all font-mono text-lg select-all">{invitationSecret}</p><button type="button" className={`${buttonSecondary} mt-3`} onClick={onDismissInvitation}>Dismiss invitation token</button></AdminAlert>}
  </fieldset>;
};

export default CollectorSales;
