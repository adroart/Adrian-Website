import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdminAlert,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from './admin/AdminPage';
import {
  beginMaintenanceStewardActionAttempt,
  beginMaintenanceSaveRequestAttempt,
  createMaintenanceRequestGate,
  discardMaintenanceSaveAttempt,
  formatMaintenanceCurrencyAmount,
  getMaintenanceDetail,
  MAINTENANCE_CURRENCY_CODES,
  maintenanceCurrencyAmountToDraft,
  MaintenanceRequestError,
  parseMaintenanceCurrencyAmount,
  saveMaintenanceAcquisition,
  saveMaintenanceStewardAction,
  searchMaintenance,
  shouldRetainMaintenanceSaveAttempt,
  type MaintenanceAcquisition,
  type MaintenanceAcquisitionInput,
  type MaintenanceAcquisitionType,
  type MaintenanceListItem,
  type MaintenancePieceDetail,
  type MaintenanceSearchFilters,
  type MaintenanceSaveAttempt,
  type MaintenanceStewardAction,
  type MaintenanceStewardActionAttempt,
} from '../utils/adminRegistryMaintenance';

type SearchDraft = {
  publicCode: string;
  artworkId: string;
  title: string;
  editionNumber: string;
};

type AcquisitionDraft = {
  acquisitionType: MaintenanceAcquisitionType;
  acquiredAt: string;
  amount: string;
  currency: string;
  preservedUnsupported: { amountMinor: number; currency: string } | null;
  acquirerReference: string;
  privateNotes: string;
  documentReference: string;
  publicProvenance: string;
};

type ReviewState = {
  acquisitionId?: string;
  expectedVersion?: number;
  before: MaintenanceAcquisition | null;
  after: MaintenanceAcquisitionInput;
};

type StewardReviewState = {
  action: MaintenanceStewardAction;
  targetEmail?: string;
  expectedStewardVersion: number;
  before: MaintenancePieceDetail['steward'];
};

const EMPTY_SEARCH: SearchDraft = {
  publicCode: '', artworkId: '', title: '', editionNumber: '',
};

const EMPTY_ACQUISITION: AcquisitionDraft = {
  acquisitionType: 'sale',
  acquiredAt: '',
  amount: '',
  currency: '',
  preservedUnsupported: null,
  acquirerReference: '',
  privateNotes: '',
  documentReference: '',
  publicProvenance: '',
};

const acquisitionTypes: Array<{ value: MaintenanceAcquisitionType; label: string }> = [
  { value: 'sale', label: 'Sale' },
  { value: 'gift', label: 'Gift' },
  { value: 'retained', label: 'Retained' },
  { value: 'loan', label: 'Loan' },
  { value: 'consignment', label: 'Consignment' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'other', label: 'Other' },
];

const inputClass = 'maintenance-input';
const labelClass = 'maintenance-label';
const primaryButtonClass = 'maintenance-button maintenance-button-primary';
const quietButtonClass = 'maintenance-button maintenance-button-quiet';

function messageFor(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const messages: Record<string, string> = {
    registry_locked: 'Private registry access expired. Unlock it again before saving.',
    idempotency_conflict: 'That save could not be safely retried. Review the current record and try again.',
    version_conflict: 'This record changed after you opened it.',
  };
  return messages[error.message] || fallback;
}

function displayDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(value.includes('T') ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function displayEdition(number: number, size: number | null): string {
  if (size === null) return number === 0 ? 'Unique work' : `Edition ${number}`;
  return `${number} of ${size}`;
}

function displayPrivateAmount(acquisition: MaintenanceAcquisitionInput): string {
  if (acquisition.amountMinor === null || !acquisition.currency) return 'Not recorded';
  try {
    return formatMaintenanceCurrencyAmount(acquisition.amountMinor, acquisition.currency);
  } catch {
    return `${acquisition.currency} · stored integer amount ${acquisition.amountMinor}`;
  }
}

function textOrNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function draftFromAcquisition(acquisition?: MaintenanceAcquisition): AcquisitionDraft {
  if (!acquisition) return { ...EMPTY_ACQUISITION };
  const amountDraft = maintenanceCurrencyAmountToDraft(acquisition.amountMinor, acquisition.currency);
  return {
    acquisitionType: acquisition.acquisitionType,
    acquiredAt: acquisition.acquiredAt?.slice(0, 10) || '',
    ...amountDraft,
    acquirerReference: acquisition.acquirerReference || '',
    privateNotes: acquisition.privateNotes || '',
    documentReference: acquisition.documentReference || '',
    publicProvenance: acquisition.publicProvenance || '',
  };
}

function normalizeAcquisitionDraft(draft: AcquisitionDraft): MaintenanceAcquisitionInput {
  const amountEntered = draft.amount.trim() !== '';
  const currency = draft.currency.trim().toUpperCase();
  if (amountEntered !== Boolean(currency)) {
    throw new Error('Enter both the familiar amount and its currency, or leave both blank.');
  }
  let amountMinor: number | null = null;
  if (draft.preservedUnsupported) {
    amountMinor = draft.preservedUnsupported.amountMinor;
  } else if (amountEntered) {
    amountMinor = parseMaintenanceCurrencyAmount(draft.amount, currency);
  }
  return {
    acquisitionType: draft.acquisitionType,
    acquiredAt: textOrNull(draft.acquiredAt),
    amountMinor,
    currency: draft.preservedUnsupported?.currency || (amountEntered ? currency : null),
    acquirerReference: textOrNull(draft.acquirerReference),
    privateNotes: textOrNull(draft.privateNotes),
    documentReference: textOrNull(draft.documentReference),
    publicProvenance: textOrNull(draft.publicProvenance),
  };
}

const DefinitionList: React.FC<{ items: Array<[string, React.ReactNode]> }> = ({ items }) => (
  <dl className="maintenance-definition-list">
    {items.map(([label, value]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>{value ?? 'Not recorded'}</dd>
      </div>
    ))}
  </dl>
);

const AcquisitionSnapshot: React.FC<{ acquisition: MaintenanceAcquisitionInput | null }> = ({ acquisition }) => {
  if (!acquisition) return <p className="maintenance-muted">No prior acquisition record.</p>;
  return (
    <DefinitionList items={[
      ['Type', acquisition.acquisitionType],
      ['Acquired', displayDate(acquisition.acquiredAt)],
      ['Exact amount', displayPrivateAmount(acquisition)],
      ['Acquirer reference', acquisition.acquirerReference],
      ['Private notes', acquisition.privateNotes],
      ['Document reference', acquisition.documentReference],
      ['Public provenance', acquisition.publicProvenance],
    ]} />
  );
};

const StewardSnapshot: React.FC<{
  steward: MaintenancePieceDetail['steward'];
  after?: StewardReviewState;
}> = ({ steward, after }) => {
  if (after?.action === 'reset_steward') {
    return <DefinitionList items={[
      ['Status', 'Unclaimed'],
      ['Steward account', 'Cleared'],
      ['Display location', 'Cleared'],
      ['Claimed', 'Cleared'],
      ['Released', 'Cleared'],
      ['Steward version', after.expectedStewardVersion + 1],
    ]} />;
  }
  if (after?.action === 'transfer_steward') {
    return <DefinitionList items={[
      ['Status', 'Active steward'],
      ['Verified account email', after.targetEmail],
      ['Display location', 'Cleared'],
      ['Claimed', 'Set when saved'],
      ['Released', 'Cleared'],
      ['Steward version', after.expectedStewardVersion + 1],
    ]} />;
  }
  if (!steward) return <p className="maintenance-muted">Unclaimed</p>;
  return <DefinitionList items={[
    ['Email', steward.email],
    ['Status', steward.active ? 'Active steward' : 'Released'],
    ['Display location', steward.currentDisplayLocation],
    ['Claimed', displayDate(steward.claimedAt)],
    ['Released', displayDate(steward.releasedAt)],
    ['Steward version', steward.stewardVersion],
  ]} />;
};

const AdminMaintenance: React.FC = () => {
  const [searchDraft, setSearchDraft] = useState<SearchDraft>(EMPTY_SEARCH);
  const [results, setResults] = useState<MaintenanceListItem[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<MaintenancePieceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editor, setEditor] = useState<MaintenanceAcquisition | null | undefined>(undefined);
  const [acquisitionDraft, setAcquisitionDraft] = useState<AcquisitionDraft>(EMPTY_ACQUISITION);
  const [review, setReview] = useState<ReviewState | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stewardEditor, setStewardEditor] = useState<MaintenanceStewardAction | null>(null);
  const [stewardTargetEmail, setStewardTargetEmail] = useState('');
  const [stewardReview, setStewardReview] = useState<StewardReviewState | null>(null);
  const [stewardReason, setStewardReason] = useState('');
  const [stewardError, setStewardError] = useState('');
  const [stewardSaving, setStewardSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const stewardReasonRef = useRef<HTMLTextAreaElement>(null);
  const saveAttemptRef = useRef<MaintenanceSaveAttempt | null>(null);
  const saveInFlightRef = useRef(false);
  const stewardAttemptRef = useRef<MaintenanceStewardActionAttempt | null>(null);
  const stewardInFlightRef = useRef(false);
  const searchGateRef = useRef(createMaintenanceRequestGate());
  const detailGateRef = useRef(createMaintenanceRequestGate());

  const clearSaveAttempt = () => {
    saveAttemptRef.current = discardMaintenanceSaveAttempt(
      saveAttemptRef.current,
      saveInFlightRef.current,
    );
    return saveAttemptRef.current === null;
  };

  const clearStewardAttempt = () => {
    stewardAttemptRef.current = discardMaintenanceSaveAttempt(
      stewardAttemptRef.current,
      stewardInFlightRef.current,
    );
    return stewardAttemptRef.current === null;
  };

  const clearMaintenanceAttempts = () => clearSaveAttempt() && clearStewardAttempt();
  const transitionBusy = saving || stewardSaving;

  const loadSearch = useCallback(async (filters: MaintenanceSearchFilters = {}, signal?: AbortSignal) => {
    const generation = searchGateRef.current.next();
    setSearching(true);
    setSearchError('');
    try {
      const nextResults = await searchMaintenance(filters, signal);
      if (searchGateRef.current.isCurrent(generation)) setResults(nextResults);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (searchGateRef.current.isCurrent(generation)) {
        setSearchError(messageFor(error, 'Maintenance records could not be loaded.'));
      }
    } finally {
      if (!signal?.aborted && searchGateRef.current.isCurrent(generation)) setSearching(false);
    }
  }, []);

  const loadDetail = useCallback(async (
    keeperPieceId: string,
    signal?: AbortSignal,
  ): Promise<MaintenancePieceDetail> => {
    const generation = detailGateRef.current.next();
    setDetailLoading(true);
    setDetailError('');
    try {
      const detail = await getMaintenanceDetail(keeperPieceId, signal);
      if (!detailGateRef.current.isCurrent(generation)) {
        throw new DOMException('A newer detail request replaced this one.', 'AbortError');
      }
      setSelected(detail);
      return detail;
    } catch (error) {
      if (detailGateRef.current.isCurrent(generation)
        && !(error instanceof DOMException && error.name === 'AbortError')) {
        setDetailError(messageFor(error, 'The private record could not be loaded.'));
      }
      throw error;
    } finally {
      if (!signal?.aborted && detailGateRef.current.isCurrent(generation)) setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadSearch({}, controller.signal);
    void fetch('/api/admin/registry-unlock', { cache: 'no-store', signal: controller.signal })
      .then(response => response.json())
      .then(data => setRegistryUnlocked(data?.ok === true && data?.unlocked === true))
      .catch(() => setRegistryUnlocked(false));
    return () => controller.abort();
  }, [loadSearch]);

  useEffect(() => {
    if (review) reasonRef.current?.focus();
  }, [review]);

  useEffect(() => {
    if (stewardReview) stewardReasonRef.current?.focus();
  }, [stewardReview]);

  const searchFilters = (): MaintenanceSearchFilters => {
    const edition = searchDraft.editionNumber.trim();
    if (edition && (!/^\d+$/.test(edition) || Number(edition) > 9999)) {
      throw new Error('Edition number must be a whole number from 0 to 9999.');
    }
    return {
      publicCode: searchDraft.publicCode,
      artworkId: searchDraft.artworkId,
      title: searchDraft.title,
      ...(edition ? { editionNumber: Number(edition) } : {}),
    };
  };

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clearMaintenanceAttempts()) return;
    try {
      detailGateRef.current.invalidate();
      setSelected(null);
      setEditor(undefined);
      setReview(null);
      setStewardEditor(null);
      setStewardReview(null);
      setNotice('');
      setDetailError('');
      void loadSearch(searchFilters());
    } catch (error) {
      setSearchError(messageFor(error, 'Check the public search fields.'));
    }
  };

  const clearSearch = () => {
    if (!clearMaintenanceAttempts()) return;
    detailGateRef.current.invalidate();
    setSearchDraft(EMPTY_SEARCH);
    setSelected(null);
    setEditor(undefined);
    setReview(null);
    setStewardEditor(null);
    setStewardReview(null);
    setNotice('');
    setDetailError('');
    void loadSearch({});
  };

  const openDetail = (item: MaintenanceListItem) => {
    if (!clearMaintenanceAttempts()) return;
    setSelected(null);
    setEditor(undefined);
    setReview(null);
    setStewardEditor(null);
    setStewardReview(null);
    setNotice('');
    void loadDetail(item.id).catch(() => undefined);
  };

  const openEditor = (acquisition: MaintenanceAcquisition | null) => {
    if (!clearMaintenanceAttempts()) return;
    setStewardEditor(null);
    setStewardReview(null);
    setEditor(acquisition);
    setAcquisitionDraft(draftFromAcquisition(acquisition || undefined));
    setReview(null);
    setReason('');
    setFormError('');
    setNotice('');
  };

  const closeEditor = () => {
    if (!clearSaveAttempt()) return;
    setEditor(undefined);
    setReview(null);
    setReason('');
    setFormError('');
  };

  const openStewardEditor = (action: MaintenanceStewardAction) => {
    if (!selected || !clearMaintenanceAttempts()) return;
    setEditor(undefined);
    setReview(null);
    setReason('');
    setFormError('');
    setStewardEditor(action);
    setStewardTargetEmail('');
    setStewardReason('');
    setStewardError('');
    setNotice('');
    if (action === 'reset_steward' && selected.steward) {
      setStewardReview({
        action,
        expectedStewardVersion: selected.steward.stewardVersion,
        before: selected.steward,
      });
    } else {
      setStewardReview(null);
    }
  };

  const closeStewardEditor = () => {
    if (!clearStewardAttempt()) return;
    setStewardEditor(null);
    setStewardReview(null);
    setStewardTargetEmail('');
    setStewardReason('');
    setStewardError('');
  };

  const prepareStewardTransferReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !clearStewardAttempt()) return;
    const targetEmail = stewardTargetEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail) || targetEmail.length > 254) {
      setStewardError('Enter the exact email for an existing verified account.');
      return;
    }
    setStewardReview({
      action: 'transfer_steward',
      targetEmail,
      expectedStewardVersion: selected.stewardVersion,
      before: selected.steward,
    });
    setStewardReason('');
    setStewardError('');
  };

  const prepareReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clearSaveAttempt()) return;
    try {
      const after = normalizeAcquisitionDraft(acquisitionDraft);
      setReview({
        ...(editor ? { acquisitionId: editor.acquisitionId, expectedVersion: editor.recordVersion } : {}),
        before: editor || null,
        after,
      });
      setReason('');
      setFormError('');
    } catch (error) {
      setFormError(messageFor(error, 'Check the private acquisition fields.'));
    }
  };

  const backToEditor = () => {
    if (!clearSaveAttempt()) return;
    setReview(null);
    setFormError('');
  };

  const unlockRegistry = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = unlockInputRef.current;
    if (!input?.value) {
      setUnlockError('Enter the registry secret.');
      return;
    }
    setUnlockBusy(true);
    setUnlockError('');
    const secret = input.value;
    input.value = '';
    try {
      const response = await fetch('/api/admin/registry-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'unlock_failed');
      setRegistryUnlocked(true);
      setNotice('Private registry unlocked for this administrator session.');
    } catch (error) {
      setRegistryUnlocked(false);
      setUnlockError(messageFor(error, 'The registry could not be unlocked.'));
    } finally {
      setUnlockBusy(false);
    }
  };

  const confirmSave = async () => {
    if (!selected || !review) return;
    if (!reason.trim()) {
      setFormError('A reason is required before this change can be saved.');
      reasonRef.current?.focus();
      return;
    }
    if (!registryUnlocked) {
      setFormError('Unlock the private registry before confirming this change.');
      return;
    }
    const attempt = beginMaintenanceSaveRequestAttempt(saveAttemptRef.current, {
      keeperPieceId: selected.id,
      ...(review.acquisitionId ? {
        acquisitionId: review.acquisitionId,
        expectedVersion: review.expectedVersion,
      } : {}),
      reason,
      acquisition: review.after,
    });
    saveAttemptRef.current = attempt;
    saveInFlightRef.current = true;
    setSaving(true);
    setFormError('');
    try {
      await saveMaintenanceAcquisition(attempt.request);
      saveInFlightRef.current = false;
      saveAttemptRef.current = null;
      const savedMessage = review.acquisitionId
        ? 'Acquisition correction saved.'
        : 'Acquisition recorded.';
      setNotice(savedMessage);
      closeEditor();
      try {
        await loadDetail(attempt.request.keeperPieceId);
      } catch {
        setNotice(`${savedMessage} It was saved, but the private detail could not be refreshed. Reload the record before making another change.`);
      }
    } catch (error) {
      saveInFlightRef.current = false;
      if (!shouldRetainMaintenanceSaveAttempt(error)) saveAttemptRef.current = null;
      if (error instanceof MaintenanceRequestError && error.code === 'registry_locked') {
        setRegistryUnlocked(false);
      }
      if (error instanceof MaintenanceRequestError && error.code === 'version_conflict') {
        try {
          await loadDetail(attempt.request.keeperPieceId);
          setReview(null);
          setEditor(undefined);
          setNotice('The acquisition changed after you opened it. The latest detail has been reloaded; review it before trying again.');
        } catch {
          setFormError('The acquisition changed, but the latest detail could not be reloaded. Your draft is preserved; retry the reload before editing further.');
        }
      } else {
        setFormError(messageFor(error, 'The outcome could not be confirmed. Retry this unchanged confirmation to safely check the same save attempt.'));
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const confirmStewardSave = async () => {
    if (!selected || !stewardReview) return;
    if (!stewardReason.trim()) {
      setStewardError('A reason is required before this steward change can be saved.');
      stewardReasonRef.current?.focus();
      return;
    }
    if (!registryUnlocked) {
      setStewardError('Unlock the private registry before confirming this change.');
      return;
    }
    const attempt = beginMaintenanceStewardActionAttempt(stewardAttemptRef.current, {
      keeperPieceId: selected.id,
      action: stewardReview.action,
      ...(stewardReview.action === 'transfer_steward'
        ? { targetEmail: stewardReview.targetEmail }
        : {}),
      reason: stewardReason,
      expectedStewardVersion: stewardReview.expectedStewardVersion,
    });
    stewardAttemptRef.current = attempt;
    stewardInFlightRef.current = true;
    setStewardSaving(true);
    setStewardError('');
    try {
      const saved = await saveMaintenanceStewardAction(attempt.request);
      stewardInFlightRef.current = false;
      stewardAttemptRef.current = null;
      const savedMessage = stewardReview.action === 'reset_steward'
        ? 'Steward reset saved. This artwork is now Unclaimed.'
        : `Steward transfer saved for ${stewardReview.targetEmail}. The display location was cleared.`;
      setSelected(current => {
        if (!current || current.id !== attempt.request.keeperPieceId) return current;
        return {
          ...current,
          stewardVersion: saved.stewardVersion,
          steward: saved.keeperUserId === null ? null : {
            userId: saved.keeperUserId,
            email: stewardReview.targetEmail ?? null,
            active: saved.releasedAt === null,
            currentDisplayLocation: saved.currentDisplayLocation,
            claimedAt: saved.claimedAt,
            releasedAt: saved.releasedAt,
            stewardVersion: saved.stewardVersion,
          },
        };
      });
      setStewardEditor(null);
      setStewardReview(null);
      setStewardTargetEmail('');
      setStewardReason('');
      setNotice(savedMessage);
      try {
        await loadDetail(attempt.request.keeperPieceId);
      } catch {
        setNotice(`${savedMessage} It was saved, but the private detail could not be refreshed. Reload the record before making another change.`);
      }
    } catch (error) {
      stewardInFlightRef.current = false;
      if (!shouldRetainMaintenanceSaveAttempt(error)) stewardAttemptRef.current = null;
      if (error instanceof MaintenanceRequestError
        && (error.code === 'registry_locked' || error.status === 401 || error.status === 403)) {
        setRegistryUnlocked(false);
      }
      if (error instanceof MaintenanceRequestError && error.code === 'version_conflict') {
        try {
          await loadDetail(attempt.request.keeperPieceId);
          setStewardReview(null);
          setStewardEditor(null);
          setNotice('The steward changed after you opened it. The latest detail has been reloaded; review it before trying again.');
        } catch {
          setStewardError('The steward changed, but the latest detail could not be reloaded. Your review is preserved; retry the reload before editing further.');
        }
      } else {
        setStewardError(messageFor(error, 'The outcome could not be confirmed. Retry this unchanged confirmation to safely check the same steward action.'));
      }
    } finally {
      stewardInFlightRef.current = false;
      setStewardSaving(false);
    }
  };

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Private registry"
        title="Maintenance"
        description="Find a physical artwork by public identity, then review private acquisition, steward, plate, and change history in one place."
      />

      <div className="sr-only" aria-live="polite">{searching ? 'Searching Maintenance records.' : ''}</div>
      {notice && <AdminAlert tone="info" live><p>{notice}</p></AdminAlert>}

      <form className="maintenance-search" onSubmit={submitSearch} aria-label="Search Maintenance records">
        <div className="maintenance-search-heading">
          <div>
            <h2>Find an artwork</h2>
            <p>Search fields are public identity only. Private values never enter the URL.</p>
          </div>
          <div className="maintenance-actions">
            <button type="button" className={quietButtonClass} onClick={clearSearch} disabled={transitionBusy}>Clear</button>
            <button type="submit" className={primaryButtonClass} disabled={searching || transitionBusy}>Search Maintenance</button>
          </div>
        </div>
        <div className="maintenance-search-grid">
          <label htmlFor="maintenance-public-code">
            <span className={labelClass}>Public code</span>
            <input id="maintenance-public-code" className={inputClass} value={searchDraft.publicCode} onChange={event => setSearchDraft(draft => ({ ...draft, publicCode: event.target.value }))} autoComplete="off" />
          </label>
          <label htmlFor="maintenance-artwork-id">
            <span className={labelClass}>Artwork ID</span>
            <input id="maintenance-artwork-id" className={inputClass} value={searchDraft.artworkId} onChange={event => setSearchDraft(draft => ({ ...draft, artworkId: event.target.value }))} autoComplete="off" />
          </label>
          <label htmlFor="maintenance-title">
            <span className={labelClass}>Title</span>
            <input id="maintenance-title" className={inputClass} value={searchDraft.title} onChange={event => setSearchDraft(draft => ({ ...draft, title: event.target.value }))} autoComplete="off" />
          </label>
          <label htmlFor="maintenance-edition">
            <span className={labelClass}>Edition number</span>
            <input id="maintenance-edition" className={inputClass} inputMode="numeric" value={searchDraft.editionNumber} onChange={event => setSearchDraft(draft => ({ ...draft, editionNumber: event.target.value }))} autoComplete="off" />
          </label>
        </div>
      </form>

      {searching && <p className="maintenance-loading" role="status">Searching Maintenance records…</p>}
      {searchError && <p className="maintenance-inline-error" role="alert">{searchError}</p>}
      {!searching && !searchError && results.length === 0 && (
        <AdminEmptyState title="No matching artworks" description="Adjust the public identity fields and search again." />
      )}
      {!searching && results.length > 0 && (
        <div className="maintenance-results" aria-label="Maintenance search results">
          {results.map(item => (
            <button
              type="button"
              key={item.id}
              className={selected?.id === item.id ? 'maintenance-result is-selected' : 'maintenance-result'}
              onClick={() => openDetail(item)}
              disabled={transitionBusy}
              aria-pressed={selected?.id === item.id}
              aria-label={`${item.title}, ${item.publicCode || item.artworkId}`}
            >
              <span>
                <strong>{item.title}</strong>
                <small>{item.artworkId} · {displayEdition(item.editionNumber, null)} · {item.publicCode || 'No public code'}</small>
              </span>
              <span className="maintenance-result-state">Open private detail</span>
            </button>
          ))}
        </div>
      )}

      {detailLoading && <p className="maintenance-loading" role="status">Loading private detail…</p>}
      {detailError && <p className="maintenance-inline-error" role="alert">{detailError}</p>}
      {!selected && !detailLoading && results.length > 0 && (
        <AdminEmptyState title="Choose an artwork" description="Open one search result to see its private Maintenance detail." />
      )}

      {selected && !detailLoading && (
        <div className="maintenance-detail">
          <div className="maintenance-detail-heading">
            <p className="admin-eyebrow">{selected.public.publicCode || selected.public.artworkId}</p>
            <h2>{selected.public.title}</h2>
            <p>{selected.acquisitions.length} acquisition record{selected.acquisitions.length === 1 ? '' : 's'} · record version {selected.physical.recordVersion}</p>
          </div>

          <AdminSection title="Current public truth">
            <DefinitionList items={[
              ['Artwork ID', selected.public.artworkId],
              ['Title', selected.public.title],
              ['Series', selected.public.series],
              ['Edition', displayEdition(selected.public.editionNumber, selected.public.editionSize)],
              ['Public code', selected.public.publicCode],
              ['Plate status', selected.public.plateStatus],
            ]} />
          </AdminSection>

          <AdminSection title="Physical plate">
            <DefinitionList items={[
              ['Registered', displayDate(selected.physical.registeredAt)],
              ['Plate generated', displayDate(selected.physical.plateGeneratedAt)],
              ['Plate activated', displayDate(selected.physical.plateActivatedAt)],
              ['Record version', selected.physical.recordVersion],
              ['Recovery verifier', selected.physical.recovery.verifierPresent ? 'Present' : 'Missing'],
              ['Encrypted envelope', selected.physical.recovery.envelopePresent ? 'Present' : 'Missing'],
              ['Backup status', selected.physical.recovery.backupStatus],
              ['Backup checked', displayDate(selected.physical.recovery.backupAt)],
            ]} />
          </AdminSection>

          <AdminSection title="Private acquisition" description="Exact amounts and collector references stay inside this authenticated detail.">
            <div className="maintenance-section-actions">
              <button type="button" className={primaryButtonClass} onClick={() => openEditor(null)} disabled={transitionBusy}>Record acquisition</button>
            </div>
            {selected.acquisitions.length === 0 ? (
              <AdminEmptyState title="No acquisition recorded" description="Record a sale, gift, retained work, loan, or other acquisition event." />
            ) : (
              <div className="maintenance-acquisitions">
                {selected.acquisitions.map(acquisition => (
                  <article key={acquisition.acquisitionId} className="maintenance-acquisition-row">
                    <div>
                      <strong>{acquisition.acquisitionType}</strong>
                      <span>{displayDate(acquisition.acquiredAt)} · {displayPrivateAmount(acquisition)}</span>
                      {acquisition.acquirerReference && <span>Reference: {acquisition.acquirerReference}</span>}
                    </div>
                    <button type="button" className={quietButtonClass} onClick={() => openEditor(acquisition)} disabled={transitionBusy} aria-label={`Correct acquisition ${acquisition.acquisitionId}`}>Correct record</button>
                  </article>
                ))}
              </div>
            )}

            {editor !== undefined && !review && (
              <form className="maintenance-acquisition-form" onSubmit={prepareReview}>
                <h3>{editor ? 'Correct acquisition' : 'Record acquisition'}</h3>
                <p>Nothing is saved until you review the exact before and after values.</p>
                <div className="maintenance-form-grid">
                  <label htmlFor="maintenance-acquisition-type">
                    <span className={labelClass}>Acquisition type</span>
                    <select id="maintenance-acquisition-type" className={inputClass} value={acquisitionDraft.acquisitionType} onChange={event => setAcquisitionDraft(draft => ({ ...draft, acquisitionType: event.target.value as MaintenanceAcquisitionType }))}>
                      {acquisitionTypes.map(type => <option value={type.value} key={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label htmlFor="maintenance-acquired-at">
                    <span className={labelClass}>Acquired date</span>
                    <input id="maintenance-acquired-at" className={inputClass} type="date" value={acquisitionDraft.acquiredAt} onChange={event => setAcquisitionDraft(draft => ({ ...draft, acquiredAt: event.target.value }))} />
                  </label>
                  <label htmlFor="maintenance-amount">
                    <span className={labelClass}>Amount paid</span>
                    <input id="maintenance-amount" className={inputClass} inputMode="decimal" type="text" value={acquisitionDraft.amount} onChange={event => setAcquisitionDraft(draft => ({ ...draft, amount: event.target.value }))} placeholder="1250.00" autoComplete="off" readOnly={Boolean(acquisitionDraft.preservedUnsupported)} />
                    {acquisitionDraft.preservedUnsupported ? (
                      <small className="maintenance-helper">This stored integer amount is preserved exactly because its currency is outside the current policy.</small>
                    ) : (
                      <small className="maintenance-helper">Enter the familiar amount exactly as you would normally write it. Decimals are validated for the selected currency and are never rounded.</small>
                    )}
                  </label>
                  <label htmlFor="maintenance-currency">
                    <span className={labelClass}>Currency</span>
                    <input id="maintenance-currency" className={inputClass} list="maintenance-currency-options" maxLength={3} value={acquisitionDraft.currency} onChange={event => setAcquisitionDraft(draft => ({ ...draft, currency: event.target.value.toUpperCase() }))} placeholder="USD" autoComplete="off" readOnly={Boolean(acquisitionDraft.preservedUnsupported)} />
                    <datalist id="maintenance-currency-options">
                      {MAINTENANCE_CURRENCY_CODES.map(code => <option key={code} value={code} />)}
                    </datalist>
                  </label>
                  {acquisitionDraft.preservedUnsupported && (
                    <div className="maintenance-field-wide maintenance-actions">
                      <button type="button" className={quietButtonClass} onClick={() => setAcquisitionDraft(draft => ({ ...draft, amount: '', currency: '', preservedUnsupported: null }))}>Replace stored amount and currency</button>
                    </div>
                  )}
                  <label htmlFor="maintenance-acquirer-reference">
                    <span className={labelClass}>Acquirer reference</span>
                    <input id="maintenance-acquirer-reference" className={inputClass} value={acquisitionDraft.acquirerReference} onChange={event => setAcquisitionDraft(draft => ({ ...draft, acquirerReference: event.target.value }))} autoComplete="off" />
                  </label>
                  <label htmlFor="maintenance-document-reference">
                    <span className={labelClass}>Document reference</span>
                    <input id="maintenance-document-reference" className={inputClass} value={acquisitionDraft.documentReference} onChange={event => setAcquisitionDraft(draft => ({ ...draft, documentReference: event.target.value }))} autoComplete="off" />
                  </label>
                  <label className="maintenance-field-wide" htmlFor="maintenance-private-notes">
                    <span className={labelClass}>Private notes</span>
                    <textarea id="maintenance-private-notes" className={inputClass} rows={4} value={acquisitionDraft.privateNotes} onChange={event => setAcquisitionDraft(draft => ({ ...draft, privateNotes: event.target.value }))} />
                  </label>
                  <label className="maintenance-field-wide" htmlFor="maintenance-public-provenance">
                    <span className={labelClass}>Public provenance</span>
                    <textarea id="maintenance-public-provenance" className={inputClass} rows={3} value={acquisitionDraft.publicProvenance} onChange={event => setAcquisitionDraft(draft => ({ ...draft, publicProvenance: event.target.value }))} />
                  </label>
                </div>
                {formError && <p className="maintenance-inline-error" role="alert">{formError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closeEditor} disabled={saving}>Cancel</button>
                  <button type="submit" className={primaryButtonClass}>Review acquisition</button>
                </div>
              </form>
            )}

            {review && (
              <div className="maintenance-review" aria-labelledby="maintenance-review-title">
                <div className="maintenance-review-heading">
                  <p className="admin-eyebrow">Confirmation required</p>
                  <h3 id="maintenance-review-title">Review acquisition change</h3>
                  <p>Compare every private value. The reason and administrator identity will be retained in append-only history.</p>
                </div>
                <div className="maintenance-review-grid">
                  <div><h4>Before</h4><AcquisitionSnapshot acquisition={review.before} /></div>
                  <div><h4>After</h4><AcquisitionSnapshot acquisition={review.after} /></div>
                </div>
                <label htmlFor="maintenance-reason">
                  <span className={labelClass}>Reason for this change</span>
                  <textarea ref={reasonRef} id="maintenance-reason" className={inputClass} rows={3} required value={reason} disabled={saving} onChange={event => { clearSaveAttempt(); setReason(event.target.value); }} />
                </label>
                {!registryUnlocked && (
                  <AdminAlert tone="warning">
                    <p>Unlock the private registry before confirming this consequential change.</p>
                    <form className="maintenance-unlock-form" onSubmit={unlockRegistry}>
                      <label htmlFor="maintenance-registry-secret">
                        <span className={labelClass}>Registry secret</span>
                        <input ref={unlockInputRef} id="maintenance-registry-secret" className={inputClass} type="password" autoComplete="current-password" />
                      </label>
                      <button type="submit" className={quietButtonClass} disabled={unlockBusy}>{unlockBusy ? 'Unlocking…' : 'Unlock registry'}</button>
                    </form>
                    {unlockError && <p className="maintenance-inline-error" role="alert">{unlockError}</p>}
                  </AdminAlert>
                )}
                {registryUnlocked && <p className="maintenance-unlocked" role="status">Private registry unlocked for saving.</p>}
                {formError && <p className="maintenance-inline-error" role="alert">{formError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={backToEditor} disabled={saving}>Back to edit</button>
                  <button type="button" className={primaryButtonClass} onClick={() => void confirmSave()} disabled={saving || !registryUnlocked || !reason.trim()}>{saving ? 'Saving…' : 'Confirm save'}</button>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection title="Current steward">
            {selected.steward ? (
              <>
                <div className="maintenance-section-actions">
                  <button type="button" className={quietButtonClass} onClick={() => openStewardEditor('reset_steward')} disabled={transitionBusy}>Reset steward</button>
                  <button type="button" className={primaryButtonClass} onClick={() => openStewardEditor('transfer_steward')} disabled={transitionBusy}>Transfer steward</button>
                </div>
                <StewardSnapshot steward={selected.steward} />
              </>
            ) : (
              <>
                <div className="maintenance-section-actions">
                  <button type="button" className={primaryButtonClass} onClick={() => openStewardEditor('transfer_steward')} disabled={transitionBusy}>Assign steward</button>
                </div>
                <AdminEmptyState title="No current steward" description="This physical artwork is not associated with a steward account." />
              </>
            )}

            {stewardEditor === 'transfer_steward' && !stewardReview && (
              <form className="maintenance-acquisition-form" onSubmit={prepareStewardTransferReview}>
                <h3>Transfer steward</h3>
                <p>Enter the exact email for an existing verified account. The server will reject unknown or unverified accounts.</p>
                <div className="maintenance-form-grid">
                  <label className="maintenance-field-wide" htmlFor="maintenance-steward-target-email">
                    <span className={labelClass}>Verified account email</span>
                    <input
                      id="maintenance-steward-target-email"
                      className={inputClass}
                      type="email"
                      autoComplete="off"
                      value={stewardTargetEmail}
                      onChange={event => {
                        clearStewardAttempt();
                        setStewardTargetEmail(event.target.value);
                      }}
                      required
                    />
                    <small className="maintenance-helper">This must match one verified account. The current display location clears when the transfer succeeds.</small>
                  </label>
                </div>
                {stewardError && <p className="maintenance-inline-error" role="alert">{stewardError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closeStewardEditor} disabled={stewardSaving}>Cancel</button>
                  <button type="submit" className={primaryButtonClass} disabled={stewardSaving}>Review transfer</button>
                </div>
              </form>
            )}

            {stewardReview && (
              <div className="maintenance-review" aria-labelledby="maintenance-steward-review-title">
                <div className="maintenance-review-heading">
                  <p className="admin-eyebrow">Confirmation required</p>
                  <h3 id="maintenance-steward-review-title">Review steward {stewardReview.action === 'reset_steward' ? 'reset' : 'transfer'}</h3>
                  <p>
                    {stewardReview.action === 'reset_steward'
                      ? 'Reset returns this artwork to Unclaimed. The steward account, claim and release timestamps, and display location all clear.'
                      : 'Transfer assigns the verified account, starts a new claim time, and clears the current display location.'}
                  </p>
                </div>
                <div className="maintenance-review-grid">
                  <div><h4>Before</h4><StewardSnapshot steward={stewardReview.before} /></div>
                  <div><h4>After</h4><StewardSnapshot steward={null} after={stewardReview} /></div>
                </div>
                <label htmlFor="maintenance-steward-reason">
                  <span className={labelClass}>Reason for this steward change</span>
                  <textarea
                    ref={stewardReasonRef}
                    id="maintenance-steward-reason"
                    className={inputClass}
                    rows={3}
                    required
                    value={stewardReason}
                    disabled={stewardSaving}
                    onChange={event => {
                      clearStewardAttempt();
                      setStewardReason(event.target.value);
                    }}
                  />
                </label>
                {!registryUnlocked && (
                  <AdminAlert tone="warning">
                    <p>Unlock the private registry before confirming this consequential change.</p>
                    <form className="maintenance-unlock-form" onSubmit={unlockRegistry}>
                      <label htmlFor="maintenance-registry-secret">
                        <span className={labelClass}>Registry secret</span>
                        <input ref={unlockInputRef} id="maintenance-registry-secret" className={inputClass} type="password" autoComplete="current-password" />
                      </label>
                      <button type="submit" className={quietButtonClass} disabled={unlockBusy}>{unlockBusy ? 'Unlocking…' : 'Unlock registry'}</button>
                    </form>
                    {unlockError && <p className="maintenance-inline-error" role="alert">{unlockError}</p>}
                  </AdminAlert>
                )}
                {registryUnlocked && <p className="maintenance-unlocked" role="status">Private registry unlocked for saving.</p>}
                {stewardError && <p className="maintenance-inline-error" role="alert">{stewardError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closeStewardEditor} disabled={stewardSaving}>Cancel</button>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void confirmStewardSave()}
                    disabled={stewardSaving || !registryUnlocked || !stewardReason.trim()}
                  >
                    {stewardSaving ? 'Saving…' : `Confirm steward ${stewardReview.action === 'reset_steward' ? 'reset' : 'transfer'}`}
                  </button>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection title="Maintenance history">
            {selected.maintenanceHistory.length === 0 ? (
              <AdminEmptyState title="No Maintenance events" description="Consequential corrections will appear here with administrator, reason, and before/after truth." />
            ) : (
              <div className="maintenance-history">
                {selected.maintenanceHistory.map(event => (
                  <details key={event.id}>
                    <summary>
                      <span><strong>{event.eventType.replaceAll('_', ' ')}</strong><small>{displayDate(event.createdAt)} · {event.administrator.email}</small></span>
                      <span>{event.outcome}</span>
                    </summary>
                    <p><strong>Reason:</strong> {event.reason}</p>
                    {event.warning ? (
                      <AdminAlert tone="warning"><p>Stored snapshots were unsafe and have been redacted.</p></AdminAlert>
                    ) : (
                      <div className="maintenance-history-snapshots">
                        <div><h4>Before</h4><pre>{JSON.stringify(event.before, null, 2)}</pre></div>
                        <div><h4>After</h4><pre>{JSON.stringify(event.after, null, 2)}</pre></div>
                      </div>
                    )}
                  </details>
                ))}
              </div>
            )}
          </AdminSection>
        </div>
      )}
    </AdminPage>
  );
};

export default AdminMaintenance;
