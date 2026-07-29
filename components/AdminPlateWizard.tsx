/**
 * Guided Artwork Plate wizard.
 *
 * A linear, one-piece-at-a-time walkthrough of the permanent artwork-plate
 * lifecycle. It drives the SAME admin endpoints as the flat registry desk
 * (components/AdminPieces.tsx) and adds no new server behavior — it only
 * sequences the existing operations into the runbook order and refuses to let a
 * step be skipped before its gate is met:
 *
 *   Unlock → Choose → Issue → Fabrication files → Encrypted backup →
 *   Prove recovery → Activate
 *
 * Sensitive values (the Ownership Code and the SVGs) exist only in this
 * component's immediate React state. They are never written to browser storage
 * and are cleared when the wizard is finished or dismissed. The persistent
 * admin shell supplies the authenticated boundary; the private registry unlock
 * is the in-wizard second factor.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';
import { FULL_ARCHIVE } from '../data/mockData';
import {
  activationChecklistComplete,
  beginIssuanceAttempt,
  projectIssuedPlateResponse,
  projectPlateDownloads,
  type ActivationChecklist,
  type IssuedPlatePackage,
} from '../utils/adminArtworkRegistry';
import {
  PLATE_WIZARD_STAGES,
  plateWizardStageForPiece,
  plateWizardStageIndex,
  type PlateLifecycleSnapshot,
  type PlateWizardStageKey,
} from '../utils/plateWizard';

const inputClass =
  'w-full border border-wood-300 bg-white px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const labelClass =
  'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
const buttonClass =
  'min-h-11 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';
const quietButtonClass =
  'min-h-11 font-label text-[11px] uppercase tracking-[0.14em] text-wood-600 border border-wood-300 px-4 py-2 hover:border-wood-500 hover:text-wood-900 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';

interface PieceRow {
  id: string;
  pieceId: string;
  editionNumber: number;
  publicCode: string | null;
  plateStatus: string;
  backupStatus: string | null;
  backupReference: string | null;
  frontSha256: string | null;
  undersideSha256: string | null;
  plateGeneratedAt: string | null;
  plateActivatedAt: string | null;
  backupAt: string | null;
  keeperBound: boolean;
  currentDisplayLocation: string | null;
  registeredAt: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
}

interface DraftArtwork {
  id: string;
  title: string;
  series: string | null;
  editionKind: 'unique' | 'numbered';
  editionSize: number | null;
}

interface MintableArtwork {
  id: string;
  title: string;
  draft: boolean;
  editionKind: 'unique' | 'numbered' | 'unspecified' | 'conflict';
  editionSize: number | null;
}

const ADD_PIECE_ERRORS: Record<string, string> = {
  invalid_id: 'ID must look like UL-105 — 2 to 3 letters, a dash, then 3 digits.',
  reserved_prefix: 'IDs starting with AR- are reserved for plate codes. Use another prefix.',
  invalid_title: 'Enter a title (up to 120 characters).',
  edition_required: 'Choose whether this work is unique or numbered.',
  invalid_edition_kind: 'Choose Unique or Numbered.',
  unique_confirmation_required: 'Confirm that this is a unique, non-numbered work.',
  edition_size_required: 'Enter the edition size for this numbered work.',
  invalid_edition_size: 'Edition size must be a whole number from 1 to 9999.',
  already_in_catalog: 'A piece with that ID already exists in the catalog.',
  already_exists: 'You already added a draft piece with that ID.',
};

const emptyChecklist: ActivationChecklist = {
  realMetalQrScanned: false,
  artworkEditionPublicCodeMatch: false,
  undersideOwnershipCodeMatch: false,
  attachmentAndAbrasionInspected: false,
  frontSha256: '',
  undersideSha256: '',
};

const TITLE_BY_ID: Record<string, string> = Object.fromEntries(
  FULL_ARCHIVE.map((artwork) => [artwork.id, artwork.title]),
);

function titleFor(pieceId: string): string {
  return TITLE_BY_ID[pieceId] || pieceId;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Not yet';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

async function jsonRequest(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }
  return data;
}

function downloadText(filename: string, mimeType: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function snapshotOf(row: PieceRow): PlateLifecycleSnapshot {
  return {
    plateStatus: row.plateStatus,
    backupStatus: row.backupStatus,
  };
}

const AdminPlateWizard: React.FC = () => {
  // Access + data
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Wizard position
  const [started, setStarted] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [pieceId, setPieceId] = useState<string | null>(null); // keeper_pieces.id of the piece in flight
  const [busy, setBusy] = useState('');
  const [stepError, setStepError] = useState('');
  const [stepNote, setStepNote] = useState('');

  // Issue stage
  const [issueArtwork, setIssueArtwork] = useState('');
  const [issueEdition, setIssueEdition] = useState('');
  const [issueEditionKind, setIssueEditionKind] = useState<'' | 'unique' | 'numbered'>('');
  const [issueEditionSize, setIssueEditionSize] = useState('');
  const [issueUniqueConfirmed, setIssueUniqueConfirmed] = useState(false);
  const [issuanceKey, setIssuanceKey] = useState<string | null>(null);
  const issuanceKeyRef = useRef<string | null>(null);
  const [pkg, setPkg] = useState<IssuedPlatePackage | null>(null);
  // Draft catalog — admin-added pieces not yet in the static catalog
  const [drafts, setDrafts] = useState<DraftArtwork[]>([]);
  const [showAddPiece, setShowAddPiece] = useState(false);
  const [newPieceId, setNewPieceId] = useState('');
  const [newPieceTitle, setNewPieceTitle] = useState('');
  const [newPieceSeries, setNewPieceSeries] = useState('');
  const [newPieceEditionKind, setNewPieceEditionKind] = useState<'' | 'unique' | 'numbered'>('');
  const [newPieceUniqueConfirmed, setNewPieceUniqueConfirmed] = useState(false);
  const [newPieceEdition, setNewPieceEdition] = useState('');
  const [addPieceBusy, setAddPieceBusy] = useState(false);
  const [addPieceError, setAddPieceError] = useState('');

  // Fabrication stage
  const [filesArchived, setFilesArchived] = useState(false);

  // Recovery stage
  const [recoveryProven, setRecoveryProven] = useState(false);
  const [recoveryStagingAck, setRecoveryStagingAck] = useState(false);

  // Activate stage
  const [checks, setChecks] = useState<ActivationChecklist>(emptyChecklist);

  const [finished, setFinished] = useState(false);

  // Google Drive sync
  const [driveStatus, setDriveStatus] = useState('');

  const stage = PLATE_WIZARD_STAGES[stageIndex];
  const piece = useMemo(
    () => (pieceId ? rows.find((row) => row.id === pieceId) || null : null),
    [pieceId, rows],
  );
  const mintableArtworks = useMemo(() => {
    const draftsById = new Map(drafts.map((draft) => [draft.id, draft]));
    const staticList: MintableArtwork[] = FULL_ARCHIVE.map((a) => {
      const draft = draftsById.get(a.id);
      const staticHasEdition = Number.isInteger(a.editionSize);
      const conflict = staticHasEdition && draft
        && (draft.editionKind !== 'numbered' || draft.editionSize !== a.editionSize);
      return {
        id: a.id,
        title: a.title,
        draft: false,
        editionKind: conflict
          ? 'conflict'
          : staticHasEdition
            ? 'numbered'
            : draft?.editionKind || 'unspecified',
        editionSize: staticHasEdition ? a.editionSize! : draft?.editionSize ?? null,
      };
    });
    const draftList = drafts
      .filter((d) => !FULL_ARCHIVE.some((a) => a.id === d.id))
      .map((d): MintableArtwork => ({
        id: d.id,
        title: d.title,
        draft: true,
        editionKind: d.editionKind,
        editionSize: d.editionSize,
      }));
    return [...staticList, ...draftList].sort((a, b) => a.title.localeCompare(b.title));
  }, [drafts]);
  const selectedArtwork = useMemo(
    () => mintableArtworks.find((artwork) => artwork.id === issueArtwork) || null,
    [issueArtwork, mintableArtworks],
  );
  const selectedEditionKind = selectedArtwork?.editionKind === 'unique'
    || selectedArtwork?.editionKind === 'numbered'
    ? selectedArtwork.editionKind
    : '';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const piecesData = await jsonRequest('/api/admin/pieces');
      setRows(piecesData.pieces as PieceRow[]);
    } catch (error) {
      setLoadError(errorMessage(error, 'Could not load the registry.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const data = await jsonRequest('/api/admin/artworks');
      setDrafts((data.artworks as DraftArtwork[]) || []);
    } catch {
      // Drafts are optional; the static catalog still populates the dropdown.
    }
  }, []);

  useEffect(() => {
    void jsonRequest('/api/admin/registry-unlock')
      .then((data) => setRegistryUnlocked(data.unlocked === true))
      .catch(() => setRegistryUnlocked(false));
    void loadAll();
    void loadDrafts();
  }, [loadAll, loadDrafts]);

  const resetSensitive = useCallback(() => {
    setPkg(null);
    setIssuanceKey(null);
    issuanceKeyRef.current = null;
    setChecks(emptyChecklist);
    setFilesArchived(false);
    setRecoveryProven(false);
    setRecoveryStagingAck(false);
  }, []);

  // Clear sensitive material if the wizard unmounts.
  useEffect(() => () => resetSensitive(), [resetSensitive]);

  useEffect(() => {
    if (!started || finished || stage.key !== 'activate' || piece?.plateStatus !== 'active') return;
    resetSensitive();
    setStepNote('Plate identity is active and permanently locked. The registry lifecycle is complete.');
    setFinished(true);
  }, [finished, piece?.plateStatus, resetSensitive, stage.key, started]);

  const registryErrorMessage = (error: unknown, fallback: string) => {
    const message = errorMessage(error, fallback);
    if (message === 'registry_locked') {
      setRegistryUnlocked(false);
      return 'Private registry access expired. Unlock it again to continue.';
    }
    return message;
  };

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = unlockInputRef.current;
    if (!input?.value) return;
    setUnlockBusy(true);
    setUnlockError('');
    const body = JSON.stringify({ secret: input.value });
    input.value = '';
    try {
      const response = await fetch('/api/admin/registry-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unlock failed');
      setRegistryUnlocked(true);
    } catch (error) {
      setRegistryUnlocked(false);
      setUnlockError(errorMessage(error, 'Could not unlock the registry.'));
    } finally {
      setUnlockBusy(false);
    }
  };

  const beginNewPiece = () => {
    resetSensitive();
    setPieceId(null);
    setFinished(false);
    setStepError('');
    setStepNote('');
    setStageIndex(plateWizardStageIndex('issue'));
    setStarted(true);
  };

  const resumePiece = (row: PieceRow) => {
    const target = plateWizardStageForPiece(snapshotOf(row));
    if (!target) return;
    resetSensitive();
    setPieceId(row.id);
    setStepError('');
    setStepNote('The piece was already in the registry. Re-download the fabrication files if you need them.');
    setStageIndex(plateWizardStageIndex(target));
    setStarted(true);
  };

  const downloadLedger = async () => {
    setStepError('');
    try {
      const response = await fetch('/api/admin/registry-ledger');
      const contentType = response.headers.get('Content-Type') || '';
      if (!response.ok || !contentType.includes('ndjson')) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Ledger export failed (${response.status})`);
      }
      downloadText('registry-ledger.jsonl', 'application/x-ndjson', await response.text());
      setStepNote('Offline master ledger downloaded. Store it with your recovery set; online is a mirror you can rebuild from it.');
    } catch (error) {
      setStepError(registryErrorMessage(error, 'Could not export the offline ledger.'));
    }
  };

  // Sync the offline master ledger to Google Drive. Silent mode is used for the
  // automatic capture after each registry change: if Drive is not configured it
  // simply does nothing rather than nagging.
  const syncDrive = async (options?: { silent?: boolean }) => {
    try {
      const response = await fetch('/api/admin/registry-ledger', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 503 && data?.error === 'drive_not_configured') {
        if (!options?.silent) setDriveStatus('Google Drive sync is not configured yet. See the runbook to enable it.');
        return;
      }
      if (!response.ok || !data?.ok) throw new Error(data?.error || `Sync failed (${response.status})`);
      setDriveStatus(data.updated ? 'Offline ledger synced to Google Drive.' : 'Offline ledger created in Google Drive.');
    } catch (error) {
      if (!options?.silent) setDriveStatus(registryErrorMessage(error, 'Could not sync to Google Drive.'));
    }
  };

  const goToChoose = () => {
    resetSensitive();
    setStarted(false);
    setPieceId(null);
    setFinished(false);
    setStepError('');
    setStepNote('');
    void loadAll();
  };

  const startIssuanceOver = () => {
    setIssuanceKey(null);
    issuanceKeyRef.current = null;
    setIssueEdition('');
    setIssueEditionKind('');
    setIssueEditionSize('');
    setIssueUniqueConfirmed(false);
    setStepError('');
    setStepNote('');
  };

  // ── Stage actions ─────────────────────────────────────────────────────────
  const runIssue = async () => {
    if (!issueArtwork) {
      setStepError('Choose an artwork first.');
      return;
    }
    if (!selectedArtwork) {
      setStepError('Choose an artwork first.');
      return;
    }
    if (selectedArtwork.editionKind === 'conflict') {
      setStepError('This artwork has conflicting edition metadata. Resolve it before issuing.');
      return;
    }
    if (selectedArtwork.editionKind === 'unspecified') {
      setStepError('Save the exact edition structure before issuing.');
      return;
    }
    if (!selectedEditionKind) {
      setStepError('Choose whether this work is unique or numbered.');
      return;
    }
    const parsedEdition = Number(issueEdition);
    if (selectedEditionKind === 'unique') {
      if (!issueUniqueConfirmed) {
        setStepError('Confirm that this is a unique, non-numbered work.');
        return;
      }
    } else if (
      !issueEdition.trim() ||
      !Number.isSafeInteger(parsedEdition) ||
      parsedEdition < 1 ||
      parsedEdition > selectedArtwork.editionSize!
    ) {
      setStepError(`Enter the exact edition number from 1 to ${selectedArtwork.editionSize}.`);
      return;
    }
    const key = beginIssuanceAttempt(issuanceKey);
    issuanceKeyRef.current = key;
    setIssuanceKey(key);
    setBusy('issue');
    setStepError('');
    try {
      const data = await jsonRequest('/api/admin/pieces', {
        pieceId: issueArtwork,
        editionKind: selectedEditionKind,
        editionNumber: selectedEditionKind === 'unique' ? 0 : parsedEdition,
        uniqueConfirmed: selectedEditionKind === 'unique' ? issueUniqueConfirmed : undefined,
        issuanceKey: key,
      });
      const issued = projectIssuedPlateResponse(data);
      setPkg(issued);
      const piecesData = await jsonRequest('/api/admin/pieces');
      const nextRows = piecesData.pieces as PieceRow[];
      setRows(nextRows);
      const created = nextRows.find((row) => row.publicCode === issued.publicCode);
      if (created) setPieceId(created.id);
      setStepNote(data.backupStatus === 'verified'
        ? 'Plate issued and its encrypted backup verified.'
        : 'Plate issued. The online backup still needs to verify — you will repair it at the backup step.');
      void syncDrive({ silent: true });
    } catch (error) {
      setStepError(`${registryErrorMessage(error, 'Could not issue the plate.')} A retry reuses this same attempt and will not mint a second identity.`);
    } finally {
      setBusy('');
    }
  };

  const createPiece = async () => {
    if (issuanceKeyRef.current) {
      setAddPieceError('Start over before changing the artwork identity.');
      return;
    }
    if (!registryUnlocked) {
      setAddPieceError('Unlock the private registry first.');
      return;
    }
    const id = newPieceId.trim().toUpperCase();
    if (!/^[A-Z]{2,3}-[0-9]{3}$/.test(id)) {
      setAddPieceError(ADD_PIECE_ERRORS.invalid_id);
      return;
    }
    if (!newPieceTitle.trim()) {
      setAddPieceError(ADD_PIECE_ERRORS.invalid_title);
      return;
    }
    if (!newPieceEditionKind) {
      setAddPieceError(ADD_PIECE_ERRORS.edition_required);
      return;
    }
    if (newPieceEditionKind === 'unique' && !newPieceUniqueConfirmed) {
      setAddPieceError(ADD_PIECE_ERRORS.unique_confirmation_required);
      return;
    }
    const parsedEditionSize = Number(newPieceEdition);
    if (newPieceEditionKind === 'numbered' && !newPieceEdition.trim()) {
      setAddPieceError(ADD_PIECE_ERRORS.edition_size_required);
      return;
    }
    if (
      newPieceEditionKind === 'numbered' &&
      (!Number.isInteger(parsedEditionSize) || parsedEditionSize < 1 || parsedEditionSize > 9999)
    ) {
      setAddPieceError(ADD_PIECE_ERRORS.invalid_edition_size);
      return;
    }
    setAddPieceBusy(true);
    setAddPieceError('');
    try {
      const data = await jsonRequest('/api/admin/artworks', {
        id,
        title: newPieceTitle.trim(),
        series: newPieceSeries.trim() || undefined,
        editionKind: newPieceEditionKind,
        uniqueConfirmed: newPieceUniqueConfirmed,
        editionSize: newPieceEditionKind === 'numbered' ? parsedEditionSize : undefined,
      });
      if (issuanceKeyRef.current) return;
      await loadDrafts();
      if (issuanceKeyRef.current) return;
      setIssueArtwork(data.artwork.id);
      setIssueEdition('');
      setIssueEditionKind('');
      setIssueEditionSize('');
      setIssueUniqueConfirmed(false);
      setShowAddPiece(false);
      setNewPieceId('');
      setNewPieceTitle('');
      setNewPieceSeries('');
      setNewPieceEditionKind('');
      setNewPieceUniqueConfirmed(false);
      setNewPieceEdition('');
    } catch (error) {
      const message = registryErrorMessage(error, 'Could not add the piece.');
      setAddPieceError(ADD_PIECE_ERRORS[message] || message);
    } finally {
      setAddPieceBusy(false);
    }
  };

  const saveEditionStructure = async () => {
    if (issuanceKeyRef.current) {
      setAddPieceError('Start over before changing the artwork identity.');
      return;
    }
    if (!registryUnlocked) {
      setAddPieceError('Unlock the private registry first.');
      return;
    }
    if (!selectedArtwork || selectedArtwork.editionKind !== 'unspecified') return;
    if (!issueEditionKind) {
      setAddPieceError(ADD_PIECE_ERRORS.edition_required);
      return;
    }
    if (issueEditionKind === 'unique' && !issueUniqueConfirmed) {
      setAddPieceError(ADD_PIECE_ERRORS.unique_confirmation_required);
      return;
    }
    const editionSize = Number(issueEditionSize);
    if (
      issueEditionKind === 'numbered'
      && (!issueEditionSize.trim() || !Number.isSafeInteger(editionSize) || editionSize < 1 || editionSize > 9999)
    ) {
      setAddPieceError(ADD_PIECE_ERRORS.invalid_edition_size);
      return;
    }
    setAddPieceBusy(true);
    setAddPieceError('');
    try {
      await jsonRequest('/api/admin/artworks', {
        id: selectedArtwork.id,
        editionKind: issueEditionKind,
        editionSize: issueEditionKind === 'numbered' ? editionSize : undefined,
        uniqueConfirmed: issueEditionKind === 'unique' ? issueUniqueConfirmed : undefined,
      });
      if (issuanceKeyRef.current) return;
      await loadDrafts();
      if (issuanceKeyRef.current) return;
      setIssueEdition('');
      setIssueEditionKind('');
      setIssueEditionSize('');
      setIssueUniqueConfirmed(false);
      setStepNote('Edition structure saved. Confirm this piece identity, then issue its plate.');
    } catch (error) {
      setAddPieceError(registryErrorMessage(error, 'Could not save the edition structure.'));
    } finally {
      setAddPieceBusy(false);
    }
  };

  const refreshPiece = async () => {
    const piecesData = await jsonRequest('/api/admin/pieces');
    setRows(piecesData.pieces as PieceRow[]);
  };

  const runRowAction = async (action: 'backup' | 'package' | 'verify-recovery') => {
    if (!piece) return;
    setBusy(action);
    setStepError('');
    setStepNote('');
    try {
      const data = await jsonRequest(`/api/admin/pieces/${encodeURIComponent(piece.id)}/${action}`, {});
      if (action === 'package') {
        setPkg({ ...projectIssuedPlateResponse(data), backupStatus: piece.backupStatus || undefined });
        setStepNote('Fabrication package recovered. Re-download the files below.');
      } else if (action === 'verify-recovery') {
        setRecoveryProven(true);
        setStepNote(`R2 recovery passed with key version ${data.keyVersion}. Both fabrication hashes match — the encrypted backup alone can rebuild this plate.`);
      } else {
        await refreshPiece();
        setStepNote('Encrypted online backup verified.');
      }
    } catch (error) {
      setStepError(registryErrorMessage(error, `Could not ${action} this plate.`));
    } finally {
      setBusy('');
    }
  };

  const runActivate = async () => {
    if (!piece) return;
    if (!activationChecklistComplete(checks, piece.frontSha256 || '', piece.undersideSha256 || '')) {
      setStepError('Complete every physical check and paste both SHA-256 values from the private manifest.');
      return;
    }
    setBusy('activate');
    setStepError('');
    try {
      await jsonRequest(`/api/admin/pieces/${encodeURIComponent(piece.id)}/activate`, { ...checks });
      await refreshPiece();
      resetSensitive();
      setStepNote('Plate identity activated and permanently locked. The registry lifecycle is complete.');
      setFinished(true);
      void syncDrive({ silent: true });
    } catch (error) {
      setStepError(registryErrorMessage(error, 'Could not activate this plate.'));
    } finally {
      setBusy('');
    }
  };

  // ── Gate: may the operator advance from the current stage? ─────────────────
  const canAdvance = (() => {
    switch (stage.key) {
      case 'issue':
        return Boolean(piece);
      case 'fabricate':
        return filesArchived;
      case 'backup':
        return piece?.backupStatus === 'verified';
      case 'recovery':
        return recoveryProven || recoveryStagingAck;
      case 'activate':
        return false; // activation is terminal; the activation action finishes
      default:
        return false;
    }
  })();

  const goNext = () => {
    if (!canAdvance) return;
    setStepError('');
    setStepNote('');
    setStageIndex((index) => Math.min(index + 1, PLATE_WIZARD_STAGES.length - 1));
  };

  const goBack = () => {
    setStepError('');
    setStepNote('');
    setStageIndex((index) => Math.max(index - 1, 0));
  };

  // ── Screens ────────────────────────────────────────────────────────────────
  const downloads = pkg ? projectPlateDownloads(pkg) : [];
  const resumable = rows.filter((row) => plateWizardStageForPiece(snapshotOf(row)) !== null);

  return (
    <AdminPage width="medium">
      <div className="max-w-3xl mx-auto">
        <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
          Artwork Registry · Guided
        </p>
        <h1 className="font-title text-3xl md:text-4xl text-wood-900 mb-3">Plate wizard</h1>
        <p className="font-serif text-wood-600 leading-relaxed mb-8 max-w-2xl">
          One piece, start to finish. This walks the same permanent registry as the{' '}
          <Link to="/admin/pieces" className="text-bronze-700 underline underline-offset-4">full plate desk</Link>,
          in the exact runbook order, and will not let a step be skipped before its safeguard is met.
        </p>

        {/* ACCESS GATE */}
        {!registryUnlocked ? (
          <section className="border border-wood-200 bg-white p-6" aria-labelledby="unlock-title">
            <h2 id="unlock-title" className="font-title text-xl text-wood-900 mb-2">Unlock the private registry</h2>
            <p className="font-serif text-sm text-wood-600 mb-5">
              Every plate operation needs the registry step-up secret in addition to your signed-in
              administrator account. The secret is submitted once, cleared immediately, and never attached
              to later requests.
            </p>
            <form className="flex flex-wrap gap-3" onSubmit={unlock}>
              <input ref={unlockInputRef} type="password" autoComplete="off" className={`${inputClass} flex-1 min-w-[16rem]`} placeholder="Registry unlock secret" aria-label="Registry unlock secret" />
              <button type="submit" className={buttonClass} disabled={unlockBusy}>{unlockBusy ? 'Unlocking…' : 'Unlock registry'}</button>
            </form>
            {unlockError && <p className="font-sans text-sm text-red-700 mt-3" role="alert">{unlockError}</p>}
          </section>
        ) : !started ? (
          /* CHOOSE */
          <section aria-labelledby="choose-title">
            <div className="flex items-center justify-between gap-4 mb-5">
              <h2 id="choose-title" className="font-title text-xl text-wood-900">Begin</h2>
              <button type="button" className={quietButtonClass} onClick={() => void loadAll()} disabled={loading}>Refresh</button>
            </div>
            <button type="button" onClick={beginNewPiece} className="w-full text-left border border-bronze-500 bg-bronze-200/20 p-5 mb-6 hover:bg-bronze-200/40 transition-colors">
              <p className="font-title text-lg text-wood-900">Start a new piece</p>
              <p className="font-serif text-sm text-wood-600 mt-1">Mint a fresh permanent identity and walk it through activation.</p>
            </button>

            <h3 className="font-title text-lg text-wood-900 mb-3">Or resume a piece in progress</h3>
            {loadError ? (
              <div className="border border-red-300 bg-white p-6"><p className="font-sans text-sm text-red-700" role="alert">{loadError}</p></div>
            ) : loading && rows.length === 0 ? (
              <div className="border border-wood-200 bg-white p-6"><p className="font-sans text-sm text-wood-500">Loading registry…</p></div>
            ) : resumable.length === 0 ? (
              <div className="border border-wood-200 bg-white p-8 text-center"><p className="font-serif text-wood-600">No pieces are mid-flow. Start a new piece above.</p></div>
            ) : (
              <div className="border border-wood-200 bg-white divide-y divide-wood-200">
                {resumable.map((row) => {
                  const target = plateWizardStageForPiece(snapshotOf(row));
                  const targetStage = target ? PLATE_WIZARD_STAGES[plateWizardStageIndex(target)] : null;
                  return (
                    <button type="button" key={row.id} onClick={() => resumePiece(row)} className="w-full text-left p-5 hover:bg-paper-100/40 transition-colors">
                      <p className="font-serif text-wood-900">{titleFor(row.pieceId)} <span className="font-sans text-sm text-wood-500">{row.pieceId} · edition {row.editionNumber}</span></p>
                      <p className="font-sans text-xs text-wood-500 mt-1">{row.publicCode || 'Legacy identity'} · next: {targetStage?.title || 'complete'}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : finished ? (
          /* DONE */
          <section className="border border-bronze-500 bg-bronze-200/20 p-8 text-center" aria-labelledby="done-title">
            <h2 id="done-title" className="font-title text-2xl text-wood-900 mb-2">Piece complete</h2>
            <p className="font-serif text-wood-700 mb-6">{stepNote || 'This piece is active. Its public code and Ownership Code are permanent records.'}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className={buttonClass} onClick={beginNewPiece}>Start another piece</button>
              <button type="button" className={quietButtonClass} onClick={() => void downloadLedger()}>Download offline ledger</button>
              <button type="button" className={quietButtonClass} onClick={() => void syncDrive()}>Sync to Google Drive</button>
              <button type="button" className={quietButtonClass} onClick={goToChoose}>Back to start</button>
              <Link to="/admin/pieces" className={quietButtonClass}>Open the full desk</Link>
            </div>
            {driveStatus && <p className="font-sans text-sm text-wood-600 mt-4" role="status">{driveStatus}</p>}
            {stepError && <p className="font-sans text-sm text-red-700 mt-4" role="alert">{stepError}</p>}
          </section>
        ) : (
          /* RUN */
          <section aria-labelledby="run-title">
            <ol className="admin-stage-list" aria-label="Plate stages">
              {PLATE_WIZARD_STAGES.map((item, index) => (
                <li key={item.key} className={index < stageIndex ? 'is-complete' : index === stageIndex ? 'is-current' : ''} aria-current={index === stageIndex ? 'step' : undefined}>
                  <span>{index + 1}</span>{item.title}
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 id="run-title" className="font-title text-xl text-wood-900">{stage.title}</h2>
                <p className="font-serif text-sm text-wood-600 mt-1">{stage.summary}</p>
              </div>
              <button type="button" className={quietButtonClass} onClick={goToChoose}>Leave wizard</button>
            </div>

            {piece && (
              <p className="font-sans text-xs text-wood-500 mb-4">
                {titleFor(piece.pieceId)} · {piece.pieceId} · edition {piece.editionNumber}
                {piece.publicCode ? ` · ${piece.publicCode}` : ''} · plate {piece.plateStatus} · backup {piece.backupStatus || 'pending'}
              </p>
            )}

            <div className="border border-wood-200 bg-white p-5">
              {/* ISSUE */}
              {stage.key === 'issue' && (
                pkg ? (
                  <div className="border border-bronze-500 bg-bronze-200/20 p-5">
                    <p className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 font-semibold mb-2">Private fabrication package</p>
                    <p className="font-title text-xl text-wood-900 mb-1">{pkg.publicCode}</p>
                    <p className="font-title text-2xl md:text-3xl text-wood-900 tracking-[0.15em] break-all mb-3">{pkg.ownershipCode}</p>
                    <p className="font-serif text-sm text-wood-600">Identity minted. The Ownership Code above is the secret for the underside. It is shown once here and lives only in this screen. Continue to download the etch files.</p>
                  </div>
                ) : (
                  <div>
                    <div className="grid sm:grid-cols-[1fr_16rem] gap-4 items-end">
                      <div>
                        <label className={labelClass} htmlFor="wizard-artwork">Artwork</label>
                        <select id="wizard-artwork" value={issueArtwork} disabled={Boolean(busy || addPieceBusy || issuanceKey)} onChange={(event) => { setIssueArtwork(event.target.value); setIssueEdition(''); setIssueEditionKind(''); setIssueEditionSize(''); setIssueUniqueConfirmed(false); setStepError(''); }} className={inputClass}>
                          <option value="">Choose an artwork</option>
                          {mintableArtworks.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.title} · {artwork.id}{artwork.draft ? ' · draft' : ''}</option>)}
                        </select>
                      </div>
                      <div>
                        {selectedArtwork?.editionKind === 'unspecified' ? (
                          <div>
                            <fieldset className="mb-3">
                              <legend className={labelClass}>Edition structure</legend>
                              <div className="flex gap-4 font-sans text-sm text-wood-700">
                                {(['unique', 'numbered'] as const).map((kind) => (
                                  <label key={kind} className="flex items-center gap-2">
                                    <input type="radio" name="wizard-issue-edition-kind" value={kind} checked={issueEditionKind === kind} disabled={Boolean(busy || addPieceBusy || issuanceKey)} onChange={() => { setIssueEditionKind(kind); setIssueEditionSize(''); setIssueUniqueConfirmed(false); }} />
                                    <span>{kind === 'unique' ? 'Unique' : 'Numbered'}</span>
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                            {issueEditionKind === 'unique' && (
                              <label className="flex items-start gap-3 font-sans text-sm text-wood-700 mb-3">
                                <input type="checkbox" checked={issueUniqueConfirmed} disabled={Boolean(busy || addPieceBusy || issuanceKey)} onChange={(event) => setIssueUniqueConfirmed(event.target.checked)} className="mt-1" />
                                <span>This is a unique, non-numbered work</span>
                              </label>
                            )}
                            {issueEditionKind === 'numbered' && (
                              <div className="mb-3">
                                <label className={labelClass} htmlFor="wizard-edition-size">Exact edition size</label>
                                <input id="wizard-edition-size" type="number" min={1} max={9999} step={1} value={issueEditionSize} disabled={Boolean(busy || addPieceBusy || issuanceKey)} onChange={(event) => setIssueEditionSize(event.target.value)} className={inputClass} />
                              </div>
                            )}
                            <button type="button" className={quietButtonClass} disabled={Boolean(busy || addPieceBusy || issuanceKey)} onClick={() => void saveEditionStructure()}>{addPieceBusy ? 'Saving…' : 'Save edition structure'}</button>
                            {addPieceError && <p className="font-sans text-sm text-red-700 mt-3" role="alert">{addPieceError}</p>}
                          </div>
                        ) : selectedEditionKind === 'unique' ? (
                          <label className="flex items-start gap-3 font-sans text-sm text-wood-700 pb-2">
                            <input type="checkbox" checked={issueUniqueConfirmed} disabled={Boolean(busy || issuanceKey)} onChange={(event) => setIssueUniqueConfirmed(event.target.checked)} className="mt-1" />
                            <span>This is a unique, non-numbered work</span>
                          </label>
                        ) : selectedEditionKind === 'numbered' ? (
                          <div>
                            <label className={labelClass} htmlFor="wizard-edition">Exact edition (1 to {selectedArtwork?.editionSize})</label>
                            <input id="wizard-edition" type="number" min={1} max={selectedArtwork?.editionSize || undefined} step={1} value={issueEdition} disabled={Boolean(busy || issuanceKey)} onChange={(event) => setIssueEdition(event.target.value)} className={inputClass} />
                          </div>
                        ) : selectedArtwork?.editionKind === 'conflict' ? (
                          <p className="font-sans text-sm text-red-700 pb-2">Conflicting edition metadata must be resolved before issuing.</p>
                        ) : (
                          <p className="font-sans text-sm text-wood-500 pb-2">Choose an artwork to confirm its edition identity.</p>
                        )}
                      </div>
                    </div>
                    <p className="font-sans text-xs text-wood-500 mt-3">Issuing is idempotent: a retry returns the same identity, never a duplicate.</p>

                    {!issuanceKey && <div className="mt-4">
                      {!showAddPiece ? (
                        <button type="button" className="font-label text-[11px] uppercase tracking-[0.14em] text-bronze-700 underline underline-offset-4" onClick={() => { setShowAddPiece(true); setAddPieceError(''); }}>
                          Piece not in the list? Add it
                        </button>
                      ) : (
                        <div className="border border-wood-200 bg-paper-50 p-4">
                          <p className="font-label text-[11px] uppercase tracking-[0.14em] text-wood-600 font-semibold mb-3">Add a new piece</p>
                          <p className="font-serif text-sm text-wood-600 mb-4">Registers a piece so you can mint it now, before it exists physically or in the public catalog. You can flesh it out into the full catalog later.</p>
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className={labelClass} htmlFor="new-piece-title">Title</label>
                              <input id="new-piece-title" value={newPieceTitle} onChange={(e) => setNewPieceTitle(e.target.value)} className={inputClass} placeholder="Untitled Study" />
                            </div>
                            <div>
                              <label className={labelClass} htmlFor="new-piece-id">ID</label>
                              <input id="new-piece-id" value={newPieceId} onChange={(e) => setNewPieceId(e.target.value.toUpperCase())} className={inputClass} placeholder="UL-105" />
                            </div>
                            <div>
                              <label className={labelClass} htmlFor="new-piece-series">Series (optional)</label>
                              <input id="new-piece-series" value={newPieceSeries} onChange={(e) => setNewPieceSeries(e.target.value)} className={inputClass} placeholder="Universal Language" />
                            </div>
                            <fieldset className="sm:col-span-2">
                              <legend className={labelClass}>Edition identity</legend>
                              <div className="flex flex-wrap gap-5 font-sans text-sm text-wood-700">
                                <label className="flex items-center gap-2">
                                  <input type="radio" name="new-piece-edition-kind" value="unique" checked={newPieceEditionKind === 'unique'} onChange={() => { setNewPieceEditionKind('unique'); setNewPieceEdition(''); setNewPieceUniqueConfirmed(false); }} />
                                  <span>Unique</span>
                                </label>
                                <label className="flex items-center gap-2">
                                  <input type="radio" name="new-piece-edition-kind" value="numbered" checked={newPieceEditionKind === 'numbered'} onChange={() => { setNewPieceEditionKind('numbered'); setNewPieceUniqueConfirmed(false); }} />
                                  <span>Numbered</span>
                                </label>
                              </div>
                            </fieldset>
                            {newPieceEditionKind === 'unique' && (
                              <label className="sm:col-span-2 flex items-start gap-3 font-sans text-sm text-wood-700">
                                <input type="checkbox" checked={newPieceUniqueConfirmed} onChange={(event) => setNewPieceUniqueConfirmed(event.target.checked)} className="mt-1" />
                                <span>This is a unique, non-numbered work</span>
                              </label>
                            )}
                            {newPieceEditionKind === 'numbered' && (
                              <div>
                                <label className={labelClass} htmlFor="new-piece-edition">Edition size</label>
                                <input id="new-piece-edition" type="number" min={1} max={9999} step={1} value={newPieceEdition} onChange={(e) => setNewPieceEdition(e.target.value)} className={inputClass} />
                              </div>
                            )}
                          </div>
                          <p className="font-sans text-xs text-wood-500 mt-2">ID format: 2 to 3 letters, a dash, then 3 digits (e.g. UL-105). Not starting with AR-.</p>
                          <div className="flex flex-wrap gap-3 mt-4">
                            <button type="button" className={buttonClass} disabled={Boolean(addPieceBusy || busy || issuanceKey)} onClick={() => void createPiece()}>{addPieceBusy ? 'Adding…' : 'Add piece'}</button>
                            <button type="button" className={quietButtonClass} disabled={Boolean(addPieceBusy || busy || issuanceKey)} onClick={() => { setShowAddPiece(false); setAddPieceError(''); }}>Cancel</button>
                          </div>
                          {addPieceError && <p className="font-sans text-sm text-red-700 mt-3" role="alert">{addPieceError}</p>}
                        </div>
                      )}
                    </div>}

                    <button type="button" onClick={runIssue} disabled={Boolean(busy || addPieceBusy) || selectedArtwork?.editionKind === 'unspecified' || selectedArtwork?.editionKind === 'conflict'} className={`${buttonClass} mt-4`}>{busy === 'issue' ? 'Issuing…' : 'Issue permanent identity'}</button>
                    {issuanceKey && !pkg && !busy && (
                      <button type="button" className={`${quietButtonClass} mt-4 ml-3`} onClick={startIssuanceOver}>Start over with a different identity</button>
                    )}
                  </div>
                )
              )}

              {/* FABRICATE */}
              {stage.key === 'fabricate' && (
                <div>
                  {downloads.length > 0 ? (
                    <>
                      <p className="font-serif text-sm text-wood-600 mb-4">Download all three files and archive them together off-site. The manifest is private: it holds the Ownership Code and is not the buyer's certificate. Send only the two SVGs to the etcher.</p>
                      <div className="flex flex-wrap gap-3">
                        {downloads.map((download) => (
                          <button key={download.filename} type="button" className={buttonClass} onClick={() => downloadText(download.filename, download.mimeType, download.content)}>
                            Download {download.filename.includes('front') ? 'front SVG' : download.filename.includes('underside') ? 'underside SVG' : 'private manifest'}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-start gap-3 font-sans text-sm text-wood-700 mt-5">
                        <input type="checkbox" checked={filesArchived} onChange={(event) => setFilesArchived(event.target.checked)} className="mt-1" />
                        <span>I downloaded and archived the front SVG, underside SVG, and private manifest, and compared the codes and both SHA-256 hashes against the manifest.</span>
                      </label>
                    </>
                  ) : (
                    <>
                      <p className="font-serif text-sm text-wood-600 mb-4">The fabrication files are not in this screen's memory. Recover them from the encrypted store to download again. This is audited.</p>
                      <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void runRowAction('package')}>{busy === 'package' ? 'Recovering…' : 'Recover fabrication package'}</button>
                    </>
                  )}
                </div>
              )}

              {/* BACKUP */}
              {stage.key === 'backup' && (
                <div>
                  <p className="font-serif text-sm text-wood-600 mb-4">
                    The encrypted Ownership Code envelope must be mirrored and verified in R2 before the identity can be locked. Current status: <strong>{piece?.backupStatus || 'pending'}</strong>{piece?.backupAt ? ` · ${formatDate(piece.backupAt)}` : ''}.
                  </p>
                  {piece?.backupStatus !== 'verified' && (
                    <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void runRowAction('backup')}>{busy === 'backup' ? 'Retrying…' : 'Retry encrypted backup'}</button>
                  )}
                  {piece?.backupStatus === 'verified' && <p className="font-sans text-sm text-green-800" role="status">Backup verified. You can continue.</p>}
                </div>
              )}

              {/* RECOVERY */}
              {stage.key === 'recovery' && (
                <div>
                  <p className="font-serif text-sm text-wood-600 mb-4">
                    Prove the encrypted backup can rebuild this exact plate from R2 alone, before any metal is cut. This decrypts in memory, re-derives both SVGs, and confirms their hashes still match. It returns no code or file.
                  </p>
                  <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void runRowAction('verify-recovery')}>{busy === 'verify-recovery' ? 'Proving…' : 'Verify R2 recovery'}</button>
                  {recoveryProven && <p className="font-sans text-sm text-green-800 mt-3" role="status">Recovery proven. You can continue.</p>}
                  {!recoveryProven && (
                    <label className="flex items-start gap-3 font-sans text-sm text-wood-700 mt-5">
                      <input type="checkbox" checked={recoveryStagingAck} onChange={(event) => setRecoveryStagingAck(event.target.checked)} className="mt-1" />
                      <span>Staging only: I will run the R2 recovery drill before engraving a production plate. (The runbook requires a passing drill before real metal.)</span>
                    </label>
                  )}
                </div>
              )}

              {/* ACTIVATE */}
              {stage.key === 'activate' && (
                piece?.plateStatus === 'active' ? (
                  <p className="font-sans text-sm text-green-800" role="status">Plate is active and permanently locked. Completing the registry lifecycle…</p>
                ) : (
                  <div>
                    <p className="font-serif text-sm text-wood-600 mb-4">Activation permanently locks the two codes. Compare the actual engraved metal, not a screen preview. Paste both SHA-256 values from the private manifest; they start empty so copied screen state cannot confirm this check.</p>
                    <div className="grid gap-3">
                      {([
                        ['realMetalQrScanned', 'Scanned the engraved metal QR on a phone and it opened the exact URL'],
                        ['artworkEditionPublicCodeMatch', 'Artwork, edition, and public code on the metal all match'],
                        ['undersideOwnershipCodeMatch', 'Underside Ownership Code matches the private manifest, character for character'],
                        ['attachmentAndAbrasionInspected', 'Attachment, quiet zone, and abrasion resistance inspected'],
                      ] as const).map(([field, label]) => (
                        <label key={field} className="flex items-start gap-3 font-sans text-sm text-wood-700">
                          <input type="checkbox" checked={checks[field]} onChange={(event) => setChecks((current) => ({ ...current, [field]: event.target.checked }))} className="mt-1" />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 mt-4">
                      <div><label className={labelClass} htmlFor="wizard-front-hash">Front SHA-256</label><input id="wizard-front-hash" value={checks.frontSha256} onChange={(event) => setChecks((current) => ({ ...current, frontSha256: event.target.value.trim() }))} className={inputClass} /></div>
                      <div><label className={labelClass} htmlFor="wizard-under-hash">Underside SHA-256</label><input id="wizard-under-hash" value={checks.undersideSha256} onChange={(event) => setChecks((current) => ({ ...current, undersideSha256: event.target.value.trim() }))} className={inputClass} /></div>
                    </div>
                    <button type="button" className={`${buttonClass} mt-4`} disabled={Boolean(busy)} onClick={() => void runActivate()}>{busy === 'activate' ? 'Activating…' : 'Activate and lock identity'}</button>
                  </div>
                )
              )}

              {stepNote && <p className="font-sans text-sm text-green-800 mt-4" role="status">{stepNote}</p>}
              {stepError && <p className="font-sans text-sm text-red-700 mt-4" role="alert">{stepError}</p>}
            </div>

            {/* NAV */}
            <div className="flex items-center justify-between gap-3 mt-6">
              <button type="button" className={quietButtonClass} onClick={goBack} disabled={stageIndex === 0}>Back</button>
              {stage.key !== 'activate' && (
                <button type="button" className={buttonClass} onClick={goNext} disabled={!canAdvance}>Next step</button>
              )}
            </div>
            {driveStatus && <p className="font-sans text-xs text-wood-500 mt-3" role="status">{driveStatus}</p>}
          </section>
        )}
      </div>
    </AdminPage>
  );
};

export default AdminPlateWizard;
