import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdminAlert,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from './admin/AdminPage';
import {
  beginMaintenanceSaveAttempt,
  currencyAmountToInput,
  formatMaintenanceCurrencyAmount,
  getMaintenanceDetail,
  MAINTENANCE_CURRENCIES,
  MaintenanceRequestError,
  parseMaintenanceCurrencyAmount,
  saveMaintenanceAcquisition,
  searchMaintenance,
  shouldRetainMaintenanceSaveAttempt,
  type MaintenanceAcquisition,
  type MaintenanceAcquisitionInput,
  type MaintenanceAcquisitionType,
  type MaintenanceListItem,
  type MaintenancePieceDetail,
  type MaintenanceSearchFilters,
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

const EMPTY_SEARCH: SearchDraft = {
  publicCode: '', artworkId: '', title: '', editionNumber: '',
};

const EMPTY_ACQUISITION: AcquisitionDraft = {
  acquisitionType: 'sale',
  acquiredAt: '',
  amount: '',
  currency: '',
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
    return `Unsupported currency code ${acquisition.currency}`;
  }
}

function textOrNull(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

function draftFromAcquisition(acquisition?: MaintenanceAcquisition): AcquisitionDraft {
  if (!acquisition) return { ...EMPTY_ACQUISITION };
  let amount = '';
  if (acquisition.amountMinor !== null && acquisition.currency) {
    try {
      amount = currencyAmountToInput(acquisition.amountMinor, acquisition.currency);
    } catch {
      // Leave the familiar amount blank until a supported currency is chosen.
    }
  }
  return {
    acquisitionType: acquisition.acquisitionType,
    acquiredAt: acquisition.acquiredAt?.slice(0, 10) || '',
    amount,
    currency: acquisition.currency || '',
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
  if (amountEntered) {
    amountMinor = parseMaintenanceCurrencyAmount(draft.amount, currency);
  }
  return {
    acquisitionType: draft.acquisitionType,
    acquiredAt: textOrNull(draft.acquiredAt),
    amountMinor,
    currency: amountEntered ? currency : null,
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
  const [notice, setNotice] = useState('');
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const saveAttemptKeyRef = useRef<string | null>(null);

  const clearSaveAttempt = () => {
    saveAttemptKeyRef.current = null;
  };

  const loadSearch = useCallback(async (filters: MaintenanceSearchFilters = {}, signal?: AbortSignal) => {
    setSearching(true);
    setSearchError('');
    try {
      setResults(await searchMaintenance(filters, signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setSearchError(messageFor(error, 'Maintenance records could not be loaded.'));
    } finally {
      if (!signal?.aborted) setSearching(false);
    }
  }, []);

  const loadDetail = useCallback(async (keeperPieceId: string, signal?: AbortSignal) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      setSelected(await getMaintenanceDetail(keeperPieceId, signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setDetailError(messageFor(error, 'The private record could not be loaded.'));
    } finally {
      if (!signal?.aborted) setDetailLoading(false);
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
    try {
      clearSaveAttempt();
      setSelected(null);
      setEditor(undefined);
      setReview(null);
      setNotice('');
      setDetailError('');
      void loadSearch(searchFilters());
    } catch (error) {
      setSearchError(messageFor(error, 'Check the public search fields.'));
    }
  };

  const clearSearch = () => {
    clearSaveAttempt();
    setSearchDraft(EMPTY_SEARCH);
    setSelected(null);
    setEditor(undefined);
    setReview(null);
    setNotice('');
    setDetailError('');
    void loadSearch({});
  };

  const openDetail = (item: MaintenanceListItem) => {
    clearSaveAttempt();
    setSelected(null);
    setEditor(undefined);
    setReview(null);
    setNotice('');
    void loadDetail(item.id);
  };

  const openEditor = (acquisition: MaintenanceAcquisition | null) => {
    clearSaveAttempt();
    setEditor(acquisition);
    setAcquisitionDraft(draftFromAcquisition(acquisition || undefined));
    setReview(null);
    setReason('');
    setFormError('');
    setNotice('');
  };

  const closeEditor = () => {
    clearSaveAttempt();
    setEditor(undefined);
    setReview(null);
    setReason('');
    setFormError('');
  };

  const prepareReview = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      clearSaveAttempt();
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
    clearSaveAttempt();
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
    const idempotencyKey = beginMaintenanceSaveAttempt(saveAttemptKeyRef.current);
    saveAttemptKeyRef.current = idempotencyKey;
    setSaving(true);
    setFormError('');
    try {
      await saveMaintenanceAcquisition({
        keeperPieceId: selected.id,
        ...(review.acquisitionId ? {
          acquisitionId: review.acquisitionId,
          expectedVersion: review.expectedVersion,
        } : {}),
        idempotencyKey,
        reason,
        acquisition: review.after,
      });
      clearSaveAttempt();
      await loadDetail(selected.id);
      setNotice(review.acquisitionId ? 'Acquisition correction saved.' : 'Acquisition recorded.');
      closeEditor();
    } catch (error) {
      if (!shouldRetainMaintenanceSaveAttempt(error)) clearSaveAttempt();
      if (error instanceof MaintenanceRequestError && error.code === 'registry_locked') {
        setRegistryUnlocked(false);
      }
      if (error instanceof MaintenanceRequestError && error.code === 'version_conflict') {
        await loadDetail(selected.id);
        setReview(null);
        setEditor(undefined);
        setNotice('The acquisition changed after you opened it. The latest detail has been reloaded; review it before trying again.');
      } else {
        setFormError(messageFor(error, 'The outcome could not be confirmed. Retry this unchanged confirmation to safely check the same save attempt.'));
      }
    } finally {
      setSaving(false);
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
            <button type="button" className={quietButtonClass} onClick={clearSearch}>Clear</button>
            <button type="submit" className={primaryButtonClass} disabled={searching}>Search Maintenance</button>
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
              <button type="button" className={primaryButtonClass} onClick={() => openEditor(null)}>Record acquisition</button>
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
                    <button type="button" className={quietButtonClass} onClick={() => openEditor(acquisition)}>Correct record</button>
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
                    <input id="maintenance-amount" className={inputClass} inputMode="decimal" type="text" value={acquisitionDraft.amount} onChange={event => setAcquisitionDraft(draft => ({ ...draft, amount: event.target.value }))} placeholder="1250.00" autoComplete="off" />
                    <small className="maintenance-helper">Enter the familiar amount exactly as you would normally write it. Decimals are validated for the selected currency and are never rounded.</small>
                  </label>
                  <label htmlFor="maintenance-currency">
                    <span className={labelClass}>Currency</span>
                    <select id="maintenance-currency" className={inputClass} value={acquisitionDraft.currency} onChange={event => setAcquisitionDraft(draft => ({ ...draft, currency: event.target.value }))}>
                      <option value="">Select currency</option>
                      {MAINTENANCE_CURRENCIES.map(currency => <option key={currency.code} value={currency.code}>{currency.code} · {currency.label}</option>)}
                    </select>
                  </label>
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
                  <button type="button" className={quietButtonClass} onClick={closeEditor}>Cancel</button>
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
                  <textarea ref={reasonRef} id="maintenance-reason" className={inputClass} rows={3} required value={reason} onChange={event => { clearSaveAttempt(); setReason(event.target.value); }} />
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
              <DefinitionList items={[
                ['Email', selected.steward.email],
                ['Status', selected.steward.active ? 'Active steward' : 'Released'],
                ['Display location', selected.steward.currentDisplayLocation],
                ['Claimed', displayDate(selected.steward.claimedAt)],
                ['Released', displayDate(selected.steward.releasedAt)],
                ['Steward version', selected.steward.stewardVersion],
              ]} />
            ) : <AdminEmptyState title="No current steward" description="This physical artwork is not associated with a steward account." />}
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
