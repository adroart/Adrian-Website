/**
 * Guided Artwork Plate wizard — fabrication only.
 *
 * A linear, one-piece-at-a-time walkthrough of the OPTIONAL physical plate
 * lifecycle for an artwork that is already a registered identity. It drives
 * the SAME admin endpoints as the flat registry desk (components/AdminPieces.tsx)
 * and adds no new server behavior — it only sequences the existing operations
 * into the runbook order and refuses to let a step be skipped before its gate
 * is met:
 *
 *   Fabrication files → Encrypted backup → Prove recovery → Activate
 *
 * Registering a new artwork identity happens at /admin/register; this wizard
 * only picks up an identity that already exists.
 *
 * Sensitive values (the Ownership Code and the SVGs) exist only in this
 * component's immediate React state. They are never written to browser storage
 * and are cleared when the wizard is finished or dismissed. The persistent
 * admin shell supplies the authenticated boundary; the private registry unlock
 * is the in-wizard second factor.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';
import {
  activationChecklistComplete,
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
import {
  downloadText,
  emptyChecklist,
  errorMessage,
  jsonRequest,
  titleFor,
  formatDate,
  type PieceRow,
} from '../utils/adminPieces';

const inputClass =
  'w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const labelClass =
  'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
const buttonClass =
  'min-h-11 font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';
const quietButtonClass =
  'min-h-11 font-label text-[11px] uppercase tracking-[0.14em] text-wood-600 border border-wood-300 px-4 py-2 hover:border-wood-500 hover:text-wood-900 active:translate-y-px disabled:opacity-50 disabled:translate-y-0 transition-colors';

function snapshotOf(row: PieceRow): PlateLifecycleSnapshot {
  return {
    plateStatus: row.plateStatus,
    backupStatus: row.backupStatus,
    recoveryQualificationStatus: row.recoveryQualification?.status,
    registered: Boolean(row.publicCode),
  };
}

const AdminPlateWizard: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryKeeperPieceIds = searchParams.getAll('keeperPieceId');
  const linkedKeeperPieceId = queryKeeperPieceIds.length === 1 ? queryKeeperPieceIds[0] : '';
  const appliedDeepLinkRef = useRef('');
  // Access + data
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deepLinkNote, setDeepLinkNote] = useState('');

  // Wizard position
  const [started, setStarted] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [pieceId, setPieceId] = useState<string | null>(null); // keeper_pieces.id of the piece in flight
  const [busy, setBusy] = useState('');
  const [stepError, setStepError] = useState('');
  const [stepNote, setStepNote] = useState('');

  const [pkg, setPkg] = useState<IssuedPlatePackage | null>(null);

  // Fabrication stage
  const [filesArchived, setFilesArchived] = useState(false);

  // Recovery stage. The encrypted copy stays only in memory until submitted.
  const [copiedBackupDocument, setCopiedBackupDocument] = useState('');
  const [copiedBackupFilename, setCopiedBackupFilename] = useState('');

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

  useEffect(() => {
    void jsonRequest('/api/admin/registry-unlock')
      .then((data) => setRegistryUnlocked(data.unlocked === true))
      .catch(() => setRegistryUnlocked(false));
    void loadAll();
  }, [loadAll]);

  const resetSensitive = useCallback(() => {
    setPkg(null);
    setChecks(emptyChecklist);
    setFilesArchived(false);
    setCopiedBackupDocument('');
    setCopiedBackupFilename('');
  }, []);

  // Clear sensitive material if the wizard unmounts.
  useEffect(() => () => resetSensitive(), [resetSensitive]);

  const registryErrorMessage = (error: unknown, fallback: string) => {
    const message = errorMessage(error, fallback);
    if (message === 'registry_locked') {
      setRegistryUnlocked(false);
      return 'Private registry access expired. Unlock it again to continue.';
    }
    if (message === 'recovery_qualification_required') {
      return 'Activation is blocked because copied-file recovery proof is missing or stale. Return to the recovery step and verify a fresh archived copy.';
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

  const openPiece = (row: PieceRow) => {
    const target = plateWizardStageForPiece(snapshotOf(row));
    if (!target) return;
    resetSensitive();
    setPieceId(row.id);
    setStepError('');
    setStepNote('');
    setStageIndex(plateWizardStageIndex(target));
    setStarted(true);
  };

  useEffect(() => {
    if (!linkedKeeperPieceId || loading || appliedDeepLinkRef.current === linkedKeeperPieceId) return;
    appliedDeepLinkRef.current = linkedKeeperPieceId;
    const row = rows.find((candidate) => candidate.id === linkedKeeperPieceId);
    if (!row) {
      setDeepLinkNote('The linked piece was not found in the registry.');
      return;
    }
    if (!plateWizardStageForPiece(snapshotOf(row))) {
      navigate(`/admin/pieces?${new URLSearchParams({ keeperPieceId: row.id })}`, { replace: true });
      return;
    }
    openPiece(row);
  }, [linkedKeeperPieceId, loading, navigate, rows]);

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

  const refreshPiece = async (): Promise<PieceRow[]> => {
    const piecesData = await jsonRequest('/api/admin/pieces');
    const nextRows = piecesData.pieces as PieceRow[];
    setRows(nextRows);
    return nextRows;
  };

  const runRowAction = async (action: 'backup' | 'package' | 'prepare-plate' | 'verify-recovery') => {
    if (!piece) return;
    setBusy(action);
    setStepError('');
    setStepNote('');
    try {
      const data = await jsonRequest(
        `/api/admin/pieces/${encodeURIComponent(piece.id)}/${action}`,
        action === 'verify-recovery' ? { backupDocument: copiedBackupDocument } : {},
      );
      if (action === 'prepare-plate') {
        setPkg({ ...projectIssuedPlateResponse(data), backupStatus: data.backupStatus || undefined });
        await refreshPiece();
        setStepNote('Plate files generated. Download them below and archive them off-site.');
      } else if (action === 'package') {
        setPkg({ ...projectIssuedPlateResponse(data), backupStatus: piece.backupStatus || undefined });
        setStepNote('Fabrication package recovered. Re-download the files below.');
      } else if (action === 'verify-recovery') {
        await refreshPiece();
        setStepNote(`Copied-file recovery passed with key version ${data.keyVersion}. The persisted proof is current and both fabrication hashes match.`);
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

  const downloadEncryptedBackupCopy = async () => {
    if (!piece) return;
    setBusy('download-backup');
    setStepError('');
    try {
      const response = await fetch(`/api/admin/pieces/${encodeURIComponent(piece.id)}/backup`);
      const text = await response.text();
      if (!response.ok) {
        let error = `Encrypted copy download failed (${response.status})`;
        try { error = JSON.parse(text)?.error || error; } catch { /* response was not JSON */ }
        throw new Error(error);
      }
      downloadText(
        `${piece.publicCode || piece.pieceId}-encrypted-recovery.json`,
        'application/json',
        text,
      );
      setStepNote('Encrypted recovery copy downloaded. Archive it outside the website, then choose that downloaded file below to prove recovery.');
    } catch (error) {
      setStepError(registryErrorMessage(error, 'Could not download the encrypted recovery copy.'));
    } finally {
      setBusy('');
    }
  };

  const chooseCopiedBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setCopiedBackupDocument('');
    setCopiedBackupFilename('');
    setStepError('');
    if (!file) return;
    if (file.size < 1 || file.size > 64 * 1024) {
      setStepError('Choose the encrypted recovery JSON downloaded for this plate. The file must be 64 KB or smaller.');
      return;
    }
    try {
      setCopiedBackupDocument(await file.text());
      setCopiedBackupFilename(file.name);
    } catch {
      setStepError('The copied recovery file could not be read. Choose the downloaded JSON again.');
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
      const code = errorMessage(error, 'Could not activate this plate.');
      if (code === 'recovery_qualification_required' || code === 'activation_conflict') {
        try {
          const refreshedRows = await refreshPiece();
          const refreshedPiece = refreshedRows.find((row) => row.id === piece.id);
          if (
            code === 'recovery_qualification_required'
            || refreshedPiece?.recoveryQualification?.status !== 'current'
          ) {
            setCopiedBackupDocument('');
            setCopiedBackupFilename('');
            setStageIndex(plateWizardStageIndex('recovery'));
          }
        } catch {
          // Keep the original fail-closed activation error if refresh also fails.
        }
      }
      setStepError(registryErrorMessage(error, 'Could not activate this plate.'));
    } finally {
      setBusy('');
    }
  };

  // ── Gate: may the operator advance from the current stage? ─────────────────
  const canAdvance = (() => {
    switch (stage.key) {
      case 'fabricate':
        return filesArchived;
      case 'backup':
        return piece?.backupStatus === 'verified';
      case 'recovery':
        return piece?.recoveryQualification?.status === 'current';
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
          Fabrication only. This walks a registered artwork through its optional physical plate,
          in the exact runbook order, and will not let a step be skipped before its safeguard is met.
          It drives the same permanent registry as the{' '}
          <Link to="/admin/pieces" className="text-bronze-700 underline underline-offset-4">full plate desk</Link>.
        </p>

        {/* ACCESS GATE */}
        {!registryUnlocked ? (
          <section className="border border-wood-200 bg-paper-50 p-6" aria-labelledby="unlock-title">
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
              <h2 id="choose-title" className="font-title text-xl text-wood-900">Choose a registered artwork to prepare its plate</h2>
              <button type="button" className={quietButtonClass} onClick={() => void loadAll()} disabled={loading}>Refresh</button>
            </div>
            <p className="font-serif text-sm text-wood-600 mb-6 max-w-2xl">
              This wizard only fabricates, backs up, proves recovery for, and activates a plate for an
              artwork that already has a registered identity. To register a new artwork identity,
              use <Link to="/admin/register" className="text-bronze-700 underline underline-offset-4">Register an artwork</Link>.
            </p>
            {deepLinkNote && <p className="font-sans text-sm text-wood-500 mb-4" role="status">{deepLinkNote}</p>}
            {loadError ? (
              <div className="border border-red-300 bg-paper-50 p-6"><p className="font-sans text-sm text-red-700" role="alert">{loadError}</p></div>
            ) : loading && rows.length === 0 ? (
              <div className="border border-wood-200 bg-paper-50 p-6"><p className="font-sans text-sm text-wood-500">Loading registry…</p></div>
            ) : resumable.length === 0 ? (
              <div className="border border-wood-200 bg-paper-50 p-8 text-center">
                <p className="font-serif text-wood-600">
                  No registered artworks are waiting on a plate action.{' '}
                  <Link to="/admin/register" className="text-bronze-700 underline underline-offset-4">Register an artwork</Link> first.
                </p>
              </div>
            ) : (
              <div className="border border-wood-200 bg-paper-50 divide-y divide-wood-200">
                {resumable.map((row) => {
                  const target = plateWizardStageForPiece(snapshotOf(row));
                  const targetStage = target ? PLATE_WIZARD_STAGES[plateWizardStageIndex(target)] : null;
                  return (
                    <button type="button" key={row.id} onClick={() => openPiece(row)} className="w-full text-left p-5 hover:bg-paper-100/40 transition-colors">
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
              <button type="button" className={buttonClass} onClick={goToChoose}>Choose another artwork</button>
              <button type="button" className={quietButtonClass} onClick={() => void downloadLedger()}>Download offline ledger</button>
              <button type="button" className={quietButtonClass} onClick={() => void syncDrive()}>Sync to Google Drive</button>
              {piece && <Link to={`/admin/artworks/${encodeURIComponent(piece.pieceId)}?${new URLSearchParams({ instance: piece.id })}`} className={quietButtonClass}>Open artwork</Link>}
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

            <div className="border border-wood-200 bg-paper-50 p-5">
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
                  ) : piece?.plateStatus === 'legacy' ? (
                    <>
                      <p className="font-serif text-sm text-wood-600 mb-4">This registered identity has no plate yet. Generate its front and underside SVGs, the private manifest, and its encrypted backup now.</p>
                      <button type="button" className={buttonClass} disabled={Boolean(busy)} onClick={() => void runRowAction('prepare-plate')}>{busy === 'prepare-plate' ? 'Generating…' : 'Generate plate files'}</button>
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
                    Prove an independently saved copy can rebuild this exact plate before any metal is cut. Download the encrypted recovery file, archive it outside this website, then choose that copied file below. The server decrypts it in memory, re-derives both SVGs, checks every hash, and persists proof tied to this exact software build and backup digest. It returns no Ownership Code or fabrication file.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" className={quietButtonClass} disabled={Boolean(busy)} onClick={() => void downloadEncryptedBackupCopy()}>{busy === 'download-backup' ? 'Downloading…' : 'Download encrypted recovery copy'}</button>
                    <label className={`${quietButtonClass} inline-flex items-center cursor-pointer`}>
                      Choose archived copy
                      <input type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void chooseCopiedBackup(event)} disabled={Boolean(busy)} />
                    </label>
                  </div>
                  {copiedBackupFilename && <p className="font-sans text-sm text-wood-600 mt-3">Chosen copy: {copiedBackupFilename}</p>}
                  <button type="button" className={`${buttonClass} mt-4`} disabled={Boolean(busy) || !copiedBackupDocument || piece?.recoveryQualification?.status === 'current'} onClick={() => void runRowAction('verify-recovery')}>{busy === 'verify-recovery' ? 'Proving…' : 'Verify copied recovery file'}</button>
                  {piece?.recoveryQualification?.status === 'current' && <p className="font-sans text-sm text-green-800 mt-3" role="status">Persisted recovery proof is current. You can continue.</p>}
                  {piece?.recoveryQualification?.status === 'stale' && <p className="font-sans text-sm text-red-700 mt-3" role="alert">Recovery proof is stale because the backup or one of its required versions changed. Download and verify a fresh copied file.</p>}
                  {(!piece?.recoveryQualification || piece.recoveryQualification.status === 'missing') && <p className="font-sans text-sm text-wood-600 mt-3">No qualifying copied-file recovery proof exists yet. Activation remains blocked.</p>}
                </div>
              )}

              {/* ACTIVATE */}
              {stage.key === 'activate' && (
                <div>
                    <p className="font-serif text-sm text-wood-600 mb-4">{piece?.plateStatus === 'active' ? 'This active identity was repaired. Re-check the actual engraved metal before confirming its renewed recovery proof and identity.' : 'Activation permanently locks the two codes. Compare the actual engraved metal, not a screen preview.'} Paste both SHA-256 values from the private manifest; they start empty so copied screen state cannot confirm this check.</p>
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
                    <button type="button" className={`${buttonClass} mt-4`} disabled={Boolean(busy)} onClick={() => void runActivate()}>{busy === 'activate' ? 'Activating…' : piece?.plateStatus === 'active' ? 'Confirm repaired identity' : 'Activate and lock identity'}</button>
                </div>
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
