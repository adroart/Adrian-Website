/**
 * Artwork Registry desk for issuing permanent plate identities, verifying the
 * physical plate, and recovering an Ownership Code.
 *
 * Sensitive values exist only in this component's immediate React state. They
 * are never written to browser storage and are cleared on dismissal or plate
 * activation. The persistent admin shell supplies the authenticated boundary.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';
import { adminMode } from './admin/adminMode';
import { FULL_ARCHIVE } from '../data/mockData';
import {
  activationChecklistComplete,
  beginIssuanceAttempt,
  projectPlateDownloads,
  projectIssuedPlateResponse,
  type ActivationChecklist,
  type IssuedPlatePackage,
  type SensitivePlateState,
} from '../utils/adminArtworkRegistry';

type RegistrySensitiveState = Omit<SensitivePlateState, 'stepUpSecret'>;

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

interface MintableArtwork {
  id: string;
  title: string;
  draft: boolean;
  editionKind: 'unique' | 'numbered' | 'unspecified' | 'conflict';
  editionSize: number | null;
}

const emptySensitiveState: RegistrySensitiveState = {
  issuanceKey: null,
  package: null,
  revealedForPieceId: null,
  revealedOwnershipCode: null,
  revealedUndersideSvg: null,
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

const AdminPieces: React.FC = () => {
  const [searchParams] = useSearchParams();
  const issueMode = adminMode(searchParams) === 'issue';
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [editionNumber, setEditionNumber] = useState('');
  const [issueEditionKind, setIssueEditionKind] = useState<'' | 'unique' | 'numbered'>('');
  const [issueEditionSize, setIssueEditionSize] = useState('');
  const [uniqueConfirmed, setUniqueConfirmed] = useState(false);
  const [structureSaving, setStructureSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');
  const [sensitive, setSensitive] = useState<RegistrySensitiveState>(emptySensitiveState);
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, string>>({});
  const [activationPieceId, setActivationPieceId] = useState<string | null>(null);
  const [activationChecks, setActivationChecks] = useState<ActivationChecklist>(emptyChecklist);

  const registryErrorMessage = (error: unknown, fallback: string) => {
    const message = errorMessage(error, fallback);
    if (message === 'registry_locked') {
      setRegistryUnlocked(false);
      return 'Private registry access expired. Unlock it again.';
    }
    return message;
  };

  const [drafts, setDrafts] = useState<{
    id: string;
    title: string;
    series: string | null;
    editionKind: 'unique' | 'numbered';
    editionSize: number | null;
  }[]>([]);
  const sortedPieces = useMemo(() => {
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
    () => sortedPieces.find((artwork) => artwork.id === pieceId) || null,
    [pieceId, sortedPieces],
  );
  const selectedEditionKind = selectedArtwork?.editionKind === 'unique'
    || selectedArtwork?.editionKind === 'numbered'
    ? selectedArtwork.editionKind
    : '';

  const loadPieces = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const data = await jsonRequest('/api/admin/pieces');
      setRows(data.pieces as PieceRow[]);
    } catch (error) {
      setListError(errorMessage(error, 'Could not load the registry.'));
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const data = await jsonRequest('/api/admin/artworks');
      setDrafts(data.artworks || []);
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    void loadPieces();
    void jsonRequest('/api/admin/registry-unlock')
      .then((data) => setRegistryUnlocked(data.unlocked === true))
      .catch(() => setRegistryUnlocked(false));
    void loadDrafts();
  }, [loadDrafts, loadPieces]);

  const dismissSensitiveState = () => {
    setSensitive(emptySensitiveState);
    setIssueSuccess('');
  };

  const unlockRegistry = async (event: React.FormEvent) => {
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

  const lockRegistry = async () => {
    setUnlockBusy(true);
    setUnlockError('');
    setRegistryUnlocked(false);
    dismissSensitiveState();
    setActivationPieceId(null);
    setActivationChecks(emptyChecklist);
    try {
      const response = await fetch('/api/admin/registry-unlock', { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || 'Lock failed');
    } catch (error) {
      setUnlockError(errorMessage(error, 'Could not lock the registry.'));
    } finally {
      setUnlockBusy(false);
    }
  };

  const saveEditionStructure = async () => {
    if (!registryUnlocked) {
      setIssueError('Unlock the private registry first.');
      return;
    }
    if (!selectedArtwork || selectedArtwork.editionKind !== 'unspecified') return;
    if (!issueEditionKind) {
      setIssueError('Choose whether this work is unique or numbered.');
      return;
    }
    if (issueEditionKind === 'unique' && !uniqueConfirmed) {
      setIssueError('Confirm that this is a unique, non-numbered work.');
      return;
    }
    const editionSize = Number(issueEditionSize);
    if (
      issueEditionKind === 'numbered'
      && (!issueEditionSize.trim() || !Number.isSafeInteger(editionSize) || editionSize < 1 || editionSize > 9999)
    ) {
      setIssueError('Enter the exact edition size from 1 to 9999.');
      return;
    }
    setStructureSaving(true);
    setIssueError('');
    setIssueSuccess('');
    try {
      await jsonRequest('/api/admin/artworks', {
        id: selectedArtwork.id,
        editionKind: issueEditionKind,
        editionSize: issueEditionKind === 'numbered' ? editionSize : undefined,
        uniqueConfirmed: issueEditionKind === 'unique' ? uniqueConfirmed : undefined,
      });
      await loadDrafts();
      setIssueEditionKind('');
      setIssueEditionSize('');
      setEditionNumber('');
      setUniqueConfirmed(false);
      setIssueSuccess('Edition structure saved. Confirm this piece identity, then issue its plate.');
    } catch (error) {
      setIssueError(registryErrorMessage(error, 'Could not save the edition structure.'));
    } finally {
      setStructureSaving(false);
    }
  };

  const issuePlate = async () => {
    if (!registryUnlocked) {
      setIssueError('Unlock the private registry first.');
      return;
    }
    if (!pieceId) {
      setIssueError('Choose an artwork first.');
      return;
    }
    if (!selectedArtwork) {
      setIssueError('Choose an artwork first.');
      return;
    }
    if (selectedArtwork.editionKind === 'conflict') {
      setIssueError('This artwork has conflicting edition metadata. Resolve it before issuing.');
      return;
    }
    if (selectedArtwork.editionKind === 'unspecified') {
      setIssueError('Save the exact edition structure before issuing.');
      return;
    }
    if (!selectedEditionKind) {
      setIssueError('Choose whether this work is unique or numbered.');
      return;
    }
    const parsedEdition = Number(editionNumber);
    if (selectedEditionKind === 'unique') {
      if (!uniqueConfirmed) {
        setIssueError('Confirm that this is a unique, non-numbered work.');
        return;
      }
    } else if (
      !editionNumber.trim() ||
      !Number.isSafeInteger(parsedEdition) ||
      parsedEdition < 1 ||
      parsedEdition > selectedArtwork.editionSize!
    ) {
      setIssueError(`Enter the exact edition number from 1 to ${selectedArtwork.editionSize}.`);
      return;
    }
    const issuanceKey = beginIssuanceAttempt(sensitive.issuanceKey);
    setSensitive((current) => ({ ...current, issuanceKey, package: null }));
    setIssuing(true);
    setIssueError('');
    setIssueSuccess('');
    try {
      const data = await jsonRequest('/api/admin/pieces', {
        pieceId,
        editionKind: selectedEditionKind,
        editionNumber: selectedEditionKind === 'unique' ? 0 : parsedEdition,
        uniqueConfirmed: selectedEditionKind === 'unique' ? uniqueConfirmed : undefined,
        issuanceKey,
      });
      const issuedPackage: IssuedPlatePackage = projectIssuedPlateResponse(data);
      setSensitive((current) => ({ ...current, issuanceKey, package: issuedPackage }));
      setIssueSuccess(data.backupStatus === 'verified'
        ? 'Plate package issued and encrypted backup verified.'
        : 'Plate package issued. Repair the online backup before activation.');
      await loadPieces();
      void syncDrive({ silent: true });
    } catch (error) {
      setIssueError(`${registryErrorMessage(error, 'Could not issue the plate.')} Retry keeps this issuance attempt and will not mint a second identity.`);
    } finally {
      setIssuing(false);
    }
  };

  const [driveStatus, setDriveStatus] = useState('');

  const syncDrive = async (options?: { silent?: boolean }) => {
    if (!registryUnlocked) {
      if (!options?.silent) setListError('Unlock the private registry first.');
      return;
    }
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

  const downloadLedger = async () => {
    if (!registryUnlocked) {
      setListError('Unlock the private registry first.');
      return;
    }
    try {
      const response = await fetch('/api/admin/registry-ledger');
      const contentType = response.headers.get('Content-Type') || '';
      if (!response.ok || !contentType.includes('ndjson')) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Ledger export failed (${response.status})`);
      }
      downloadText('registry-ledger.jsonl', 'application/x-ndjson', await response.text());
    } catch (error) {
      setListError(registryErrorMessage(error, 'Could not export the offline ledger.'));
    }
  };

  const runRowAction = async (
    row: PieceRow,
    action: 'backup' | 'reveal' | 'package' | 'verify-recovery',
  ) => {
    if (!registryUnlocked) {
      setRowError((current) => ({ ...current, [row.id]: 'Unlock the private registry first.' }));
      return;
    }
    setRowBusy(`${row.id}:${action}`);
    setRowError((current) => ({ ...current, [row.id]: '' }));
    setRowSuccess((current) => ({ ...current, [row.id]: '' }));
    try {
      const data = await jsonRequest(`/api/admin/pieces/${encodeURIComponent(row.id)}/${action}`, {});
      if (action === 'verify-recovery') {
        setRowSuccess((current) => ({
          ...current,
          [row.id]: `R2 recovery passed with key version ${data.keyVersion}. Both fabrication hashes match.`,
        }));
      } else if (action === 'package') {
        const recoveredPackage = {
          ...projectIssuedPlateResponse(data),
          backupStatus: row.backupStatus || undefined,
        };
        setSensitive((current) => ({
          ...current,
          issuanceKey: null,
          package: recoveredPackage,
          revealedForPieceId: null,
          revealedOwnershipCode: null,
          revealedUndersideSvg: null,
        }));
        setIssueSuccess('Full fabrication package recovered after audit.');
        setRowSuccess((current) => ({ ...current, [row.id]: 'Full fabrication package recovered.' }));
      } else if (action === 'reveal') {
        setSensitive((current) => ({
          ...current,
          revealedForPieceId: row.id,
          revealedOwnershipCode: data.ownershipCode,
          revealedUndersideSvg: data.undersideSvg,
        }));
        setRowSuccess((current) => ({ ...current, [row.id]: 'Ownership Code revealed after audit.' }));
      } else {
        setRowSuccess((current) => ({ ...current, [row.id]: 'Encrypted online backup verified.' }));
        await loadPieces();
      }
    } catch (error) {
      const message = registryErrorMessage(error, `Could not ${action} this plate.`);
      setRowError((current) => ({ ...current, [row.id]: message }));
    } finally {
      setRowBusy(null);
    }
  };

  const openActivation = (row: PieceRow) => {
    setActivationPieceId(row.id);
    setActivationChecks(emptyChecklist);
  };

  const activatePlate = async (row: PieceRow) => {
    if (!registryUnlocked) {
      setRowError((current) => ({ ...current, [row.id]: 'Unlock the private registry first.' }));
      return;
    }
    if (!activationChecklistComplete(
      activationChecks,
      row.frontSha256 || '',
      row.undersideSha256 || '',
    )) {
      setRowError((current) => ({ ...current, [row.id]: 'Complete every physical check using the stored hashes.' }));
      return;
    }
    setRowBusy(`${row.id}:activate`);
    setRowError((current) => ({ ...current, [row.id]: '' }));
    try {
      await jsonRequest(`/api/admin/pieces/${encodeURIComponent(row.id)}/activate`, {
        ...activationChecks,
      });
      setSensitive(emptySensitiveState);
      setActivationPieceId(null);
      setActivationChecks(emptyChecklist);
      setRowSuccess((current) => ({ ...current, [row.id]: 'Plate identity activated and locked.' }));
      await loadPieces();
      void syncDrive({ silent: true });
    } catch (error) {
      const message = registryErrorMessage(error, 'Could not activate this plate.');
      setRowError((current) => ({ ...current, [row.id]: message }));
    } finally {
      setRowBusy(null);
    }
  };

  const issued = sensitive.package;
  const registryStage = issueMode
    ? 0
    : rows.some(row => row.plateStatus === 'generated' && row.backupStatus === 'verified')
      ? 2
      : rows.some(row => row.plateStatus === 'generated')
        ? 1
        : 0;
  const registryStages = [
    'Issue identity',
    'Verify recovery copy',
    'Activate plate',
  ];

  return (
    <AdminPage width="medium">
        <div className="max-w-5xl mx-auto">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
            Artwork Registry
          </p>
          <h1 className="font-title text-3xl md:text-4xl text-wood-900 mb-3">Plate registry</h1>
          <p className="font-serif text-wood-600 leading-relaxed mb-4 max-w-2xl">
            Issue one permanent plate identity, download its private fabrication package, verify the
            physical metal, then activate and permanently lock its identity.
          </p>
          <p className="font-serif text-wood-600 leading-relaxed mb-10 max-w-2xl">
            New to this, or want a step-by-step path for one piece? Use the{' '}
            <Link to="/admin/pieces/wizard" className="text-bronze-700 underline underline-offset-4">guided plate wizard</Link>.
            This desk is the flat view of the same registry.
          </p>

          <ol className="admin-stage-list" aria-label="Plate registry stages">
            {registryStages.map((stage, index) => (
              <li key={stage} className={index < registryStage ? 'is-complete' : index === registryStage ? 'is-current' : ''} aria-current={index === registryStage ? 'step' : undefined}>
                <span>{index + 1}</span>{stage}
              </li>
            ))}
          </ol>

          {issued && (
            <section className="border border-bronze-500 bg-bronze-200/20 p-6 mb-10" aria-labelledby="issued-package-title">
              <p id="issued-package-title" className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 font-semibold mb-2">
                Private fabrication package
              </p>
              <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
                <div>
                  <p className="font-title text-xl text-wood-900 mb-2">{issued.publicCode}</p>
                  <p className="font-sans text-sm text-wood-600 mb-2">{titleFor(issued.manifest.artworkId)} · {issued.manifest.artworkId} · edition {issued.manifest.editionNumber}</p>
                  <p className="font-title text-2xl md:text-3xl text-wood-900 tracking-[0.15em] break-all mb-3">
                    {issued.ownershipCode}
                  </p>
                  <a className="font-sans text-sm text-bronze-700 underline underline-offset-4 break-all" href={issued.publicUrl} target="_blank" rel="noreferrer">
                    {issued.publicUrl}
                  </a>
                  <dl className="mt-4 grid sm:grid-cols-2 gap-x-5 gap-y-2 font-sans text-xs text-wood-600">
                    <div><dt className="font-semibold">Front SHA-256</dt><dd className="break-all">{issued.frontSha256}</dd></div>
                    <div><dt className="font-semibold">Underside SHA-256</dt><dd className="break-all">{issued.undersideSha256}</dd></div>
                  </dl>
                </div>
                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-600 border border-wood-300 px-3 py-2">
                  Backup {issued.backupStatus || 'pending'}
                </span>
              </div>
              {issueSuccess && <p className="font-sans text-sm text-green-800 mt-5" role="status">{issueSuccess}</p>}
              {issued.warning && <p className="font-sans text-sm text-amber-800 mt-2">{issued.warning}</p>}
              <div className="flex flex-wrap gap-3 mt-5">
                {projectPlateDownloads(issued).map((download) => (
                  <button key={download.filename} type="button" className={buttonClass} onClick={() => downloadText(download.filename, download.mimeType, download.content)}>
                    Download {download.filename.includes('front') ? 'front SVG' : download.filename.includes('underside') ? 'underside SVG' : 'private manifest'}
                  </button>
                ))}
                <button type="button" onClick={dismissSensitiveState} className={quietButtonClass}>Dismiss and clear private package</button>
              </div>
            </section>
          )}

          <section className="border border-wood-200 bg-white p-5 mb-12" aria-labelledby="issue-title">
            <h2 id="issue-title" className="font-title text-xl text-wood-900 mb-5">Issue a plate identity</h2>
            <div className="grid sm:grid-cols-[1fr_16rem] gap-4 items-end">
              <div>
                <label className={labelClass} htmlFor="piece-select">Artwork</label>
                <select id="piece-select" value={pieceId} disabled={issuing || structureSaving || Boolean(sensitive.issuanceKey)} onChange={(event) => { setPieceId(event.target.value); setEditionNumber(''); setIssueEditionKind(''); setIssueEditionSize(''); setUniqueConfirmed(false); setIssueError(''); }} className={inputClass}>
                  <option value="">Choose an artwork</option>
                  {sortedPieces.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.title} · {artwork.id}{artwork.draft ? ' · draft' : ''}</option>)}
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
                            <input type="radio" name="issue-edition-kind" value={kind} checked={issueEditionKind === kind} disabled={structureSaving} onChange={() => { setIssueEditionKind(kind); setIssueEditionSize(''); setUniqueConfirmed(false); }} />
                            <span>{kind === 'unique' ? 'Unique' : 'Numbered'}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {issueEditionKind === 'unique' && (
                      <label className="flex items-start gap-3 font-sans text-sm text-wood-700 mb-3">
                        <input type="checkbox" checked={uniqueConfirmed} disabled={structureSaving} onChange={(event) => setUniqueConfirmed(event.target.checked)} className="mt-1" />
                        <span>This is a unique, non-numbered work</span>
                      </label>
                    )}
                    {issueEditionKind === 'numbered' && (
                      <div className="mb-3">
                        <label className={labelClass} htmlFor="edition-size-input">Exact edition size</label>
                        <input id="edition-size-input" type="number" min={1} max={9999} step={1} value={issueEditionSize} disabled={structureSaving} onChange={(event) => setIssueEditionSize(event.target.value)} className={inputClass} />
                      </div>
                    )}
                    <button type="button" className={quietButtonClass} disabled={structureSaving} onClick={() => void saveEditionStructure()}>{structureSaving ? 'Saving…' : 'Save edition structure'}</button>
                  </div>
                ) : selectedEditionKind === 'unique' ? (
                  <label className="flex items-start gap-3 font-sans text-sm text-wood-700 pb-2">
                    <input type="checkbox" checked={uniqueConfirmed} disabled={issuing || Boolean(sensitive.issuanceKey)} onChange={(event) => setUniqueConfirmed(event.target.checked)} className="mt-1" />
                    <span>This is a unique, non-numbered work</span>
                  </label>
                ) : selectedEditionKind === 'numbered' ? (
                  <div>
                    <label className={labelClass} htmlFor="edition-input">Exact edition (1 to {selectedArtwork?.editionSize})</label>
                    <input id="edition-input" type="number" min={1} max={selectedArtwork?.editionSize || undefined} step={1} value={editionNumber} disabled={issuing || Boolean(sensitive.issuanceKey)} onChange={(event) => setEditionNumber(event.target.value)} className={inputClass} />
                  </div>
                ) : selectedArtwork?.editionKind === 'conflict' ? (
                  <p className="font-sans text-sm text-red-700 pb-2">Conflicting edition metadata must be resolved before issuing.</p>
                ) : (
                  <p className="font-sans text-sm text-wood-500 pb-2">Choose an artwork to confirm its edition identity.</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-4 flex-wrap">
              <button type="button" onClick={issuePlate} disabled={issuing || structureSaving || Boolean(issued) || selectedArtwork?.editionKind === 'unspecified' || selectedArtwork?.editionKind === 'conflict'} className={buttonClass}>{issuing ? 'Issuing plate…' : 'Issue fabrication package'}</button>
              {sensitive.issuanceKey && !issued && <span className="font-sans text-xs text-wood-500">This retry will reuse the same issuance attempt.</span>}
              {sensitive.issuanceKey && !issued && !issuing && <button type="button" className={quietButtonClass} onClick={() => { dismissSensitiveState(); setIssueError(''); }}>Abandon attempt and start new</button>}
            </div>
            {issueError && <p className="font-sans text-sm text-red-700 mt-3" role="alert">{issueError}</p>}
          </section>

          <section className="mb-14" aria-labelledby="registry-title">
            <div className="flex flex-wrap justify-between gap-4 items-end mb-4">
              <div>
                <h2 id="registry-title" className="font-title text-xl text-wood-900">Plate registry</h2>
                <p className="font-serif text-sm text-wood-600 mt-1">Lifecycle and backup metadata only. Ownership Codes are private.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={quietButtonClass} onClick={() => void downloadLedger()} disabled={!registryUnlocked} title="The offline master record. Online is a mirror you can rebuild from this file.">Download offline ledger</button>
                <button type="button" className={quietButtonClass} onClick={() => void syncDrive()} disabled={!registryUnlocked} title="Send the offline master ledger to your Google Drive.">Sync to Google Drive</button>
                <button type="button" className={quietButtonClass} onClick={() => void loadPieces()} disabled={listLoading}>Refresh registry</button>
              </div>
            </div>
            {driveStatus && <p className="font-sans text-sm text-wood-600 mb-4" role="status">{driveStatus}</p>}
            <form className="border border-wood-200 bg-white p-4 mb-4" onSubmit={unlockRegistry}>
              <label className={labelClass} htmlFor="registry-secret">Private registry unlock</label>
              <div className="flex flex-wrap gap-3">
                <input ref={unlockInputRef} id="registry-secret" type="password" autoComplete="off" className={`${inputClass} flex-1`} placeholder="Required for private registry operations" />
                <button type="submit" className={buttonClass} disabled={unlockBusy}>{unlockBusy ? 'Unlocking…' : registryUnlocked ? 'Unlock again' : 'Unlock registry'}</button>
                {registryUnlocked && <button type="button" className={quietButtonClass} disabled={unlockBusy} onClick={() => void lockRegistry()}>Lock registry</button>}
              </div>
              <p className="font-sans text-xs text-wood-500 mt-2">{registryUnlocked ? 'Private registry unlocked for this signed-in administrator.' : 'The secret is submitted once, cleared immediately, and never attached to later requests.'}</p>
              {unlockError && <p className="font-sans text-sm text-red-700 mt-2" role="alert">{unlockError}</p>}
              {sensitive.revealedOwnershipCode && <button type="button" className={`${quietButtonClass} mt-3`} onClick={dismissSensitiveState}>Clear private state</button>}
            </form>
            {listError ? (
              <div className="border border-red-300 bg-white p-6"><p className="font-sans text-sm text-red-700" role="alert">{listError}</p></div>
            ) : listLoading && rows.length === 0 ? (
              <div className="border border-wood-200 bg-white p-6"><p className="font-sans text-sm text-wood-500">Loading registry…</p></div>
            ) : rows.length === 0 ? (
              <div className="border border-wood-200 bg-white p-8 text-center"><p className="font-serif text-wood-600">No plate identities have been issued.</p></div>
            ) : (
              <div className="border border-wood-200 bg-white divide-y divide-wood-200">
                {rows.map((row) => (
                  <article key={row.id} className="p-5">
                    <div className="grid md:grid-cols-[1fr_auto] gap-5">
                      <div>
                        <h3 className="font-serif text-lg text-wood-900">{titleFor(row.pieceId)} <span className="font-sans text-sm text-wood-500">{row.pieceId} · edition {row.editionNumber}</span></h3>
                        <p className="font-sans text-sm text-wood-700 mt-1">{row.publicCode || 'Legacy identity'}</p>
                        <dl className="grid sm:grid-cols-3 gap-3 mt-4 font-sans text-xs text-wood-600">
                          <div><dt className="font-semibold">Plate</dt><dd>{row.plateStatus}</dd></div>
                          <div><dt className="font-semibold">Online backup</dt><dd>{row.backupStatus || 'not available'}{row.backupAt ? ` · ${formatDate(row.backupAt)}` : ''}</dd></div>
                          <div><dt className="font-semibold">Steward</dt><dd>{row.keeperBound ? 'Claimed' : row.claimedAt ? 'Previously claimed' : 'Not claimed'}</dd></div>
                          <div><dt className="font-semibold">Generated</dt><dd>{formatDate(row.plateGeneratedAt)}</dd></div>
                          <div><dt className="font-semibold">Activated</dt><dd>{formatDate(row.plateActivatedAt)}</dd></div>
                          <div><dt className="font-semibold">Backup reference</dt><dd className="break-all">{row.backupReference || 'Not yet'}</dd></div>
                        </dl>
                      </div>
                      {row.publicCode && (
                        <div className="flex md:flex-col flex-wrap gap-2 md:items-stretch">
                          {row.backupStatus !== 'verified' && <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'backup')}>{rowBusy === `${row.id}:backup` ? 'Retrying…' : 'Retry backup'}</button>}
                          {row.backupStatus === 'verified' && <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'verify-recovery')}>{rowBusy === `${row.id}:verify-recovery` ? 'Verifying R2…' : 'Verify R2 recovery'}</button>}
                          <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'reveal')}>{rowBusy === `${row.id}:reveal` ? 'Revealing…' : 'Reveal Ownership Code'}</button>
                          <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'package')}>{rowBusy === `${row.id}:package` ? 'Recovering…' : 'Recover full fabrication package'}</button>
                          {row.plateStatus === 'generated' && row.backupStatus === 'verified' && <button type="button" className={buttonClass} disabled={Boolean(rowBusy)} onClick={() => openActivation(row)}>Physical checks</button>}
                        </div>
                      )}
                    </div>
                    {rowSuccess[row.id] && <p className="font-sans text-sm text-green-800 mt-3" role="status">{rowSuccess[row.id]}</p>}
                    {rowError[row.id] && <p className="font-sans text-sm text-red-700 mt-3" role="alert">{rowError[row.id]}</p>}
                    {sensitive.revealedOwnershipCode && sensitive.revealedForPieceId === row.id && (
                      <div className="border border-bronze-400 bg-paper-50 p-4 mt-4">
                        <p className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 mb-2">Audited Ownership Code</p>
                        <p className="font-title text-xl tracking-[0.14em] break-all text-wood-900">{sensitive.revealedOwnershipCode}</p>
                        {sensitive.revealedUndersideSvg && <button type="button" className={`${quietButtonClass} mt-3`} onClick={() => downloadText(`${row.publicCode}-underside-private.svg`, 'image/svg+xml', sensitive.revealedUndersideSvg || '')}>Download regenerated underside</button>}
                        <button type="button" className={`${quietButtonClass} mt-3 ml-2`} onClick={() => setSensitive((current) => ({ ...current, revealedForPieceId: null, revealedOwnershipCode: null, revealedUndersideSvg: null }))}>Hide revealed code</button>
                      </div>
                    )}
                    {activationPieceId === row.id && (
                      <div className="border-t border-wood-200 mt-5 pt-5">
                        <h4 className="font-title text-lg text-wood-900 mb-2">Physical activation checks</h4>
                        <p className="font-serif text-sm text-wood-600 mb-4">Activation permanently locks this plate identity. Compare the actual metal plate, not a screen preview.</p>
                        <p className="font-sans text-sm text-wood-700 mb-4">Paste both SHA-256 values from the downloaded private manifest. They begin empty so this check cannot be confirmed by copied screen state.</p>
                        <div className="grid gap-3">
                          {([
                            ['realMetalQrScanned', 'Scanned the engraved metal QR on a phone'],
                            ['artworkEditionPublicCodeMatch', 'Artwork, edition, and public code all match'],
                            ['undersideOwnershipCodeMatch', 'Underside Ownership Code matches the private manifest'],
                            ['attachmentAndAbrasionInspected', 'Attachment and abrasion resistance inspected'],
                          ] as const).map(([field, label]) => (
                            <label key={field} className="flex items-start gap-3 font-sans text-sm text-wood-700">
                              <input type="checkbox" checked={activationChecks[field]} onChange={(event) => setActivationChecks((current) => ({ ...current, [field]: event.target.checked }))} className="mt-1" />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 mt-4">
                          <div><label className={labelClass} htmlFor={`front-hash-${row.id}`}>Front SHA-256</label><input id={`front-hash-${row.id}`} value={activationChecks.frontSha256} onChange={(event) => setActivationChecks((current) => ({ ...current, frontSha256: event.target.value.trim() }))} className={inputClass} /></div>
                          <div><label className={labelClass} htmlFor={`under-hash-${row.id}`}>Underside SHA-256</label><input id={`under-hash-${row.id}`} value={activationChecks.undersideSha256} onChange={(event) => setActivationChecks((current) => ({ ...current, undersideSha256: event.target.value.trim() }))} className={inputClass} /></div>
                        </div>
                        <div className="flex flex-wrap gap-3 mt-4">
                          <button type="button" className={buttonClass} disabled={Boolean(rowBusy)} onClick={() => void activatePlate(row)}>{rowBusy === `${row.id}:activate` ? 'Activating…' : 'Activate and lock identity'}</button>
                          <button type="button" className={quietButtonClass} onClick={() => { setActivationPieceId(null); setActivationChecks(emptyChecklist); }}>Cancel checks</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
    </AdminPage>
  );
};

export default AdminPieces;
