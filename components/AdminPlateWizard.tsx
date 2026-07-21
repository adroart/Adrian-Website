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
 *   Prove recovery → Activate → Assign → Ship
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

interface AvailablePlate {
  id: string;
  pieceId: string;
  editionNumber: number;
  publicCode: string;
}

interface OrderItem {
  id: number;
  orderReference: string;
  buyerEmail: string;
  productId: string;
  description: string | null;
}

interface Fulfillment {
  id: string;
  keeperPieceId: string;
  publicCode: string;
  shippedAt: string | null;
}

interface FulfillmentDesk {
  availablePlates: AvailablePlate[];
  availableOrderItems: OrderItem[];
  fulfillments: Fulfillment[];
}

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

function snapshotOf(row: PieceRow, desk: FulfillmentDesk): PlateLifecycleSnapshot {
  const fulfillment = desk.fulfillments.find((item) => item.keeperPieceId === row.id);
  return {
    plateStatus: row.plateStatus,
    backupStatus: row.backupStatus,
    hasFulfillment: Boolean(fulfillment),
    shipped: Boolean(fulfillment?.shippedAt),
  };
}

const AdminPlateWizard: React.FC = () => {
  // Access + data
  const [registryUnlocked, setRegistryUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [desk, setDesk] = useState<FulfillmentDesk>({
    availablePlates: [], availableOrderItems: [], fulfillments: [],
  });
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
  const [issuanceKey, setIssuanceKey] = useState<string | null>(null);
  const [pkg, setPkg] = useState<IssuedPlatePackage | null>(null);

  // Fabrication stage
  const [filesArchived, setFilesArchived] = useState(false);

  // Recovery stage
  const [recoveryProven, setRecoveryProven] = useState(false);
  const [recoveryStagingAck, setRecoveryStagingAck] = useState(false);

  // Activate stage
  const [checks, setChecks] = useState<ActivationChecklist>(emptyChecklist);

  // Assign stage
  const [assignSource, setAssignSource] = useState<'order' | 'manual'>('order');
  const [assignOrderItemId, setAssignOrderItemId] = useState('');
  const [assignManualRef, setAssignManualRef] = useState('');

  // Ship stage
  const [shipConfirmed, setShipConfirmed] = useState(false);
  const [finished, setFinished] = useState(false);

  const stage = PLATE_WIZARD_STAGES[stageIndex];
  const piece = useMemo(
    () => (pieceId ? rows.find((row) => row.id === pieceId) || null : null),
    [pieceId, rows],
  );
  const fulfillment = useMemo(
    () => (pieceId ? desk.fulfillments.find((item) => item.keeperPieceId === pieceId) || null : null),
    [pieceId, desk.fulfillments],
  );

  const sortedArtworks = useMemo(
    () => [...FULL_ARCHIVE].sort((a, b) => a.title.localeCompare(b.title)),
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [piecesData, deskData] = await Promise.all([
        jsonRequest('/api/admin/pieces'),
        jsonRequest('/api/admin/piece-fulfillments'),
      ]);
      setRows(piecesData.pieces as PieceRow[]);
      setDesk({
        availablePlates: deskData.availablePlates || [],
        availableOrderItems: deskData.availableOrderItems || [],
        fulfillments: deskData.fulfillments || [],
      });
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
    setIssuanceKey(null);
    setChecks(emptyChecklist);
    setFilesArchived(false);
    setRecoveryProven(false);
    setRecoveryStagingAck(false);
    setAssignSource('order');
    setAssignOrderItemId('');
    setAssignManualRef('');
    setShipConfirmed(false);
  }, []);

  // Clear sensitive material if the wizard unmounts.
  useEffect(() => () => resetSensitive(), [resetSensitive]);

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
    setStepError('');
    setStepNote('');
    setStageIndex(plateWizardStageIndex('issue'));
    setStarted(true);
  };

  const resumePiece = (row: PieceRow) => {
    const target = plateWizardStageForPiece(snapshotOf(row, desk));
    if (!target) return;
    resetSensitive();
    setPieceId(row.id);
    setStepError('');
    setStepNote('The piece was already in the registry. Re-download the fabrication files if you need them.');
    setStageIndex(plateWizardStageIndex(target));
    setStarted(true);
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

  // ── Stage actions ─────────────────────────────────────────────────────────
  const runIssue = async () => {
    if (!issueArtwork) {
      setStepError('Choose an artwork first.');
      return;
    }
    const parsedEdition = issueEdition.trim() ? Number(issueEdition) : 0;
    if (!Number.isSafeInteger(parsedEdition) || parsedEdition < 0) {
      setStepError('Edition must be a whole number of zero or greater.');
      return;
    }
    const key = beginIssuanceAttempt(issuanceKey);
    setIssuanceKey(key);
    setBusy('issue');
    setStepError('');
    try {
      const data = await jsonRequest('/api/admin/pieces', {
        pieceId: issueArtwork,
        editionNumber: parsedEdition,
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
    } catch (error) {
      setStepError(`${registryErrorMessage(error, 'Could not issue the plate.')} A retry reuses this same attempt and will not mint a second identity.`);
    } finally {
      setBusy('');
    }
  };

  const refreshPiece = async () => {
    const [piecesData, deskData] = await Promise.all([
      jsonRequest('/api/admin/pieces'),
      jsonRequest('/api/admin/piece-fulfillments'),
    ]);
    setRows(piecesData.pieces as PieceRow[]);
    setDesk({
      availablePlates: deskData.availablePlates || [],
      availableOrderItems: deskData.availableOrderItems || [],
      fulfillments: deskData.fulfillments || [],
    });
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
      setStepNote('Plate identity activated and permanently locked.');
    } catch (error) {
      setStepError(registryErrorMessage(error, 'Could not activate this plate.'));
    } finally {
      setBusy('');
    }
  };

  const runAssign = async () => {
    if (!piece) return;
    if (assignSource === 'order' && !assignOrderItemId) {
      setStepError('Choose one paid order item.');
      return;
    }
    if (assignSource === 'manual' && !assignManualRef.trim()) {
      setStepError('Enter an opaque manual reference. Never a name, email, or address.');
      return;
    }
    setBusy('assign');
    setStepError('');
    try {
      await jsonRequest('/api/admin/piece-fulfillments', {
        action: 'assign',
        keeperPieceId: piece.id,
        ...(assignSource === 'order'
          ? { orderItemId: Number(assignOrderItemId) }
          : { manualReference: assignManualRef.trim() }),
      });
      await refreshPiece();
      setStepNote('Exact physical plate assigned.');
    } catch (error) {
      setStepError(registryErrorMessage(error, 'Could not save the assignment.'));
    } finally {
      setBusy('');
    }
  };

  const runShip = async () => {
    if (!fulfillment) return;
    if (!shipConfirmed) {
      setStepError('Confirm the final physical comparison before marking shipped.');
      return;
    }
    setBusy('ship');
    setStepError('');
    try {
      await jsonRequest('/api/admin/piece-fulfillments', {
        action: 'ship',
        fulfillmentId: fulfillment.id,
      });
      await refreshPiece();
      setFinished(true);
      setStepNote(`${piece?.publicCode || 'Plate'} marked shipped. The record is now permanent.`);
    } catch (error) {
      setStepError(registryErrorMessage(error, 'Could not mark this piece shipped.'));
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
        return piece?.plateStatus === 'active';
      case 'assign':
        return Boolean(fulfillment);
      case 'ship':
        return false; // ship is terminal; the "Mark shipped" action finishes
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
  const resumable = rows.filter((row) => plateWizardStageForPiece(snapshotOf(row, desk)) !== null);

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
              <p className="font-serif text-sm text-wood-600 mt-1">Mint a fresh permanent identity and walk it through to shipment.</p>
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
                  const target = plateWizardStageForPiece(snapshotOf(row, desk));
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
            <p className="font-serif text-wood-700 mb-6">{stepNote || 'This piece is active, assigned, and shipped. Its public code and Ownership Code are permanent records.'}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button type="button" className={buttonClass} onClick={beginNewPiece}>Start another piece</button>
              <button type="button" className={quietButtonClass} onClick={goToChoose}>Back to start</button>
              <Link to="/admin/pieces" className={quietButtonClass}>Open the full desk</Link>
            </div>
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
                    <div className="grid sm:grid-cols-[1fr_9rem] gap-4 items-end">
                      <div>
                        <label className={labelClass} htmlFor="wizard-artwork">Artwork</label>
                        <select id="wizard-artwork" value={issueArtwork} disabled={Boolean(busy)} onChange={(event) => setIssueArtwork(event.target.value)} className={inputClass}>
                          <option value="">Choose an artwork</option>
                          {sortedArtworks.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.title} · {artwork.id}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="wizard-edition">Edition</label>
                        <input id="wizard-edition" type="number" min={0} step={1} value={issueEdition} disabled={Boolean(busy)} onChange={(event) => setIssueEdition(event.target.value)} placeholder="0" className={inputClass} />
                      </div>
                    </div>
                    <p className="font-sans text-xs text-wood-500 mt-3">Edition 0 means a unique, non-numbered piece. Issuing is idempotent: a retry returns the same identity, never a duplicate.</p>
                    <button type="button" onClick={runIssue} disabled={Boolean(busy)} className={`${buttonClass} mt-4`}>{busy === 'issue' ? 'Issuing…' : 'Issue permanent identity'}</button>
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
                  <p className="font-sans text-sm text-green-800" role="status">Plate is active and permanently locked. You can continue.</p>
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

              {/* ASSIGN */}
              {stage.key === 'assign' && (
                fulfillment ? (
                  <p className="font-sans text-sm text-green-800" role="status">This plate is assigned. You can continue to shipment.</p>
                ) : (
                  <div>
                    <p className="font-serif text-sm text-wood-600 mb-4">Tie this exact active, backed-up plate to a paid order or an opaque manual handoff. Checkout never selects ownership; assignment happens here, at packing.</p>
                    <fieldset className="mb-3">
                      <legend className={labelClass}>Assignment source</legend>
                      <div className="flex flex-wrap gap-5 font-sans text-sm text-wood-700">
                        <label className="flex items-center gap-2"><input type="radio" name="wizard-source" checked={assignSource === 'order'} onChange={() => setAssignSource('order')} /> Paid order</label>
                        <label className="flex items-center gap-2"><input type="radio" name="wizard-source" checked={assignSource === 'manual'} onChange={() => setAssignSource('manual')} /> Manual handoff</label>
                      </div>
                    </fieldset>
                    {assignSource === 'order' ? (
                      <>
                        <select aria-label="Paid order item" className={inputClass} value={assignOrderItemId} onChange={(event) => setAssignOrderItemId(event.target.value)}>
                          <option value="">Choose one paid order item</option>
                          {desk.availableOrderItems.map((item) => <option key={item.id} value={item.id}>{item.orderReference} · {item.description || item.productId} · {item.buyerEmail}</option>)}
                        </select>
                        {desk.availableOrderItems.length === 0 && <p className="font-sans text-xs text-wood-500 mt-2">No unassigned paid order items. Use a manual handoff, or check the order is paid.</p>}
                      </>
                    ) : (
                      <>
                        <input aria-label="Opaque manual reference" className={inputClass} value={assignManualRef} onChange={(event) => setAssignManualRef(event.target.value)} placeholder="studio-handoff:2026-07" />
                        <p className="font-sans text-xs text-wood-500 mt-2">Use an opaque internal reference, never a name, email, phone, or address.</p>
                      </>
                    )}
                    <button type="button" className={`${buttonClass} mt-4`} disabled={Boolean(busy)} onClick={() => void runAssign()}>{busy === 'assign' ? 'Assigning…' : 'Assign exact plate'}</button>
                  </div>
                )
              )}

              {/* SHIP */}
              {stage.key === 'ship' && (
                <div>
                  <p className="font-serif text-sm text-wood-600 mb-4">Do the final physical comparison: artwork, edition, public code, a live QR scan from the packed position, a legible underside code, plate active, backup verified, and the right shipping label. Once shipped, the record cannot be corrected through the normal UI.</p>
                  <label className="flex items-start gap-3 font-sans text-sm text-wood-700 mb-4">
                    <input type="checkbox" checked={shipConfirmed} onChange={(event) => setShipConfirmed(event.target.checked)} className="mt-1" />
                    <span>I compared the artwork, plate, assignment, and shipping label, and the package is sealed.</span>
                  </label>
                  <button type="button" className={buttonClass} disabled={Boolean(busy) || !shipConfirmed} onClick={() => void runShip()}>{busy === 'ship' ? 'Marking…' : 'Mark shipped'}</button>
                </div>
              )}

              {stepNote && <p className="font-sans text-sm text-green-800 mt-4" role="status">{stepNote}</p>}
              {stepError && <p className="font-sans text-sm text-red-700 mt-4" role="alert">{stepError}</p>}
            </div>

            {/* NAV */}
            <div className="flex items-center justify-between gap-3 mt-6">
              <button type="button" className={quietButtonClass} onClick={goBack} disabled={stageIndex === 0}>Back</button>
              {stage.key !== 'ship' && (
                <button type="button" className={buttonClass} onClick={goNext} disabled={!canAdvance}>Next step</button>
              )}
            </div>
          </section>
        )}
      </div>
    </AdminPage>
  );
};

export default AdminPlateWizard;
