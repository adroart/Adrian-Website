import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminAlert,
  AdminEmptyState,
  AdminPage,
  AdminPageHeader,
  AdminSection,
} from './admin/AdminPage';
import {
  beginMaintenanceProvenanceActionAttempt,
  beginMaintenancePlateActionAttempt,
  beginMaintenanceStewardActionAttempt,
  beginMaintenanceSaveRequestAttempt,
  buildLegacyAcquisitionSalesPath,
  createMaintenanceRequestGate,
  discardMaintenanceSaveAttempt,
  formatMaintenanceCurrencyAmount,
  getMaintenanceDetail,
  MAINTENANCE_CURRENCY_CODES,
  maintenanceCurrencyAmountToDraft,
  MaintenanceRequestError,
  parseMaintenanceCurrencyAmount,
  saveMaintenanceAcquisition,
  saveMaintenancePlateAction,
  saveMaintenanceProvenanceAction,
  saveMaintenanceStewardAction,
  searchMaintenance,
  shouldRetainMaintenanceSaveAttempt,
  type MaintenanceAcquisition,
  type MaintenanceAcquisitionInput,
  type MaintenanceAcquisitionType,
  type MaintenanceListItem,
  type MaintenancePieceDetail,
  type MaintenancePlateAction,
  type MaintenancePlateActionAttempt,
  type MaintenanceProvenance,
  type MaintenanceProvenanceActionAttempt,
  type MaintenanceProvenanceInput,
  type MaintenanceProvenanceType,
  type MaintenanceProvenanceVisibility,
  type MaintenanceSearchFilters,
  type MaintenanceSaveAttempt,
  type MaintenanceStewardAction,
  type MaintenanceStewardActionAttempt,
  type MaintenanceTransferKind,
} from '../utils/adminRegistryMaintenance';
import { projectPlateDownloads, type IssuedPlatePackage } from '../utils/adminArtworkRegistry';

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
  targetEmail: string;
  transferKind: MaintenanceTransferKind;
  expectedStewardVersion: number;
  before: MaintenancePieceDetail['steward'];
};

type PlateReviewState = {
  action: MaintenancePlateAction;
  expectedRecordVersion: number;
  artworkId?: string;
  editionNumber?: number;
  physicalDisposition?: string;
};

type ProvenanceDraft = {
  entryType: MaintenanceProvenanceType;
  title: string;
  detail: string;
  role: string;
  occurredAt: string;
  visibility: MaintenanceProvenanceVisibility;
};

type ProvenanceReviewState = {
  action: 'create' | 'correct' | 'remove';
  before: MaintenanceProvenance | null;
  after: MaintenanceProvenanceInput | null;
};

type AmbiguousMaintenanceAttempt = 'acquisition' | 'steward' | 'plate' | 'provenance';

const AMBIGUOUS_ATTEMPT_MESSAGE =
  'The outcome could not be confirmed. Retry the unchanged request before editing, cancelling, searching, or leaving this record.';

const EMPTY_SEARCH: SearchDraft = {
  publicCode: '', artworkId: '', title: '', editionNumber: '',
};

const EMPTY_ACQUISITION: AcquisitionDraft = {
  acquisitionType: 'retained',
  acquiredAt: '',
  amount: '',
  currency: '',
  preservedUnsupported: null,
  acquirerReference: '',
  privateNotes: '',
  documentReference: '',
  publicProvenance: '',
};

const EMPTY_PROVENANCE: ProvenanceDraft = {
  entryType: 'creation_place',
  title: '',
  detail: '',
  role: '',
  occurredAt: '',
  visibility: 'private',
};

const provenanceTypes: Array<{ value: MaintenanceProvenanceType; label: string }> = [
  { value: 'contributor', label: 'Contributor' },
  { value: 'creation_place', label: 'Creation place' },
  { value: 'intention', label: 'Intention' },
  { value: 'material', label: 'Material' },
  { value: 'technique', label: 'Technique' },
  { value: 'note', label: 'Note' },
];

const acquisitionTypes: Array<{ value: MaintenanceAcquisitionType; label: string }> = [
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
    verified_sale_required: 'Record sales in the verified-sales workspace.',
    legacy_sale_read_only: 'Legacy sale records stay read-only. Continue in verified sales.',
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

function downloadText(filename: string, mimeType: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

function provenanceDraftFromEntry(entry?: MaintenanceProvenance): ProvenanceDraft {
  if (!entry) return { ...EMPTY_PROVENANCE };
  return {
    entryType: entry.entryType,
    title: entry.title,
    detail: entry.detail || '',
    role: entry.role || '',
    occurredAt: entry.occurredAt || '',
    visibility: entry.visibility,
  };
}

function normalizeProvenanceDraft(draft: ProvenanceDraft): MaintenanceProvenanceInput {
  const title = draft.title.trim();
  const role = textOrNull(draft.role);
  if (!title) throw new Error('A title or name is required.');
  if (title.length > 300) throw new Error('The title is too long.');
  if (draft.entryType === 'contributor' && !role) {
    throw new Error('A contributor role is required.');
  }
  const occurredAt = textOrNull(draft.occurredAt);
  if (occurredAt && !/^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?(?:T.+)?$/.test(occurredAt)) {
    throw new Error('Use a year, year and month, date, or exact ISO timestamp.');
  }
  return {
    entryType: draft.entryType,
    title,
    detail: textOrNull(draft.detail),
    role,
    occurredAt,
    visibility: draft.visibility,
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
  if (after?.action === 'transfer_steward') {
    return <DefinitionList items={[
      ['Status', 'Active steward'],
      ['Verified account email', after.targetEmail],
      ['Transfer kind', after.transferKind.replace('-', ' ')],
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

const ProvenanceSnapshot: React.FC<{
  entry: MaintenanceProvenanceInput | null;
  emptyLabel?: string;
}> = ({ entry, emptyLabel = 'Removed from the current creator history.' }) => {
  if (!entry) return <p className="maintenance-muted">{emptyLabel}</p>;
  return <DefinitionList items={[
    ['Type', provenanceTypes.find(option => option.value === entry.entryType)?.label || entry.entryType],
    ['Title or name', entry.title],
    ['Role', entry.role],
    ['Date', entry.occurredAt],
    ['Visibility', entry.visibility],
    ['Detail', entry.detail],
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
  const [stewardTransferKind, setStewardTransferKind] = useState<MaintenanceTransferKind>('gift');
  const [stewardReview, setStewardReview] = useState<StewardReviewState | null>(null);
  const [stewardReason, setStewardReason] = useState('');
  const [stewardError, setStewardError] = useState('');
  const [stewardSaving, setStewardSaving] = useState(false);
  const [plateEditor, setPlateEditor] = useState<MaintenancePlateAction | null>(null);
  const [plateArtworkId, setPlateArtworkId] = useState('');
  const [plateEditionNumber, setPlateEditionNumber] = useState('');
  const [plateEngravingMatches, setPlateEngravingMatches] = useState(false);
  const [plateDisposition, setPlateDisposition] = useState('');
  const [plateReview, setPlateReview] = useState<PlateReviewState | null>(null);
  const [plateReason, setPlateReason] = useState('');
  const [plateError, setPlateError] = useState('');
  const [plateSaving, setPlateSaving] = useState(false);
  const [replacementPackage, setReplacementPackage] = useState<IssuedPlatePackage | null>(null);
  const [replacementArchived, setReplacementArchived] = useState(false);
  const [provenanceEditor, setProvenanceEditor] = useState<MaintenanceProvenance | null | undefined>(undefined);
  const [provenanceDraft, setProvenanceDraft] = useState<ProvenanceDraft>(EMPTY_PROVENANCE);
  const [provenanceReview, setProvenanceReview] = useState<ProvenanceReviewState | null>(null);
  const [provenanceReason, setProvenanceReason] = useState('');
  const [provenanceError, setProvenanceError] = useState('');
  const [provenanceSaving, setProvenanceSaving] = useState(false);
  const [ambiguousAttempt, setAmbiguousAttempt] = useState<AmbiguousMaintenanceAttempt | null>(null);
  const [notice, setNotice] = useState('');
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const stewardReasonRef = useRef<HTMLTextAreaElement>(null);
  const plateReasonRef = useRef<HTMLTextAreaElement>(null);
  const provenanceReasonRef = useRef<HTMLTextAreaElement>(null);
  const saveAttemptRef = useRef<MaintenanceSaveAttempt | null>(null);
  const saveInFlightRef = useRef(false);
  const stewardAttemptRef = useRef<MaintenanceStewardActionAttempt | null>(null);
  const stewardInFlightRef = useRef(false);
  const plateAttemptRef = useRef<MaintenancePlateActionAttempt | null>(null);
  const plateInFlightRef = useRef(false);
  const provenanceAttemptRef = useRef<MaintenanceProvenanceActionAttempt | null>(null);
  const provenanceInFlightRef = useRef(false);
  const searchGateRef = useRef(createMaintenanceRequestGate());
  const detailGateRef = useRef(createMaintenanceRequestGate());

  const clearSaveAttempt = () => {
    if (ambiguousAttempt === 'acquisition') return false;
    saveAttemptRef.current = discardMaintenanceSaveAttempt(
      saveAttemptRef.current,
      saveInFlightRef.current,
    );
    return saveAttemptRef.current === null;
  };

  const clearStewardAttempt = () => {
    if (ambiguousAttempt === 'steward') return false;
    stewardAttemptRef.current = discardMaintenanceSaveAttempt(
      stewardAttemptRef.current,
      stewardInFlightRef.current,
    );
    return stewardAttemptRef.current === null;
  };

  const clearPlateAttempt = () => {
    if (ambiguousAttempt === 'plate') return false;
    plateAttemptRef.current = discardMaintenanceSaveAttempt(
      plateAttemptRef.current,
      plateInFlightRef.current,
    );
    return plateAttemptRef.current === null;
  };

  const clearProvenanceAttempt = () => {
    if (ambiguousAttempt === 'provenance') return false;
    provenanceAttemptRef.current = discardMaintenanceSaveAttempt(
      provenanceAttemptRef.current,
      provenanceInFlightRef.current,
    );
    return provenanceAttemptRef.current === null;
  };

  const clearMaintenanceAttempts = () => clearSaveAttempt()
    && clearStewardAttempt()
    && clearPlateAttempt()
    && clearProvenanceAttempt();
  const transitionBusy = saving || stewardSaving || plateSaving || provenanceSaving
    || Boolean(replacementPackage) || Boolean(ambiguousAttempt);

  useEffect(() => {
    if (!ambiguousAttempt) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [ambiguousAttempt]);

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

  useEffect(() => {
    if (plateReview) plateReasonRef.current?.focus();
  }, [plateReview]);

  useEffect(() => {
    if (provenanceReview) provenanceReasonRef.current?.focus();
  }, [provenanceReview]);

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
      setPlateEditor(null);
      setPlateReview(null);
      setProvenanceEditor(undefined);
      setProvenanceReview(null);
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
    setPlateEditor(null);
    setPlateReview(null);
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
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
    setPlateEditor(null);
    setPlateReview(null);
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
    setNotice('');
    void loadDetail(item.id).catch(() => undefined);
  };

  const openEditor = (acquisition: MaintenanceAcquisition | null) => {
    if (acquisition?.acquisitionType === 'sale') return;
    if (!clearMaintenanceAttempts()) return;
    setStewardEditor(null);
    setStewardReview(null);
    setPlateEditor(null);
    setPlateReview(null);
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
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
    setPlateEditor(null);
    setPlateReview(null);
    setPlateError('');
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
    setProvenanceError('');
    setNotice('');
    setStewardReview(null);
  };

  const closeStewardEditor = () => {
    if (!clearStewardAttempt()) return;
    setStewardEditor(null);
    setStewardReview(null);
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
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
      transferKind: stewardTransferKind,
      expectedStewardVersion: selected.stewardVersion,
      before: selected.steward,
    });
    setStewardReason('');
    setStewardError('');
  };

  const openPlateEditor = (action: MaintenancePlateAction) => {
    if (!selected || !clearMaintenanceAttempts()) return;
    setEditor(undefined);
    setReview(null);
    setStewardEditor(null);
    setStewardReview(null);
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
    setPlateEditor(action);
    setPlateArtworkId(selected.public.artworkId);
    setPlateEditionNumber(String(selected.public.editionNumber));
    setPlateEngravingMatches(false);
    setPlateDisposition('');
    setPlateReview(null);
    setPlateReason('');
    setPlateError('');
    setNotice('');
  };

  const closePlateEditor = () => {
    if (!clearPlateAttempt()) return;
    setPlateEditor(null);
    setPlateReview(null);
    setPlateArtworkId('');
    setPlateEditionNumber('');
    setPlateEngravingMatches(false);
    setPlateDisposition('');
    setPlateReason('');
    setPlateError('');
  };

  const preparePlateReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !plateEditor || !clearPlateAttempt()) return;
    if (plateEditor === 'correct_link') {
      const artworkId = plateArtworkId.trim().toUpperCase();
      const edition = plateEditionNumber.trim();
      if (!/^[A-Z]{2,3}-\d{3}$/.test(artworkId)
        || !/^\d+$/.test(edition)
        || Number(edition) > 9999) {
        setPlateError('Enter the exact artwork ID and a whole edition number from 0 to 9999.');
        return;
      }
      if (!plateEngravingMatches) {
        setPlateError('Read the physical engraving and confirm it exactly before correcting the digital link.');
        return;
      }
      setPlateReview({
        action: plateEditor,
        expectedRecordVersion: selected.physical.recordVersion,
        artworkId,
        editionNumber: Number(edition),
      });
    } else {
      const physicalDisposition = plateDisposition.trim();
      if (!physicalDisposition || physicalDisposition.length > 1000) {
        setPlateError('Record exactly what will happen to the incorrect physical plate.');
        return;
      }
      setPlateReview({
        action: plateEditor,
        expectedRecordVersion: selected.physical.recordVersion,
        physicalDisposition,
      });
    }
    setPlateReason('');
    setPlateError('');
  };

  const confirmPlateSave = async () => {
    if (!selected || !plateReview) return;
    if (!plateReason.trim()) {
      setPlateError('A reason is required before this plate repair can be saved.');
      plateReasonRef.current?.focus();
      return;
    }
    if (!registryUnlocked) {
      setPlateError('Unlock the private registry before confirming this repair.');
      return;
    }
    const attempt = beginMaintenancePlateActionAttempt(plateAttemptRef.current, {
      keeperPieceId: selected.id,
      action: plateReview.action,
      reason: plateReason,
      expectedRecordVersion: plateReview.expectedRecordVersion,
      ...(plateReview.action === 'correct_link'
        ? {
            artworkId: plateReview.artworkId,
            editionNumber: plateReview.editionNumber,
            physicalEngravingMatches: true,
          }
        : { physicalDisposition: plateReview.physicalDisposition }),
    });
    plateAttemptRef.current = attempt;
    plateInFlightRef.current = true;
    setPlateSaving(true);
    setPlateError('');
    try {
      const saved = await saveMaintenancePlateAction(attempt.request);
      plateInFlightRef.current = false;
      plateAttemptRef.current = null;
      setAmbiguousAttempt(null);
      if (saved.action === 'replace_plate' && saved.replacement) {
        setSelected(current => current && current.id === attempt.request.keeperPieceId
          ? {
              ...current,
              public: { ...current.public, plateStatus: 'superseded' },
              physical: {
                ...current.physical,
                recordVersion: current.physical.recordVersion + 1,
              },
            }
          : current);
        setReplacementPackage(saved.replacement);
        setReplacementArchived(false);
        setPlateEditor(null);
        setPlateReview(null);
        setPlateReason('');
        setNotice('Replacement identity created. Download and secure the one-time package before leaving this record.');
        return;
      }

      const record = saved.record!;
      const savedMessage = saved.action === 'correct_link'
        ? 'Digital link corrected to match the physical engraving. The encrypted backup must be verified again.'
        : 'Generated plate voided. Its public identity is permanently retired.';
      setSelected(current => {
        if (!current || current.id !== attempt.request.keeperPieceId) return current;
        if (saved.action === 'correct_link') {
          return {
            ...current,
            public: {
              ...current.public,
              artworkId: record.pieceId!,
              editionNumber: record.editionNumber!,
            },
            physical: {
              ...current.physical,
              recordVersion: record.recordVersion,
              recovery: {
                ...current.physical.recovery,
                backupStatus: 'pending',
                backupAt: null,
              },
            },
          };
        }
        return {
          ...current,
          public: { ...current.public, plateStatus: record.plateStatus || 'void' },
          physical: { ...current.physical, recordVersion: record.recordVersion },
        };
      });
      setPlateEditor(null);
      setPlateReview(null);
      setPlateReason('');
      setNotice(savedMessage);
      try {
        await loadDetail(attempt.request.keeperPieceId);
      } catch {
        setNotice(`${savedMessage} The save is definitive, but refreshed detail is unavailable. Reload before another change.`);
      }
    } catch (error) {
      plateInFlightRef.current = false;
      const retainAttempt = shouldRetainMaintenanceSaveAttempt(error);
      if (retainAttempt) setAmbiguousAttempt('plate');
      else {
        plateAttemptRef.current = null;
        setAmbiguousAttempt(null);
      }
      if (error instanceof MaintenanceRequestError
        && (error.code === 'registry_locked' || error.status === 401 || error.status === 403)) {
        setRegistryUnlocked(false);
      }
      if (error instanceof MaintenanceRequestError && error.code === 'version_conflict') {
        try {
          await loadDetail(attempt.request.keeperPieceId);
          setPlateReview(null);
          setPlateEditor(null);
          setNotice('The plate record changed after you opened it. The latest detail has been reloaded; review it again.');
        } catch {
          setPlateError('The plate record changed, but the latest detail could not be reloaded. Your exact review is preserved.');
        }
      } else {
        setPlateError(retainAttempt
          ? AMBIGUOUS_ATTEMPT_MESSAGE
          : messageFor(error, 'The plate repair could not be saved.'));
      }
    } finally {
      plateInFlightRef.current = false;
      setPlateSaving(false);
    }
  };

  const dismissReplacementPackage = async () => {
    if (!selected || !replacementPackage || !replacementArchived) return;
    setReplacementPackage(null);
    setReplacementArchived(false);
    setNotice('One-time replacement package cleared from this screen.');
    try {
      await loadDetail(selected.id);
    } catch {
      setDetailError('The replacement was saved, but the superseded record could not be refreshed.');
    }
  };

  const openProvenanceEditor = (entry: MaintenanceProvenance | null) => {
    if (!selected || !clearMaintenanceAttempts()) return;
    setEditor(undefined);
    setReview(null);
    setStewardEditor(null);
    setStewardReview(null);
    setPlateEditor(null);
    setPlateReview(null);
    setProvenanceEditor(entry);
    setProvenanceDraft(provenanceDraftFromEntry(entry || undefined));
    setProvenanceReview(null);
    setProvenanceReason('');
    setProvenanceError('');
    setNotice('');
  };

  const reviewProvenanceRemoval = (entry: MaintenanceProvenance) => {
    if (!selected || !clearMaintenanceAttempts()) return;
    setEditor(undefined);
    setReview(null);
    setStewardEditor(null);
    setStewardReview(null);
    setPlateEditor(null);
    setPlateReview(null);
    setProvenanceEditor(entry);
    setProvenanceReview({ action: 'remove', before: entry, after: null });
    setProvenanceReason('');
    setProvenanceError('');
    setNotice('');
  };

  const closeProvenanceEditor = () => {
    if (!clearProvenanceAttempt()) return;
    setProvenanceEditor(undefined);
    setProvenanceReview(null);
    setProvenanceDraft(EMPTY_PROVENANCE);
    setProvenanceReason('');
    setProvenanceError('');
  };

  const prepareProvenanceReview = (event: React.FormEvent) => {
    event.preventDefault();
    if (!clearProvenanceAttempt()) return;
    try {
      const after = normalizeProvenanceDraft(provenanceDraft);
      setProvenanceReview({
        action: provenanceEditor ? 'correct' : 'create',
        before: provenanceEditor || null,
        after,
      });
      setProvenanceReason('');
      setProvenanceError('');
    } catch (error) {
      setProvenanceError(messageFor(error, 'Check the creator-history fields.'));
    }
  };

  const confirmProvenanceSave = async () => {
    if (!selected || !provenanceReview) return;
    if (!provenanceReason.trim()) {
      setProvenanceError('A reason is required before this creator-history change can be saved.');
      provenanceReasonRef.current?.focus();
      return;
    }
    if (!registryUnlocked) {
      setProvenanceError('Unlock the private registry before confirming this change.');
      return;
    }
    const attempt = beginMaintenanceProvenanceActionAttempt(provenanceAttemptRef.current, {
      keeperPieceId: selected.id,
      action: provenanceReview.action,
      ...(provenanceReview.action === 'create'
        ? { entry: provenanceReview.after! }
        : provenanceReview.action === 'correct'
          ? {
              provenanceId: provenanceReview.before!.provenanceId,
              expectedVersion: provenanceReview.before!.recordVersion,
              entry: provenanceReview.after!,
            }
          : {
              provenanceId: provenanceReview.before!.provenanceId,
              expectedVersion: provenanceReview.before!.recordVersion,
            }),
      reason: provenanceReason,
    });
    provenanceAttemptRef.current = attempt;
    provenanceInFlightRef.current = true;
    setProvenanceSaving(true);
    setProvenanceError('');
    try {
      await saveMaintenanceProvenanceAction(attempt.request);
      provenanceInFlightRef.current = false;
      provenanceAttemptRef.current = null;
      setAmbiguousAttempt(null);
      const savedMessage = provenanceReview.action === 'create'
        ? 'Creator-history entry recorded.'
        : provenanceReview.action === 'correct'
          ? 'Creator-history correction saved.'
          : 'Creator-history entry removed from the current view. Its prior values remain in history.';
      setProvenanceEditor(undefined);
      setProvenanceReview(null);
      setProvenanceReason('');
      setNotice(savedMessage);
      try {
        await loadDetail(attempt.request.keeperPieceId);
      } catch {
        setNotice(`${savedMessage} The save is definitive, but refreshed detail is unavailable. Reload before another change.`);
      }
    } catch (error) {
      provenanceInFlightRef.current = false;
      const retainAttempt = shouldRetainMaintenanceSaveAttempt(error);
      if (retainAttempt) setAmbiguousAttempt('provenance');
      else {
        provenanceAttemptRef.current = null;
        setAmbiguousAttempt(null);
      }
      if (error instanceof MaintenanceRequestError
        && (error.code === 'registry_locked' || error.status === 401 || error.status === 403)) {
        setRegistryUnlocked(false);
      }
      if (error instanceof MaintenanceRequestError && error.code === 'version_conflict') {
        try {
          await loadDetail(attempt.request.keeperPieceId);
          setProvenanceReview(null);
          setProvenanceEditor(undefined);
          setNotice('Creator history changed after you opened it. The latest detail has been reloaded; review it again.');
        } catch {
          setProvenanceError('Creator history changed, but the latest detail could not be reloaded. Your exact review is preserved.');
        }
      } else {
        setProvenanceError(retainAttempt
          ? AMBIGUOUS_ATTEMPT_MESSAGE
          : messageFor(error, 'The creator-history change could not be saved.'));
      }
    } finally {
      provenanceInFlightRef.current = false;
      setProvenanceSaving(false);
    }
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
      setAmbiguousAttempt(null);
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
      const retainAttempt = shouldRetainMaintenanceSaveAttempt(error);
      if (retainAttempt) setAmbiguousAttempt('acquisition');
      else {
        saveAttemptRef.current = null;
        setAmbiguousAttempt(null);
      }
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
        setFormError(retainAttempt
          ? AMBIGUOUS_ATTEMPT_MESSAGE
          : messageFor(error, 'The acquisition change could not be saved.'));
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
      targetEmail: stewardReview.targetEmail,
      transferKind: stewardReview.transferKind,
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
      setAmbiguousAttempt(null);
      const savedMessage = `Steward transfer saved for ${stewardReview.targetEmail}. The display location was cleared.`;
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
      const retainAttempt = shouldRetainMaintenanceSaveAttempt(error);
      if (retainAttempt) setAmbiguousAttempt('steward');
      else {
        stewardAttemptRef.current = null;
        setAmbiguousAttempt(null);
      }
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
        setStewardError(retainAttempt
          ? AMBIGUOUS_ATTEMPT_MESSAGE
          : messageFor(error, 'The steward change could not be saved.'));
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

          <AdminSection title="Plate repair" description="Use the metal as the source of truth. Every repair is reasoned, version-checked, and retained in history.">
            {!replacementPackage && (
              <>
                <AdminAlert tone="warning">
                  <p><strong>Read the physical plate before choosing.</strong> If the metal is correct and only the database link is wrong, correct the digital link. If the engraving itself is wrong, never relink it. Void an unactivated plate or replace an active plate.</p>
                </AdminAlert>
                <div className="maintenance-section-actions">
                  {['generated', 'active'].includes(selected.public.plateStatus) && (
                    <button type="button" className={quietButtonClass} onClick={() => openPlateEditor('correct_link')} disabled={transitionBusy}>Correct digital link</button>
                  )}
                  {selected.public.plateStatus === 'generated' && (
                    <button type="button" className={primaryButtonClass} onClick={() => openPlateEditor('void_plate')} disabled={transitionBusy}>Void generated plate</button>
                  )}
                  {selected.public.plateStatus === 'active' && (
                    <button type="button" className={primaryButtonClass} onClick={() => openPlateEditor('replace_plate')} disabled={transitionBusy}>Replace physical plate</button>
                  )}
                </div>
                {!['generated', 'active'].includes(selected.public.plateStatus) && (
                  <p className="maintenance-muted">This plate identity is {selected.public.plateStatus} and cannot be edited or reused.</p>
                )}
              </>
            )}

            {plateEditor && !plateReview && !replacementPackage && (
              <form className="maintenance-acquisition-form" onSubmit={preparePlateReview}>
                <h3>{plateEditor === 'correct_link' ? 'Correct digital link' : plateEditor === 'void_plate' ? 'Void generated plate' : 'Replace physical plate'}</h3>
                {plateEditor === 'correct_link' ? (
                  <>
                    <p>This keeps the permanent public code but rebuilds its encrypted recovery package for the artwork and edition actually engraved on the metal.</p>
                    <div className="maintenance-form-grid">
                      <label htmlFor="maintenance-plate-artwork-id">
                        <span className={labelClass}>Artwork ID engraved on metal</span>
                        <input id="maintenance-plate-artwork-id" className={inputClass} value={plateArtworkId} onChange={event => { clearPlateAttempt(); setPlateArtworkId(event.target.value); }} autoComplete="off" required />
                      </label>
                      <label htmlFor="maintenance-plate-edition-number">
                        <span className={labelClass}>Edition number engraved on metal</span>
                        <input id="maintenance-plate-edition-number" className={inputClass} inputMode="numeric" value={plateEditionNumber} onChange={event => { clearPlateAttempt(); setPlateEditionNumber(event.target.value); }} autoComplete="off" required />
                      </label>
                    </div>
                    <label className="maintenance-confirmation" htmlFor="maintenance-plate-engraving-match">
                      <input id="maintenance-plate-engraving-match" type="checkbox" checked={plateEngravingMatches} onChange={event => { clearPlateAttempt(); setPlateEngravingMatches(event.target.checked); }} />
                      <span>I read the physical metal. Its artwork ID, edition number, and public code are correct. Only the digital relationship is wrong.</span>
                    </label>
                  </>
                ) : (
                  <>
                    <p>{plateEditor === 'void_plate'
                      ? 'The generated identity will be permanently retired and its code can never be reused.'
                      : 'The active identity will become superseded. A new public code, Ownership Code, and fabrication package will be created once.'}</p>
                    <label htmlFor="maintenance-plate-disposition">
                      <span className={labelClass}>Physical disposition</span>
                      <textarea id="maintenance-plate-disposition" className={inputClass} rows={3} maxLength={1000} value={plateDisposition} onChange={event => { clearPlateAttempt(); setPlateDisposition(event.target.value); }} placeholder="Example: Incorrect plate destroyed and photographed; it will not be attached or circulated." required />
                      <small className="maintenance-helper">State exactly how the incorrect metal is marked, destroyed, retained, or otherwise prevented from being mistaken for the valid plate.</small>
                    </label>
                  </>
                )}
                {plateError && <p className="maintenance-inline-error" role="alert">{plateError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closePlateEditor} disabled={plateSaving}>Cancel</button>
                  <button type="submit" className={primaryButtonClass} disabled={plateSaving}>Review plate repair</button>
                </div>
              </form>
            )}

            {plateReview && !replacementPackage && (
              <div className="maintenance-review" aria-labelledby="maintenance-plate-review-title">
                <div className="maintenance-review-heading">
                  <p className="admin-eyebrow">Permanent consequence</p>
                  <h3 id="maintenance-plate-review-title">Review {plateReview.action === 'correct_link' ? 'digital relink' : plateReview.action === 'void_plate' ? 'plate void' : 'plate replacement'}</h3>
                  <p>{plateReview.action === 'correct_link'
                    ? 'The public code stays the same. The database identity, fabrication hashes, and encrypted recovery envelope change to match the metal, and backup verification returns to pending.'
                    : plateReview.action === 'void_plate'
                      ? 'This generated public identity becomes void forever. It cannot be reactivated or reused.'
                      : 'The old public identity becomes superseded forever. A new generated identity and one-time secret package are created for replacement metal.'}</p>
                </div>
                <div className="maintenance-review-grid">
                  <div>
                    <h4>Before</h4>
                    <DefinitionList items={[
                      ['Artwork ID', selected.public.artworkId],
                      ['Edition', displayEdition(selected.public.editionNumber, selected.public.editionSize)],
                      ['Public code', selected.public.publicCode],
                      ['Plate status', selected.public.plateStatus],
                      ['Record version', selected.physical.recordVersion],
                    ]} />
                  </div>
                  <div>
                    <h4>After</h4>
                    <DefinitionList items={plateReview.action === 'correct_link' ? [
                      ['Artwork ID', plateReview.artworkId],
                      ['Edition number', plateReview.editionNumber],
                      ['Public code', selected.public.publicCode],
                      ['Backup status', 'Pending re-verification'],
                      ['Record version', plateReview.expectedRecordVersion + 1],
                    ] : [
                      ['Old plate status', plateReview.action === 'void_plate' ? 'Void' : 'Superseded'],
                      ['Physical disposition', plateReview.physicalDisposition],
                      ['Old public code', 'Permanently retired'],
                      ['New identity', plateReview.action === 'replace_plate' ? 'Generated after confirmation' : 'Not created here'],
                    ]} />
                  </div>
                </div>
                <label htmlFor="maintenance-plate-reason">
                  <span className={labelClass}>Reason for this plate repair</span>
                  <textarea ref={plateReasonRef} id="maintenance-plate-reason" className={inputClass} rows={3} required value={plateReason} disabled={plateSaving || ambiguousAttempt === 'plate'} onChange={event => { if (clearPlateAttempt()) setPlateReason(event.target.value); }} />
                </label>
                {!registryUnlocked && (
                  <AdminAlert tone="warning">
                    <p>Unlock the private registry before confirming this permanent repair.</p>
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
                {plateError && <p className="maintenance-inline-error" role="alert">{plateError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closePlateEditor} disabled={plateSaving || ambiguousAttempt === 'plate'}>Cancel</button>
                  <button type="button" className={primaryButtonClass} onClick={() => void confirmPlateSave()} disabled={plateSaving || !registryUnlocked || !plateReason.trim()}>{plateSaving ? 'Saving…' : plateReview.action === 'correct_link' ? 'Confirm digital relink' : plateReview.action === 'void_plate' ? 'Confirm permanent void' : 'Confirm replacement and mint new identity'}</button>
                </div>
              </div>
            )}

            {replacementPackage && (
              <div className="maintenance-review" aria-labelledby="maintenance-replacement-package-title">
                <div className="maintenance-review-heading">
                  <p className="admin-eyebrow">One-time private package</p>
                  <h3 id="maintenance-replacement-package-title">Replacement identity {replacementPackage.publicCode}</h3>
                  <p>The old plate is already superseded. This Ownership Code and fabrication package are held only in this screen memory. Download and secure all three files before clearing it.</p>
                </div>
                <AdminAlert tone="warning"><p>Do not engrave until the replacement package passes the same copied-backup recovery check and physical qualification as every new plate.</p></AdminAlert>
                <DefinitionList items={[
                  ['Ownership Code', <span className="maintenance-secret-value">{replacementPackage.ownershipCode}</span>],
                  ['Public code', replacementPackage.publicCode],
                  ['Artwork ID', replacementPackage.manifest.artworkId],
                  ['Edition number', replacementPackage.manifest.editionNumber],
                  ['Front SHA-256', replacementPackage.frontSha256],
                  ['Underside SHA-256', replacementPackage.undersideSha256],
                  ['Encrypted backup', replacementPackage.backupStatus || 'Pending'],
                ]} />
                <div className="maintenance-actions">
                  {projectPlateDownloads(replacementPackage).map(download => (
                    <button key={download.filename} type="button" className={quietButtonClass} onClick={() => downloadText(download.filename, download.mimeType, download.content)}>Download {download.filename}</button>
                  ))}
                </div>
                <label className="maintenance-confirmation" htmlFor="maintenance-replacement-archived">
                  <input id="maintenance-replacement-archived" type="checkbox" checked={replacementArchived} onChange={event => setReplacementArchived(event.target.checked)} />
                  <span>I downloaded the front SVG, private underside SVG, and private manifest, and secured the Ownership Code outside this browser.</span>
                </label>
                <div className="maintenance-actions">
                  <button type="button" className={primaryButtonClass} onClick={() => void dismissReplacementPackage()} disabled={!replacementArchived}>Clear one-time package from this screen</button>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection title="Private acquisition" description="Exact amounts and collector references stay inside this authenticated detail.">
            <div className="maintenance-section-actions">
              <button type="button" className={primaryButtonClass} onClick={() => openEditor(null)} disabled={transitionBusy}>Record acquisition</button>
            </div>
            {selected.acquisitions.length === 0 ? (
              <AdminEmptyState title="No acquisition recorded" description="Record retained work, a loan, consignment, gift, inheritance, or other custody event." />
            ) : (
              <div className="maintenance-acquisitions">
                {selected.acquisitions.map(acquisition => (
                  <article key={acquisition.acquisitionId} className="maintenance-acquisition-row">
                    <div>
                      <strong>{acquisition.acquisitionType === 'sale' ? 'Legacy sale record' : acquisition.acquisitionType}</strong>
                      <span>{displayDate(acquisition.acquiredAt)} · {displayPrivateAmount(acquisition)}</span>
                      {acquisition.acquirerReference && <span>Reference: {acquisition.acquirerReference}</span>}
                    </div>
                    {acquisition.acquisitionType === 'sale' ? (
                      <Link
                        className={quietButtonClass}
                        to={buildLegacyAcquisitionSalesPath({
                          acquisitionId: acquisition.acquisitionId,
                          artworkId: selected.public.artworkId,
                          keeperPieceId: acquisition.keeperPieceId,
                        })}
                      >
                        Open verified sales
                      </Link>
                    ) : (
                      <button type="button" className={quietButtonClass} onClick={() => openEditor(acquisition)} disabled={transitionBusy} aria-label={`Correct acquisition ${acquisition.acquisitionId}`}>Correct record</button>
                    )}
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
                  <textarea ref={reasonRef} id="maintenance-reason" className={inputClass} rows={3} required value={reason} disabled={saving || ambiguousAttempt === 'acquisition'} onChange={event => { if (clearSaveAttempt()) setReason(event.target.value); }} />
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
                  <button type="button" className={quietButtonClass} onClick={backToEditor} disabled={saving || ambiguousAttempt === 'acquisition'}>Back to edit</button>
                  <button type="button" className={primaryButtonClass} onClick={() => void confirmSave()} disabled={saving || !registryUnlocked || !reason.trim()}>{saving ? 'Saving…' : 'Confirm save'}</button>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection title="Creator history and intention" description="Record who worked on the piece, where and how it was made, and intentions or notes with an explicit audience.">
            <div className="maintenance-section-actions">
              <button type="button" className={primaryButtonClass} onClick={() => openProvenanceEditor(null)} disabled={transitionBusy}>Add creator-history entry</button>
            </div>
            {selected.creatorHistory.length === 0 ? (
              <AdminEmptyState title="No creator history recorded" description="Add a contributor, creation place, intention, material, technique, or note." />
            ) : (
              <div className="maintenance-acquisitions">
                {selected.creatorHistory.map(entry => (
                  <article key={entry.provenanceId} className="maintenance-acquisition-row">
                    <div>
                      <strong>{entry.title}</strong>
                      <span>{provenanceTypes.find(option => option.value === entry.entryType)?.label || entry.entryType} · {entry.visibility} · {entry.occurredAt || 'No date'}</span>
                      {entry.role && <span>Role: {entry.role}</span>}
                      {entry.detail && <span>{entry.detail}</span>}
                    </div>
                    <div className="maintenance-actions">
                      <button type="button" className={quietButtonClass} onClick={() => openProvenanceEditor(entry)} disabled={transitionBusy} aria-label={`Correct creator history ${entry.title}`}>Correct</button>
                      <button type="button" className={quietButtonClass} onClick={() => reviewProvenanceRemoval(entry)} disabled={transitionBusy} aria-label={`Remove creator history ${entry.title}`}>Remove from current view</button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {provenanceEditor !== undefined && !provenanceReview && (
              <form className="maintenance-acquisition-form" onSubmit={prepareProvenanceReview}>
                <h3>{provenanceEditor ? 'Correct creator history' : 'Add creator history'}</h3>
                <p>Nothing is saved until the full entry and its audience are reviewed.</p>
                <div className="maintenance-form-grid">
                  <label htmlFor="maintenance-provenance-type">
                    <span className={labelClass}>Entry type</span>
                    <select id="maintenance-provenance-type" className={inputClass} value={provenanceDraft.entryType} onChange={event => { clearProvenanceAttempt(); setProvenanceDraft(draft => ({ ...draft, entryType: event.target.value as MaintenanceProvenanceType })); }}>
                      {provenanceTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </label>
                  <label htmlFor="maintenance-provenance-visibility">
                    <span className={labelClass}>Visibility</span>
                    <select id="maintenance-provenance-visibility" className={inputClass} value={provenanceDraft.visibility} onChange={event => { clearProvenanceAttempt(); setProvenanceDraft(draft => ({ ...draft, visibility: event.target.value as MaintenanceProvenanceVisibility })); }}>
                      <option value="private">Private, administrator only</option>
                      <option value="steward">Steward, not public</option>
                      <option value="public">Public scanned record</option>
                    </select>
                    <small className="maintenance-helper">Public entries appear on the scanned plate record. Steward entries remain non-public and are reserved for the steward-facing record. Private entries stay in Maintenance.</small>
                  </label>
                  <label className="maintenance-field-wide" htmlFor="maintenance-provenance-title">
                    <span className={labelClass}>{provenanceDraft.entryType === 'contributor' ? 'Contributor name' : 'Title or value'}</span>
                    <input id="maintenance-provenance-title" className={inputClass} maxLength={300} value={provenanceDraft.title} onChange={event => { clearProvenanceAttempt(); setProvenanceDraft(draft => ({ ...draft, title: event.target.value })); }} autoComplete="off" required />
                  </label>
                  <label htmlFor="maintenance-provenance-role">
                    <span className={labelClass}>Role {provenanceDraft.entryType === 'contributor' ? '(required)' : '(optional)'}</span>
                    <input id="maintenance-provenance-role" className={inputClass} maxLength={300} value={provenanceDraft.role} onChange={event => { clearProvenanceAttempt(); setProvenanceDraft(draft => ({ ...draft, role: event.target.value })); }} autoComplete="off" required={provenanceDraft.entryType === 'contributor'} />
                  </label>
                  <label htmlFor="maintenance-provenance-date">
                    <span className={labelClass}>When</span>
                    <input id="maintenance-provenance-date" className={inputClass} value={provenanceDraft.occurredAt} onChange={event => { clearProvenanceAttempt(); setProvenanceDraft(draft => ({ ...draft, occurredAt: event.target.value })); }} placeholder="2026, 2026-07, or 2026-07-31" autoComplete="off" />
                  </label>
                  <label className="maintenance-field-wide" htmlFor="maintenance-provenance-detail">
                    <span className={labelClass}>Detail</span>
                    <textarea id="maintenance-provenance-detail" className={inputClass} rows={4} maxLength={5000} value={provenanceDraft.detail} onChange={event => { clearProvenanceAttempt(); setProvenanceDraft(draft => ({ ...draft, detail: event.target.value })); }} />
                  </label>
                </div>
                {provenanceError && <p className="maintenance-inline-error" role="alert">{provenanceError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closeProvenanceEditor} disabled={provenanceSaving}>Cancel</button>
                  <button type="submit" className={primaryButtonClass} disabled={provenanceSaving}>Review creator history</button>
                </div>
              </form>
            )}

            {provenanceReview && (
              <div className="maintenance-review" aria-labelledby="maintenance-provenance-review-title">
                <div className="maintenance-review-heading">
                  <p className="admin-eyebrow">Confirmation required</p>
                  <h3 id="maintenance-provenance-review-title">Review creator-history {provenanceReview.action === 'create' ? 'entry' : provenanceReview.action === 'correct' ? 'correction' : 'removal'}</h3>
                  <p>{provenanceReview.action === 'remove'
                    ? 'The entry leaves the current view. Its prior values, administrator, and removal reason remain in append-only maintenance history.'
                    : 'Confirm both the content and its audience. Changing visibility can make this appear on or disappear from the public scanned record.'}</p>
                </div>
                <div className="maintenance-review-grid">
                  <div><h4>Before</h4><ProvenanceSnapshot entry={provenanceReview.before} emptyLabel="No prior creator-history entry." /></div>
                  <div><h4>After</h4><ProvenanceSnapshot entry={provenanceReview.after} /></div>
                </div>
                <label htmlFor="maintenance-provenance-reason">
                  <span className={labelClass}>Reason for this creator-history change</span>
                  <textarea ref={provenanceReasonRef} id="maintenance-provenance-reason" className={inputClass} rows={3} required value={provenanceReason} disabled={provenanceSaving || ambiguousAttempt === 'provenance'} onChange={event => { if (clearProvenanceAttempt()) setProvenanceReason(event.target.value); }} />
                </label>
                {!registryUnlocked && (
                  <AdminAlert tone="warning">
                    <p>Unlock the private registry before confirming this creator-history change.</p>
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
                {provenanceError && <p className="maintenance-inline-error" role="alert">{provenanceError}</p>}
                <div className="maintenance-actions">
                  <button type="button" className={quietButtonClass} onClick={closeProvenanceEditor} disabled={provenanceSaving || ambiguousAttempt === 'provenance'}>Cancel</button>
                  <button type="button" className={primaryButtonClass} onClick={() => void confirmProvenanceSave()} disabled={provenanceSaving || !registryUnlocked || !provenanceReason.trim()}>{provenanceSaving ? 'Saving…' : provenanceReview.action === 'remove' ? 'Confirm removal from current view' : 'Confirm creator-history save'}</button>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection title="Current steward">
            {selected.steward ? (
              <>
                <div className="maintenance-section-actions">
                  <button type="button" className={primaryButtonClass} onClick={() => openStewardEditor('transfer_steward')} disabled={transitionBusy}>Transfer steward</button>
                </div>
                <StewardSnapshot steward={selected.steward} />
              </>
            ) : (
              <>
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
                  <label className="maintenance-field-wide" htmlFor="maintenance-transfer-kind">
                    <span className={labelClass}>Transfer kind</span>
                    <select id="maintenance-transfer-kind" className={inputClass} value={stewardTransferKind} onChange={event => setStewardTransferKind(event.target.value as MaintenanceTransferKind)}>
                      <option value="sale">Sale</option>
                      <option value="gift">Gift</option>
                      <option value="inheritance">Inheritance</option>
                      <option value="artist-rebind">Artist rebind</option>
                    </select>
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
                  <h3 id="maintenance-steward-review-title">Review steward transfer</h3>
                  <p>Transfer assigns the verified account, starts a new claim time, clears the current display location, and appends a permanent public lineage event.</p>
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
                    disabled={stewardSaving || ambiguousAttempt === 'steward'}
                    onChange={event => {
                      if (clearStewardAttempt()) setStewardReason(event.target.value);
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
                  <button type="button" className={quietButtonClass} onClick={closeStewardEditor} disabled={stewardSaving || ambiguousAttempt === 'steward'}>Cancel</button>
                  <button
                    type="button"
                    className={primaryButtonClass}
                    onClick={() => void confirmStewardSave()}
                    disabled={stewardSaving || !registryUnlocked || !stewardReason.trim()}
                  >
                    {stewardSaving ? 'Saving…' : 'Confirm steward transfer'}
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
