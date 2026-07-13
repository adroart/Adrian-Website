/**
 * Artwork Registry desk for issuing permanent plate identities, verifying the
 * physical plate, recovering an Ownership Code, and assigning an exact plate
 * to a paid sale or opaque manual handoff.
 *
 * Sensitive values exist only in this component's immediate React state. They
 * are never written to browser storage and are cleared on dismissal or plate
 * activation. AdminLayout supplies the authenticated admin boundary.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { FULL_ARCHIVE } from '../data/mockData';
import {
  activationChecklistComplete,
  beginIssuanceAttempt,
  clearSensitivePlateState,
  projectPlateDownloads,
  projectIssuedPlateResponse,
  type ActivationChecklist,
  type IssuedPlatePackage,
  type SensitivePlateState,
} from '../utils/adminArtworkRegistry';

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
  plateStatus: string;
  backupStatus: string;
  plateActivatedAt: string | null;
}

interface OrderItem {
  id: number;
  orderId: string;
  orderReference: string;
  buyerEmail: string;
  productId: string;
  description: string | null;
  quantity: number;
  amountSubtotal: number;
}

interface Fulfillment {
  id: string;
  keeperPieceId: string;
  pieceId: string;
  editionNumber: number;
  publicCode: string;
  orderItemId: number | null;
  assignmentType: 'stripe_order' | 'manual';
  intendedRecipientReference: string;
  buyerEmail: string | null;
  assignedAt: string;
  shippedAt: string | null;
  claimedAt: string | null;
  correctedAt: string | null;
  correctionReason: string | null;
}

interface FulfillmentDesk {
  availablePlates: AvailablePlate[];
  availableOrderItems: OrderItem[];
  fulfillments: Fulfillment[];
}

const emptySensitiveState: SensitivePlateState = {
  issuanceKey: null,
  package: null,
  revealedForPieceId: null,
  revealedOwnershipCode: null,
  revealedUndersideSvg: null,
  stepUpSecret: '',
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
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [pieceId, setPieceId] = useState('');
  const [editionNumber, setEditionNumber] = useState('');
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState('');
  const [issueSuccess, setIssueSuccess] = useState('');
  const [sensitive, setSensitive] = useState<SensitivePlateState>(emptySensitiveState);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [rowSuccess, setRowSuccess] = useState<Record<string, string>>({});
  const [activationPieceId, setActivationPieceId] = useState<string | null>(null);
  const [activationChecks, setActivationChecks] = useState<ActivationChecklist>(emptyChecklist);

  const [desk, setDesk] = useState<FulfillmentDesk>({
    availablePlates: [], availableOrderItems: [], fulfillments: [],
  });
  const [deskLoading, setDeskLoading] = useState(true);
  const [deskLoadError, setDeskLoadError] = useState('');
  const [deskError, setDeskError] = useState('');
  const [deskSuccess, setDeskSuccess] = useState('');
  const [deskBusy, setDeskBusy] = useState(false);
  const [selectedPlateId, setSelectedPlateId] = useState('');
  const [assignmentSource, setAssignmentSource] = useState<'order' | 'manual'>('order');
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('');
  const [manualReference, setManualReference] = useState('');
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [shippingConfirmed, setShippingConfirmed] = useState<Record<string, boolean>>({});

  const sortedPieces = useMemo(
    () => [...FULL_ARCHIVE].sort((a, b) => a.title.localeCompare(b.title)),
    [],
  );

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

  const loadDesk = useCallback(async () => {
    setDeskLoading(true);
    setDeskLoadError('');
    try {
      const data = await jsonRequest('/api/admin/piece-fulfillments');
      setDesk({
        availablePlates: data.availablePlates || [],
        availableOrderItems: data.availableOrderItems || [],
        fulfillments: data.fulfillments || [],
      });
    } catch (error) {
      setDeskLoadError(errorMessage(error, 'Could not load fulfillment records.'));
    } finally {
      setDeskLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadPieces(), loadDesk()]);
  }, [loadDesk, loadPieces]);

  const dismissSensitiveState = () => {
    setSensitive((current) => clearSensitivePlateState(current));
    setIssueSuccess('');
  };

  const issuePlate = async () => {
    if (!pieceId) {
      setIssueError('Choose an artwork first.');
      return;
    }
    const parsedEdition = editionNumber.trim() ? Number(editionNumber) : 0;
    if (!Number.isSafeInteger(parsedEdition) || parsedEdition < 0) {
      setIssueError('Edition must be a whole number of zero or greater.');
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
        editionNumber: parsedEdition,
        issuanceKey,
      });
      const issuedPackage: IssuedPlatePackage = projectIssuedPlateResponse(data);
      setSensitive((current) => ({ ...current, issuanceKey, package: issuedPackage }));
      setIssueSuccess(data.backupStatus === 'verified'
        ? 'Plate package issued and encrypted backup verified.'
        : 'Plate package issued. Repair the online backup before activation.');
      await loadPieces();
    } catch (error) {
      setIssueError(`${errorMessage(error, 'Could not issue the plate.')} Retry keeps this issuance attempt and will not mint a second identity.`);
    } finally {
      setIssuing(false);
    }
  };

  const runRowAction = async (row: PieceRow, action: 'backup' | 'reveal') => {
    if (!sensitive.stepUpSecret) {
      setRowError((current) => ({ ...current, [row.id]: 'Enter the admin step-up secret first.' }));
      return;
    }
    setRowBusy(`${row.id}:${action}`);
    setRowError((current) => ({ ...current, [row.id]: '' }));
    setRowSuccess((current) => ({ ...current, [row.id]: '' }));
    try {
      const data = await jsonRequest(`/api/admin/pieces/${encodeURIComponent(row.id)}/${action}`, {
        adminSecret: sensitive.stepUpSecret,
      });
      if (action === 'reveal') {
        setSensitive((current) => ({
          ...current,
          revealedForPieceId: row.id,
          revealedOwnershipCode: data.ownershipCode,
          revealedUndersideSvg: data.undersideSvg,
        }));
        setRowSuccess((current) => ({ ...current, [row.id]: 'Ownership Code revealed after audit.' }));
      } else {
        setRowSuccess((current) => ({ ...current, [row.id]: 'Encrypted online backup verified.' }));
        await Promise.all([loadPieces(), loadDesk()]);
      }
    } catch (error) {
      setRowError((current) => ({ ...current, [row.id]: errorMessage(error, `Could not ${action} this plate.`) }));
    } finally {
      setRowBusy(null);
    }
  };

  const openActivation = (row: PieceRow) => {
    setActivationPieceId(row.id);
    setActivationChecks(emptyChecklist);
  };

  const activatePlate = async (row: PieceRow) => {
    if (!sensitive.stepUpSecret) {
      setRowError((current) => ({ ...current, [row.id]: 'Enter the admin step-up secret first.' }));
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
        adminSecret: sensitive.stepUpSecret,
        ...activationChecks,
      });
      setSensitive((current) => clearSensitivePlateState(current));
      setActivationPieceId(null);
      setActivationChecks(emptyChecklist);
      setRowSuccess((current) => ({ ...current, [row.id]: 'Plate identity activated and locked.' }));
      await Promise.all([loadPieces(), loadDesk()]);
    } catch (error) {
      setRowError((current) => ({ ...current, [row.id]: errorMessage(error, 'Could not activate this plate.') }));
    } finally {
      setRowBusy(null);
    }
  };

  const submitAssignment = async () => {
    if (!selectedPlateId) {
      setDeskError('Choose the exact physical plate.');
      return;
    }
    if (assignmentSource === 'order' && !selectedOrderItemId) {
      setDeskError('Choose one paid order item.');
      return;
    }
    if (assignmentSource === 'manual' && !manualReference.trim()) {
      setDeskError('Enter an opaque manual reference. Do not use a name, email, or address.');
      return;
    }
    if (correctingId && !correctionReason.trim()) {
      setDeskError('A correction reason is required.');
      return;
    }
    setDeskBusy(true);
    setDeskError('');
    setDeskSuccess('');
    try {
      const payload: Record<string, unknown> = {
        action: correctingId ? 'correct' : 'assign',
        keeperPieceId: selectedPlateId,
        ...(assignmentSource === 'order'
          ? { orderItemId: Number(selectedOrderItemId) }
          : { manualReference: manualReference.trim() }),
        ...(correctingId ? { fulfillmentId: correctingId, reason: correctionReason.trim() } : {}),
      };
      await jsonRequest('/api/admin/piece-fulfillments', payload);
      setDeskSuccess(correctingId ? 'Assignment corrected before shipment.' : 'Exact physical plate assigned.');
      setSelectedPlateId('');
      setSelectedOrderItemId('');
      setManualReference('');
      setCorrectionReason('');
      setCorrectingId(null);
      await loadDesk();
    } catch (error) {
      setDeskError(errorMessage(error, 'Could not save the assignment.'));
    } finally {
      setDeskBusy(false);
    }
  };

  const beginCorrection = (fulfillment: Fulfillment) => {
    setCorrectingId(fulfillment.id);
    setSelectedPlateId(fulfillment.keeperPieceId);
    setAssignmentSource(fulfillment.assignmentType === 'stripe_order' ? 'order' : 'manual');
    setSelectedOrderItemId(fulfillment.orderItemId ? String(fulfillment.orderItemId) : '');
    setManualReference(fulfillment.assignmentType === 'manual' ? fulfillment.intendedRecipientReference : '');
    setCorrectionReason('');
    setDeskError('');
    document.getElementById('fulfillment-editor')?.scrollIntoView({ behavior: 'smooth' });
  };

  const markShipped = async (fulfillment: Fulfillment) => {
    if (!shippingConfirmed[fulfillment.id]) {
      setDeskError('Confirm the exact artwork, plate, assignment, and shipping label before marking shipped.');
      return;
    }
    setDeskBusy(true);
    setDeskError('');
    setDeskSuccess('');
    try {
      await jsonRequest('/api/admin/piece-fulfillments', {
        action: 'ship',
        fulfillmentId: fulfillment.id,
      });
      setDeskSuccess(`${fulfillment.publicCode} marked shipped.`);
      setShippingConfirmed((current) => ({ ...current, [fulfillment.id]: false }));
      await loadDesk();
    } catch (error) {
      setDeskError(errorMessage(error, 'Could not mark this assignment shipped.'));
    } finally {
      setDeskBusy(false);
    }
  };

  const issued = sensitive.package;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-paper-50 px-4 sm:px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
            Artwork Registry
          </p>
          <h1 className="font-title text-3xl md:text-4xl text-wood-900 mb-3">Plate and fulfillment desk</h1>
          <p className="font-serif text-wood-600 leading-relaxed mb-10 max-w-2xl">
            Issue one permanent plate identity, download its private fabrication package, verify the
            physical metal, then assign that exact plate during packing.
          </p>

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
            <div className="grid sm:grid-cols-[1fr_9rem] gap-4 items-end">
              <div>
                <label className={labelClass} htmlFor="piece-select">Artwork</label>
                <select id="piece-select" value={pieceId} disabled={issuing || Boolean(sensitive.issuanceKey)} onChange={(event) => setPieceId(event.target.value)} className={inputClass}>
                  <option value="">Choose an artwork</option>
                  {sortedPieces.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.title} · {artwork.id}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="edition-input">Exact edition</label>
                <input id="edition-input" type="number" min={0} step={1} value={editionNumber} disabled={issuing || Boolean(sensitive.issuanceKey)} onChange={(event) => setEditionNumber(event.target.value)} placeholder="0" className={inputClass} />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-4 flex-wrap">
              <button type="button" onClick={issuePlate} disabled={issuing || Boolean(issued)} className={buttonClass}>{issuing ? 'Issuing plate…' : 'Issue fabrication package'}</button>
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
              <button type="button" className={quietButtonClass} onClick={() => void loadPieces()} disabled={listLoading}>Refresh registry</button>
            </div>
            <div className="border border-wood-200 bg-white p-4 mb-4">
              <label className={labelClass} htmlFor="step-up-secret">Admin step-up secret</label>
              <input id="step-up-secret" type="password" autoComplete="new-password" value={sensitive.stepUpSecret} onChange={(event) => setSensitive((current) => ({ ...current, stepUpSecret: event.target.value }))} className={inputClass} placeholder="Required for backup, reveal, and activation" />
              <p className="font-sans text-xs text-wood-500 mt-2">Kept only in this page's memory and cleared after activation or dismissal.</p>
              {(sensitive.stepUpSecret || sensitive.revealedOwnershipCode) && <button type="button" className={`${quietButtonClass} mt-3`} onClick={dismissSensitiveState}>Clear private state and secret</button>}
            </div>
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
                          <div><dt className="font-semibold">Keeper</dt><dd>{row.keeperBound ? 'Claimed' : row.claimedAt ? 'Previously claimed' : 'Not claimed'}</dd></div>
                          <div><dt className="font-semibold">Generated</dt><dd>{formatDate(row.plateGeneratedAt)}</dd></div>
                          <div><dt className="font-semibold">Activated</dt><dd>{formatDate(row.plateActivatedAt)}</dd></div>
                          <div><dt className="font-semibold">Backup reference</dt><dd className="break-all">{row.backupReference || 'Not yet'}</dd></div>
                        </dl>
                      </div>
                      {row.publicCode && (
                        <div className="flex md:flex-col flex-wrap gap-2 md:items-stretch">
                          {row.backupStatus !== 'verified' && <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'backup')}>{rowBusy === `${row.id}:backup` ? 'Retrying…' : 'Retry backup'}</button>}
                          <button type="button" className={quietButtonClass} disabled={Boolean(rowBusy)} onClick={() => void runRowAction(row, 'reveal')}>{rowBusy === `${row.id}:reveal` ? 'Revealing…' : 'Reveal Ownership Code'}</button>
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

          <section aria-labelledby="fulfillment-title">
            <div className="flex flex-wrap justify-between gap-4 items-end mb-4">
              <div>
                <h2 id="fulfillment-title" className="font-title text-xl text-wood-900">Fulfillment desk</h2>
                <p className="font-serif text-sm text-wood-600 mt-1">Assign the exact active, backed-up plate during packing. Checkout does not select ownership.</p>
              </div>
              <button type="button" className={quietButtonClass} onClick={() => void loadDesk()} disabled={deskLoading}>Refresh fulfillment</button>
            </div>
            <div id="fulfillment-editor" className="border border-wood-200 bg-white p-5 mb-6">
              <h3 className="font-title text-lg text-wood-900 mb-4">{correctingId ? 'Correct assignment before shipment' : 'Assign a physical plate'}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass} htmlFor="fulfillment-plate">Active backed-up plate</label>
                  <select id="fulfillment-plate" className={inputClass} value={selectedPlateId} onChange={(event) => setSelectedPlateId(event.target.value)}>
                    <option value="">Choose the exact plate</option>
                    {correctingId && (() => {
                      const current = desk.fulfillments.find((item) => item.id === correctingId);
                      return current && !desk.availablePlates.some((plate) => plate.id === current.keeperPieceId)
                        ? <option value={current.keeperPieceId}>{current.publicCode} · {titleFor(current.pieceId)} · edition {current.editionNumber} · current</option>
                        : null;
                    })()}
                    {desk.availablePlates.map((plate) => <option key={plate.id} value={plate.id}>{plate.publicCode} · {titleFor(plate.pieceId)} · edition {plate.editionNumber}</option>)}
                  </select>
                  {desk.availablePlates.length === 0 && <p className="font-sans text-xs text-wood-500 mt-2">No unassigned active plates with verified backups.</p>}
                </div>
                <fieldset>
                  <legend className={labelClass}>Assignment source</legend>
                  <div className="flex flex-wrap gap-5 font-sans text-sm text-wood-700 mb-3">
                    <label className="flex items-center gap-2"><input type="radio" name="assignment-source" checked={assignmentSource === 'order'} onChange={() => setAssignmentSource('order')} /> Paid order</label>
                    <label className="flex items-center gap-2"><input type="radio" name="assignment-source" checked={assignmentSource === 'manual'} onChange={() => setAssignmentSource('manual')} /> Manual handoff</label>
                  </div>
                  {assignmentSource === 'order' ? (
                    <select aria-label="Paid order item" className={inputClass} value={selectedOrderItemId} onChange={(event) => setSelectedOrderItemId(event.target.value)}>
                      <option value="">Choose one paid order item</option>
                      {correctingId && (() => {
                        const current = desk.fulfillments.find((item) => item.id === correctingId);
                        return current?.orderItemId && !desk.availableOrderItems.some((item) => item.id === current.orderItemId)
                          ? <option value={current.orderItemId}>{current.intendedRecipientReference} · {current.buyerEmail || 'current paid order'} · current</option>
                          : null;
                      })()}
                      {desk.availableOrderItems.map((item) => <option key={item.id} value={item.id}>{item.orderReference} · {item.description || item.productId} · {item.buyerEmail}</option>)}
                    </select>
                  ) : (
                    <div>
                      <input aria-label="Opaque manual reference" className={inputClass} value={manualReference} onChange={(event) => setManualReference(event.target.value)} placeholder="studio-handoff:2026-07" />
                      <p className="font-sans text-xs text-wood-500 mt-2">Use an opaque internal reference, never a name, email, phone, or address.</p>
                    </div>
                  )}
                </fieldset>
              </div>
              {correctingId && <div className="mt-4"><label className={labelClass} htmlFor="correction-reason">Correction reason</label><input id="correction-reason" className={inputClass} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Why this pre-shipment assignment must change" /></div>}
              <div className="flex flex-wrap gap-3 mt-5">
                <button type="button" className={buttonClass} disabled={deskBusy || (!correctingId && desk.availablePlates.length === 0)} onClick={() => void submitAssignment()}>{deskBusy ? 'Saving…' : correctingId ? 'Save correction' : 'Assign exact plate'}</button>
                {correctingId && <button type="button" className={quietButtonClass} onClick={() => {
                  setCorrectingId(null);
                  setSelectedPlateId('');
                  setSelectedOrderItemId('');
                  setManualReference('');
                  setAssignmentSource('order');
                  setCorrectionReason('');
                }}>Cancel correction</button>}
              </div>
              {deskError && <p className="font-sans text-sm text-red-700 mt-3" role="alert">{deskError}</p>}
              {deskSuccess && <p className="font-sans text-sm text-green-800 mt-3" role="status">{deskSuccess}</p>}
            </div>

            <h3 className="font-title text-lg text-wood-900 mb-3">Assignments</h3>
            {deskLoadError ? (
              <div className="border border-red-300 bg-white p-6"><p className="font-sans text-sm text-red-700" role="alert">{deskLoadError}</p></div>
            ) : deskLoading && desk.fulfillments.length === 0 ? (
              <div className="border border-wood-200 bg-white p-6"><p className="font-sans text-sm text-wood-500">Loading assignments…</p></div>
            ) : desk.fulfillments.length === 0 ? (
              <div className="border border-wood-200 bg-white p-8 text-center"><p className="font-serif text-wood-600">No physical plates have been assigned.</p></div>
            ) : (
              <div className="border border-wood-200 bg-white divide-y divide-wood-200">
                {desk.fulfillments.map((fulfillment) => (
                  <article key={fulfillment.id} className="p-5 grid md:grid-cols-[1fr_auto] gap-5">
                    <div>
                      <h4 className="font-serif text-lg text-wood-900">{fulfillment.publicCode} · {titleFor(fulfillment.pieceId)} · edition {fulfillment.editionNumber}</h4>
                      <p className="font-sans text-sm text-wood-600 mt-1">{fulfillment.assignmentType === 'stripe_order' ? `${fulfillment.intendedRecipientReference}${fulfillment.buyerEmail ? ` · ${fulfillment.buyerEmail}` : ''}` : `Manual reference: ${fulfillment.intendedRecipientReference}`}</p>
                      <p className="font-sans text-xs text-wood-500 mt-2">Assigned {formatDate(fulfillment.assignedAt)} · {fulfillment.shippedAt ? `Shipped ${formatDate(fulfillment.shippedAt)}` : 'Not shipped'} · {fulfillment.claimedAt ? `Claimed ${formatDate(fulfillment.claimedAt)}` : 'Not claimed'}</p>
                      {fulfillment.correctionReason && <p className="font-sans text-xs text-wood-500 mt-1">Corrected: {fulfillment.correctionReason}</p>}
                    </div>
                    {!fulfillment.shippedAt && (
                      <div className="md:max-w-xs">
                        <label className="flex items-start gap-2 font-sans text-xs text-wood-700 mb-3">
                          <input type="checkbox" className="mt-0.5" checked={Boolean(shippingConfirmed[fulfillment.id])} onChange={(event) => setShippingConfirmed((current) => ({ ...current, [fulfillment.id]: event.target.checked }))} />
                          <span>I compared the artwork, plate, assignment, and shipping label.</span>
                        </label>
                        <div className="flex md:justify-end flex-wrap gap-2">
                          {!fulfillment.claimedAt && <button type="button" className={quietButtonClass} disabled={deskBusy} onClick={() => beginCorrection(fulfillment)}>Correct</button>}
                          <button type="button" className={buttonClass} disabled={deskBusy || !shippingConfirmed[fulfillment.id]} onClick={() => void markShipped(fulfillment)}>Mark shipped</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPieces;
