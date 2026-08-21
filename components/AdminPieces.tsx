/**
 * Artwork Registry desk: the ledger for every registered artwork identity —
 * plate status, encrypted backup, recovery proof, and activation.
 *
 * Registering a new artwork identity happens at /admin/register; this desk
 * only tracks identities that already exist. It still holds the registry
 * unlock (needed for reveal and recovery actions) and every per-piece
 * lifecycle action: retry backup, prove recovery, reveal the Ownership Code,
 * recover the fabrication package, run physical activation checks, download
 * the offline ledger, and sync to Google Drive.
 *
 * Sensitive values exist only in this component's immediate React state. They
 * are never written to browser storage and are cleared on dismissal or plate
 * activation. The persistent admin shell supplies the authenticated boundary.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';
import {
  activationChecklistComplete,
  projectPlateDownloads,
  projectIssuedPlateResponse,
  type ActivationChecklist,
  type SensitivePlateState,
} from '../utils/adminArtworkRegistry';
import {
  downloadText,
  emptyChecklist,
  errorMessage,
  jsonRequest,
  titleFor,
  formatDate,
  recordLabel,
  recordHoverText,
  requestRecordRebuild,
  summarizeRecordRebuild,
  summarizeRecordRebuildAll,
  type PieceRow,
} from '../utils/adminPieces';

type RegistrySensitiveState = Omit<SensitivePlateState, 'stepUpSecret'>;

const inputClass =
  'w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const labelClass =
  'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
const buttonClass =
  'min-h-11 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';
const quietButtonClass =
  'min-h-11 font-label text-[11px] uppercase tracking-[0.14em] text-wood-600 border border-wood-300 px-4 py-2 hover:border-wood-500 hover:text-wood-900 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';

const emptySensitiveState: RegistrySensitiveState = {
  issuanceKey: null,
  package: null,
  revealedForPieceId: null,
  revealedOwnershipCode: null,
  revealedUndersideSvg: null,
};

export function registryKeeperPieceSelection(searchParams: URLSearchParams): string | null {
  const values = searchParams.getAll('keeperPieceId');
  if (values.length !== 1) return null;
  const value = values[0];
  if (!value || value !== value.trim() || value.length > 128
    || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}


const AdminPieces: React.FC = () => {
  const [searchParams] = useSearchParams();
  const linkedKeeperPieceId = registryKeeperPieceSelection(searchParams);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const appliedKeeperPieceRef = useRef<string | null>(null);
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [sensitive, setSensitive] = useState<RegistrySensitiveState>(emptySensitiveState);
  const [packageSuccess, setPackageSuccess] = useState('');
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
    if (message === 'recovery_qualification_required') {
      return 'Activation is blocked because copied-file recovery proof is missing or stale. Use the guided wizard to verify a fresh archived copy.';
    }
    return message;
  };

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

  useEffect(() => {
    void loadPieces();
    void jsonRequest('/api/admin/registry-unlock')
      .then((data) => setRegistryUnlocked(data.unlocked === true))
      .catch(() => setRegistryUnlocked(false));
  }, [loadPieces]);

  useEffect(() => {
    if (!linkedKeeperPieceId || listLoading
      || appliedKeeperPieceRef.current === linkedKeeperPieceId) return;
    const selectedRow = rowRefs.current.get(linkedKeeperPieceId);
    if (!selectedRow) return;
    appliedKeeperPieceRef.current = linkedKeeperPieceId;
    window.requestAnimationFrame(() => {
      selectedRow.scrollIntoView({ block: 'center' });
      selectedRow.focus({ preventScroll: true });
    });
  }, [linkedKeeperPieceId, listLoading, rows]);

  const dismissSensitiveState = () => {
    setSensitive(emptySensitiveState);
    setPackageSuccess('');
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

  const rebuildRecord = async (row: PieceRow) => {
    if (!row.publicCode) return;
    if (!registryUnlocked) {
      setRowError((current) => ({ ...current, [row.id]: 'Unlock the private registry first.' }));
      return;
    }
    setRowBusy(`${row.id}:record-rebuild`);
    setRowError((current) => ({ ...current, [row.id]: '' }));
    setRowSuccess((current) => ({ ...current, [row.id]: '' }));
    try {
      const data = await requestRecordRebuild('/api/admin/records/rebuild', { publicCode: row.publicCode });
      const outcome = data.outcomes[0];
      if (!outcome || outcome.status === 'failed') {
        setRowError((current) => ({
          ...current,
          [row.id]: outcome ? summarizeRecordRebuild(outcome) : 'Record rebuild failed: no outcome reported.',
        }));
      } else {
        setRowSuccess((current) => ({ ...current, [row.id]: summarizeRecordRebuild(outcome) }));
      }
      await loadPieces();
    } catch (error) {
      const message = registryErrorMessage(error, 'Could not rebuild this record.');
      setRowError((current) => ({ ...current, [row.id]: message }));
    } finally {
      setRowBusy(null);
    }
  };

  const [recordsBusy, setRecordsBusy] = useState(false);
  const [recordsStatus, setRecordsStatus] = useState('');
  const [recordsFailed, setRecordsFailed] = useState(false);

  const rebuildAllRecords = async () => {
    if (!registryUnlocked) {
      setListError('Unlock the private registry first.');
      return;
    }
    if (!window.confirm(
      'Rebuild the permanent record for every registered piece? This writes two files per '
      + 'piece and runs as one request; a large registry will take a while. Records that '
      + 'already match are left unchanged.',
    )) return;
    setRecordsBusy(true);
    setRecordsStatus('');
    setRecordsFailed(false);
    try {
      const data = await requestRecordRebuild('/api/admin/records/rebuild');
      setRecordsStatus(summarizeRecordRebuildAll(data));
      setRecordsFailed(data.failed > 0);
      await loadPieces();
    } catch (error) {
      setRecordsStatus(registryErrorMessage(error, 'Could not rebuild the registry’s records.'));
      setRecordsFailed(true);
    } finally {
      setRecordsBusy(false);
    }
  };

  const runRowAction = async (
    row: PieceRow,
    action: 'backup' | 'reveal' | 'package' | 'prepare-plate',
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
      if (action === 'prepare-plate') {
        setRowSuccess((current) => ({ ...current, [row.id]: 'Plate files generated.' }));
        await loadPieces();
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
        setPackageSuccess('Full fabrication package recovered after audit.');
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

  const recovered = sensitive.package;

  return (
    <AdminPage width="medium">
        <div className="max-w-5xl mx-auto">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
            Artwork Registry
          </p>
          <h1 className="font-title text-3xl md:text-4xl text-wood-900 mb-3">Plate registry</h1>
          <p className="font-serif text-wood-600 leading-relaxed mb-10 max-w-2xl">
            The desk and ledger for every registered artwork identity: plate status, encrypted backup,
            recovery proof, and activation. Registering a new artwork identity happens at{' '}
            <Link to="/admin/register" className="text-bronze-700 underline underline-offset-4">Register an artwork</Link>.
          </p>

          {recovered && (
            <section className="border border-bronze-500 bg-bronze-200/20 p-6 mb-10" aria-labelledby="recovered-package-title">
              <p id="recovered-package-title" className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 font-semibold mb-2">
                Private fabrication package
              </p>
              <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start">
                <div>
                  <p className="font-title text-xl text-wood-900 mb-2">{recovered.publicCode}</p>
                  <p className="font-sans text-sm text-wood-600 mb-2">{titleFor(recovered.manifest.artworkId)} · {recovered.manifest.artworkId} · edition {recovered.manifest.editionNumber}</p>
                  <p className="font-title text-2xl md:text-3xl text-wood-900 tracking-[0.15em] break-all mb-3">
                    {recovered.ownershipCode}
                  </p>
                  <a className="font-sans text-sm text-bronze-700 underline underline-offset-4 break-all" href={recovered.publicUrl} target="_blank" rel="noreferrer">
                    {recovered.publicUrl}
                  </a>
                  <dl className="mt-4 grid sm:grid-cols-2 gap-x-5 gap-y-2 font-sans text-xs text-wood-600">
                    <div><dt className="font-semibold">Front SHA-256</dt><dd className="break-all">{recovered.frontSha256}</dd></div>
                    <div><dt className="font-semibold">Underside SHA-256</dt><dd className="break-all">{recovered.undersideSha256}</dd></div>
                  </dl>
                </div>
                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-600 border border-wood-300 px-3 py-2">
                  Backup {recovered.backupStatus || 'pending'}
                </span>
              </div>
              {packageSuccess && <p className="font-sans text-sm text-green-800 mt-5" role="status">{packageSuccess}</p>}
              {recovered.warning && <p className="font-sans text-sm text-amber-800 mt-2">{recovered.warning}</p>}
              <div className="flex flex-wrap gap-3 mt-5">
                {projectPlateDownloads(recovered).map((download) => (
                  <button key={download.filename} type="button" className={buttonClass} onClick={() => downloadText(download.filename, download.mimeType, download.content)}>
                    Download {download.filename.includes('front') ? 'front SVG' : download.filename.includes('underside') ? 'underside SVG' : 'private manifest'}
                  </button>
                ))}
                <button type="button" onClick={dismissSensitiveState} className={quietButtonClass}>Dismiss and clear private package</button>
              </div>
            </section>
          )}

          <section className="mb-14" aria-labelledby="registry-title">
            <div className="flex flex-wrap justify-between gap-4 items-end mb-4">
              <div>
                <h2 id="registry-title" className="font-title text-xl text-wood-900">Plate registry</h2>
                <p className="font-serif text-sm text-wood-600 mt-1">Lifecycle and backup metadata only. Ownership Codes are private.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={quietButtonClass} onClick={() => void downloadLedger()} disabled={!registryUnlocked} title="The offline master record. Online is a mirror you can rebuild from this file.">Download offline ledger</button>
                <button type="button" className={quietButtonClass} onClick={() => void syncDrive()} disabled={!registryUnlocked} title="Send the offline master ledger to your Google Drive.">Sync to Google Drive</button>
                <button type="button" className={quietButtonClass} onClick={() => void rebuildAllRecords()} disabled={!registryUnlocked || recordsBusy} title="Regenerate the permanent record for every registered piece. A server-side loop, two storage writes per piece; a large registry takes a while.">{recordsBusy ? 'Rebuilding records…' : 'Rebuild all records'}</button>
                <button type="button" className={quietButtonClass} onClick={() => void loadPieces()} disabled={listLoading}>Refresh registry</button>
              </div>
            </div>
            {driveStatus && <p className="font-sans text-sm text-wood-600 mb-4" role="status">{driveStatus}</p>}
            {recordsStatus && (
              <p className={`font-sans text-sm mb-4 ${recordsFailed ? 'text-red-700' : 'text-wood-600'}`} role={recordsFailed ? 'alert' : 'status'}>
                {recordsStatus}
              </p>
            )}
            <form className="border border-wood-200 bg-paper-50 p-4 mb-4" onSubmit={unlockRegistry}>
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
              <div className="border border-red-300 bg-paper-50 p-6"><p className="font-sans text-sm text-red-700" role="alert">{listError}</p></div>
            ) : listLoading && rows.length === 0 ? (
              <div className="border border-wood-200 bg-paper-50 p-6"><p className="font-sans text-sm text-wood-500">Loading registry…</p></div>
            ) : rows.length === 0 ? (
              <div className="border border-wood-200 bg-paper-50 p-8 text-center">
                <p className="font-serif text-wood-600">
                  No plate identities have been issued.{' '}
                  <Link to="/admin/register" className="text-bronze-700 underline underline-offset-4">Register an artwork</Link> to begin.
                </p>
              </div>
            ) : (
              <div className="border border-wood-200 bg-paper-50 divide-y divide-wood-200">
                {rows.map((row) => (
                  <article
                    key={row.id}
                    ref={(node) => {
                      if (node) rowRefs.current.set(row.id, node);
                      else rowRefs.current.delete(row.id);
                    }}
                    tabIndex={linkedKeeperPieceId === row.id ? -1 : undefined}
                    aria-current={linkedKeeperPieceId === row.id ? 'true' : undefined}
                    className={`p-5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-bronze-500 ${linkedKeeperPieceId === row.id ? 'bg-bronze-200/20' : ''}`}
                  >
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
                          <div>
                            <dt className="font-semibold">Record</dt>
                            <dd title={recordHoverText(row.record)}>{recordLabel(row.record)}</dd>
                          </div>
                        </dl>
                      </div>
                      <div className="flex md:flex-col flex-wrap gap-2 md:items-stretch">
                        <Link className={quietButtonClass} to={`/admin/artworks/${encodeURIComponent(row.pieceId)}?${new URLSearchParams({ instance: row.id })}`}>Open artwork</Link>
                        {row.publicCode && (
                          <>
                            {row.plateStatus === 'legacy' && <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'prepare-plate')}>{rowBusy === `${row.id}:prepare-plate` ? 'Generating…' : 'Generate plate files'}</button>}
                            {row.backupStatus !== 'verified' && <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'backup')}>{rowBusy === `${row.id}:backup` ? 'Retrying…' : 'Retry backup'}</button>}
                            {row.backupStatus === 'verified' && row.recoveryQualification?.status !== 'current' && <Link className={quietButtonClass} to={`/admin/pieces/wizard?${new URLSearchParams({ keeperPieceId: row.id })}`}>Prove copied-file recovery in wizard</Link>}
                            <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'reveal')}>{rowBusy === `${row.id}:reveal` ? 'Revealing…' : 'Reveal Ownership Code'}</button>
                            <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'package')}>{rowBusy === `${row.id}:package` ? 'Recovering…' : 'Recover full fabrication package'}</button>
                            <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void rebuildRecord(row)} title={recordHoverText(row.record)}>{rowBusy === `${row.id}:record-rebuild` ? 'Rebuilding…' : 'Rebuild record'}</button>
                            {row.record && <a className={quietButtonClass} href={`/api/records/${encodeURIComponent(row.publicCode)}`} target="_blank" rel="noreferrer">View record</a>}
                            {row.plateStatus === 'generated' && row.backupStatus === 'verified' && row.recoveryQualification?.status === 'current' && <button type="button" className={buttonClass} disabled={Boolean(rowBusy)} onClick={() => openActivation(row)}>Physical checks</button>}
                          </>
                        )}
                      </div>
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
