/**
 * The Curation Desk — the practitioner's tool for building a Viewing.
 *
 * Lifecycle (machine prepares, human curates, client decides):
 *   Intake   — recipient name, intention, and a chart (manual gate/line) or
 *              birth moment.
 *   Compute  — calls the Mandala Codes engine; the 11 spheres come back as
 *              pieces + a taste of each (meaning only; esoterica dropped).
 *   Reveal   — the chart board: every sphere as an art-led card.
 *   Curate   — star the pieces to recommend; write the personal reason and edit
 *              the plain description / keywords. Reasons are NEVER auto-written.
 *   Compose  — the live preview renders the exact client artifact.
 *   Deliver  — (next pass) save + mint token + copy /viewing/:token.
 *
 * This pass builds Intake → Compute → Reveal → Curate → Compose against the
 * engine, with the artifact preview inline. Persistence + token delivery + the
 * invoice handoff are the following pass (they reuse the invoice plumbing).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminPage } from './admin/AdminPage';
import { adminMode } from './admin/adminMode';
import Viewing from './viewing/Viewing';
import type { ViewingData, ViewingPiece } from './viewing/viewingTypes';
import {
  SPHERE_KEYS,
  type SphereKey,
  type GateLine,
  fetchChart,
  sphereToPiece,
} from './viewing/curationEngine';

const SPHERE_LABELS: Record<SphereKey, string> = {
  lifesWork: "Life's Work",
  evolution: 'Evolution',
  radiance: 'Radiance',
  purpose: 'Purpose',
  attraction: 'Attraction',
  iq: 'IQ',
  eq: 'EQ',
  sq: 'SQ',
  core: 'Core',
  culture: 'Culture',
  pearl: 'Pearl',
};

const inputClass =
  'w-full border border-wood-300 bg-white px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const labelClass = 'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
const ENGINE_BASE_DEFAULT = 'https://mandalacodes.com';

/** A single editable card on the chart board. */
const BoardCard: React.FC<{
  piece: ViewingPiece;
  sphere: string;
  reason: string;
  onChange: (next: Partial<ViewingPiece>) => void;
  onToggleRecommend: () => void;
  onReason: (reason: string) => void;
}> = ({ piece, sphere, reason, onChange, onToggleRecommend, onReason }) => (
  <div
    className={`border p-4 transition-colors ${
      piece.recommended ? 'border-bronze-500 bg-bronze-200/20' : 'border-wood-200 bg-white'
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <span className="font-label text-[10px] uppercase tracking-[0.18em] text-bronze-600">
          {sphere} · No. {piece.code}
        </span>
        <input
          value={piece.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="font-display text-xl text-wood-900 bg-transparent border-0 border-b border-transparent focus:border-wood-300 focus:outline-none w-full mt-0.5"
        />
      </div>
      <button
        type="button"
        onClick={onToggleRecommend}
        className={`font-label text-[10px] uppercase tracking-[0.16em] shrink-0 ${
          piece.recommended ? 'text-bronze-700' : 'text-wood-400 hover:text-bronze-600'
        }`}
      >
        {piece.recommended ? '★ Recommended' : '☆ Recommend'}
      </button>
    </div>

    <label className={`${labelClass} mt-3`}>Keywords (comma separated)</label>
    <input
      value={(piece.keywords || []).join(', ')}
      onChange={(e) => onChange({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
      placeholder="Origination, Renewal, First Movement"
      className={inputClass}
    />

    <label className={`${labelClass} mt-3`}>Description (plain art voice, 2-3 sentences)</label>
    <textarea
      value={piece.description || ''}
      onChange={(e) => onChange({ description: e.target.value })}
      placeholder="What this piece is about and the energy it carries. No Gene Keys vocabulary."
      className={`${inputClass} min-h-[88px] resize-y leading-relaxed`}
    />

    {piece.recommended && (
      <>
        <label className={`${labelClass} mt-3`}>Why this piece, for this person</label>
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          placeholder="The personal reason, framed by their intention. Your voice."
          className={`${inputClass} min-h-[72px] resize-y leading-relaxed`}
        />
      </>
    )}
  </div>
);

interface ViewingRow {
  id: number;
  publicToken: string;
  publicUrlPath: string;
  status: string;
  recipientName: string;
  intention: string;
  chart: any;
  data: any;
  invoiceToken: string | null;
  createdAt: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  requested: 'Requested',
};

const AdminViewings: React.FC = () => {
  const [searchParams] = useSearchParams();
  const viewingIdValues = searchParams.getAll('viewingId');
  const hasViewingSelector = viewingIdValues.length > 0;
  const linkedViewingId = viewingIdValues.length === 1 && /^\d+$/.test(viewingIdValues[0])
    && Number.isSafeInteger(Number(viewingIdValues[0])) && Number(viewingIdValues[0]) > 0
    ? Number(viewingIdValues[0]) : null;
  const selectedFromUrlRef = useRef<number | null>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [rows, setRows] = useState<ViewingRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Intake
  const [recipientName, setRecipientName] = useState('');
  const [intention, setIntention] = useState('');
  const [mode, setMode] = useState<'chart' | 'birth'>('chart');
  const [utcBirth, setUtcBirth] = useState('');
  const [chart, setChart] = useState<Record<SphereKey, GateLine>>(
    () => Object.fromEntries(SPHERE_KEYS.map((k) => [k, { gate: 0, line: 1 }])) as Record<SphereKey, GateLine>,
  );
  const [engineBase, setEngineBase] = useState(ENGINE_BASE_DEFAULT);

  // Board state
  const [pieces, setPieces] = useState<ViewingPiece[]>([]);
  const [sphereByCode, setSphereByCode] = useState<Record<number, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [closing, setClosing] = useState('Pick these up together, or one at a time.');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Delivery
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState('');

  const loadList = async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/viewings');
      const d = await res.json().catch(() => ({}));
      if (d?.ok) setRows(d.viewings as ViewingRow[]);
    } finally {
      setListLoading(false);
    }
  };
  useEffect(() => {
    loadList();
  }, []);

  const resetEditor = () => {
    setRecipientName('');
    setIntention('');
    setMode('chart');
    setUtcBirth('');
    setChart(Object.fromEntries(SPHERE_KEYS.map((k) => [k, { gate: 0, line: 1 }])) as Record<SphereKey, GateLine>);
    setPieces([]);
    setSphereByCode({});
    setReasons({});
    setClosing('Pick these up together, or one at a time.');
    setViewingId(null);
    setShareUrl('');
    setSavedNote('');
    setError('');
    setShowPreview(false);
  };

  const openNew = () => {
    resetEditor();
    setView('editor');
  };

  useEffect(() => {
    if (adminMode(searchParams) === 'create') openNew();
  }, [searchParams]);

  const openExisting = (row: ViewingRow) => {
    resetEditor();
    setRecipientName(row.recipientName || '');
    setIntention(row.intention || '');
    setViewingId(row.id);
    setShareUrl(`${window.location.origin}${row.publicUrlPath}`);
    const data = row.data || {};
    const loaded: ViewingPiece[] = Array.isArray(data.pieces) ? data.pieces : [];
    setPieces(loaded);
    setSphereByCode(Object.fromEntries(loaded.map((p) => [p.code, ''])));
    const recPicks = data.recommendation?.picks || [];
    setReasons(Object.fromEntries(recPicks.map((pk: any) => [pk.pieceId, pk.reason || ''])));
    if (data.recommendation?.closing) setClosing(data.recommendation.closing);
    setView('editor');
  };

  useEffect(() => {
    if (listLoading) return;
    if (linkedViewingId !== null) {
      const row = rows.find(item => item.id === linkedViewingId);
      if (row) {
        selectedFromUrlRef.current = linkedViewingId;
        openExisting(row);
      } else {
        selectedFromUrlRef.current = null;
        resetEditor();
        setView('list');
        setError('The requested viewing was not found.');
      }
      return;
    }
    if (hasViewingSelector) {
      selectedFromUrlRef.current = null;
      resetEditor();
      setView('list');
      setError('The viewing link is not valid.');
    } else if (selectedFromUrlRef.current !== null) {
      selectedFromUrlRef.current = null;
      resetEditor();
      setView('list');
    }
  }, [hasViewingSelector, linkedViewingId, listLoading, rows]);

  const viewingStage = shareUrl ? 3 : showPreview ? 2 : pieces.length > 0 ? 1 : 0;
  const viewingStages = ['Intake', 'Curate', 'Preview', 'Send'];

  const compute = async () => {
    setLoading(true);
    setError('');
    try {
      const body =
        mode === 'birth'
          ? { clientName: recipientName, utcBirth }
          : {
              clientName: recipientName,
              profile: Object.fromEntries(
                SPHERE_KEYS.filter((k) => chart[k].gate > 0).map((k) => [k, chart[k]]),
              ),
            };
      const result = await fetchChart(engineBase, body);
      const next = result.spheres.map(sphereToPiece);
      setPieces(next);
      setSphereByCode(Object.fromEntries(result.spheres.map((s) => [s.gate, s.sphere])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the recommendation engine.');
    } finally {
      setLoading(false);
    }
  };

  const updatePiece = (code: number, next: Partial<ViewingPiece>) =>
    setPieces((prev) => prev.map((p) => (p.code === code ? { ...p, ...next } : p)));

  const viewingData: ViewingData = useMemo(
    () => ({
      recipientName: recipientName || 'Your',
      subtitle: 'A handful of pieces I chose with you in mind.',
      pieces,
      recommendation: {
        intention,
        picks: pieces
          .filter((p) => p.recommended)
          .map((p) => ({ pieceId: p.id, reason: reasons[p.id] || '' })),
        closing,
        signature: 'Adrian',
      },
    }),
    [recipientName, intention, pieces, reasons, closing],
  );

  const recommendedCount = pieces.filter((p) => p.recommended).length;

  const save = async (status: 'draft' | 'sent') => {
    setSaving(true);
    setSavedNote('');
    setError('');
    try {
      const res = await fetch('/api/admin/viewings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: viewingId ?? undefined,
          status,
          recipientName,
          intention,
          chart: mode === 'birth' ? { utcBirth } : chart,
          data: viewingData,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.ok) throw new Error(d?.error || `save failed (${res.status})`);
      setViewingId(d.viewing.id);
      const url = `${window.location.origin}${d.viewing.publicUrlPath}`;
      setShareUrl(url);
      if (status === 'sent') {
        await navigator.clipboard?.writeText(url).catch(() => {});
        setSavedNote('Link copied. Send it to the collector.');
      } else {
        setSavedNote('Saved as draft.');
      }
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the viewing.');
    } finally {
      setSaving(false);
    }
  };

  if (view === 'list') {
    return (
      <AdminPage width="medium">
          <div className="max-w-4xl mx-auto">
            <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
              The Curation Desk
            </p>
            <div className="flex items-center justify-between mb-8">
              <h1 className="font-display text-3xl text-wood-900">Viewings</h1>
              <button type="button" onClick={openNew} className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 transition-colors">
                + New viewing
              </button>
            </div>

            {listLoading && rows.length === 0 ? (
              <p className="font-sans text-sm text-wood-500">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="border border-wood-200 bg-white p-8 text-center">
                <p className="font-sans text-wood-600">No viewings yet. Build the first one for a collector.</p>
              </div>
            ) : (
              <div className="border border-wood-200 bg-white divide-y divide-wood-200">
                {rows.map((row) => (
                  <button key={row.id} type="button" onClick={() => openExisting(row)} className="w-full text-left px-5 py-4 hover:bg-paper-100 transition-colors flex items-center justify-between gap-4">
                    <div>
                      <span className="font-display text-lg text-wood-900">{row.recipientName || 'Untitled'}</span>
                      {row.intention && <span className="font-sans text-sm text-wood-500 ml-3">{row.intention}</span>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {row.invoiceToken && <span className="font-label text-[10px] uppercase tracking-[0.14em] text-bronze-600">invoice</span>}
                      <span className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-500">{STATUS_LABEL[row.status] || row.status}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
      </AdminPage>
    );
  }

  return (
    <AdminPage width="medium">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
                The Curation Desk
              </p>
              <h1 className="font-display text-3xl text-wood-900">{viewingId ? `Editing · ${recipientName || 'Viewing'}` : 'Build a Viewing'}</h1>
            </div>
            <button type="button" onClick={() => { setView('list'); loadList(); }} className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-600 hover:text-bronze-700 underline underline-offset-4">
              ← All viewings
            </button>
          </div>

          <ol className="admin-stage-list" aria-label="Viewing stages">
            {viewingStages.map((stage, index) => (
              <li key={stage} className={index < viewingStage ? 'is-complete' : index === viewingStage ? 'is-current' : ''} aria-current={index === viewingStage ? 'step' : undefined}>
                <span>{index + 1}</span>{stage}
              </li>
            ))}
          </ol>

          {/* Intake */}
          <div className="border border-wood-200 bg-white p-5 mb-8">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Recipient name</label>
                <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Daniel" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Intention (frames the recommendation)</label>
                <input value={intention} onChange={(e) => setIntention(e.target.value)} placeholder="a home that feels grounded and alive" className={inputClass} />
              </div>
            </div>

            <div className="mt-4 flex gap-5">
              <button type="button" onClick={() => setMode('chart')} className={`font-label text-[11px] uppercase tracking-[0.16em] ${mode === 'chart' ? 'text-bronze-700' : 'text-wood-500'}`}>
                {mode === 'chart' ? '● ' : '○ '}Enter chart
              </button>
              <button type="button" onClick={() => setMode('birth')} className={`font-label text-[11px] uppercase tracking-[0.16em] ${mode === 'birth' ? 'text-bronze-700' : 'text-wood-500'}`}>
                {mode === 'birth' ? '● ' : '○ '}From birth moment
              </button>
            </div>

            {mode === 'birth' ? (
              <div className="mt-3">
                <label className={labelClass}>Birth moment (UTC, ISO)</label>
                <input value={utcBirth} onChange={(e) => setUtcBirth(e.target.value)} placeholder="1990-06-09T14:30:00Z" className={inputClass} />
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {SPHERE_KEYS.map((k) => (
                  <div key={k}>
                    <label className="font-label text-[10px] uppercase tracking-[0.12em] text-wood-600 block mb-1">{SPHERE_LABELS[k]}</label>
                    <div className="flex gap-1.5">
                      <input type="number" min={0} max={64} value={chart[k].gate || ''} onChange={(e) => setChart((p) => ({ ...p, [k]: { ...p[k], gate: Number(e.target.value) } }))} placeholder="gate" className={`${inputClass} px-2`} />
                      <input type="number" min={1} max={6} value={chart[k].line} onChange={(e) => setChart((p) => ({ ...p, [k]: { ...p[k], line: Number(e.target.value) } }))} placeholder="ln" className={`${inputClass} px-2 w-16`} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <button type="button" onClick={compute} disabled={loading} className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 disabled:opacity-50 transition-colors">
                {loading ? 'Computing…' : 'Compute the chart'}
              </button>
              <input value={engineBase} onChange={(e) => setEngineBase(e.target.value)} className={`${inputClass} max-w-xs text-xs`} title="Recommendation engine base URL" />
              {error && <span className="font-sans text-sm text-red-700">{error}</span>}
            </div>
          </div>

          {/* Reveal + Curate: the chart board */}
          {pieces.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-600">
                  The board · {pieces.length} pieces · {recommendedCount} recommended
                </p>
                <button type="button" onClick={() => setShowPreview((s) => !s)} className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 underline underline-offset-4">
                  {showPreview ? 'Back to the board' : 'Preview the Viewing'}
                </button>
              </div>

              {showPreview ? (
                <div className="border border-wood-200">
                  <Viewing data={viewingData} />
                </div>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-4">
                    {pieces.map((p) => (
                      <BoardCard
                        key={p.code}
                        piece={p}
                        sphere={sphereByCode[p.code] || ''}
                        reason={reasons[p.id] || ''}
                        onChange={(next) => updatePiece(p.code, next)}
                        onToggleRecommend={() => updatePiece(p.code, { recommended: !p.recommended })}
                        onReason={(reason) => setReasons((prev) => ({ ...prev, [p.id]: reason }))}
                      />
                    ))}
                  </div>
                  <div className="mt-6 border border-wood-200 bg-white p-5">
                    <label className={labelClass}>Closing line</label>
                    <input value={closing} onChange={(e) => setClosing(e.target.value)} className={inputClass} />
                  </div>
                </>
              )}

              {/* Deliver */}
              <div className="mt-6 border border-wood-200 bg-white p-5 flex items-center gap-4 flex-wrap">
                <button type="button" onClick={() => save('draft')} disabled={saving} className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-700 border border-wood-300 px-5 py-2.5 hover:bg-paper-100 disabled:opacity-50 transition-colors">
                  {saving ? 'Saving…' : viewingId ? 'Save changes' : 'Save draft'}
                </button>
                <button type="button" onClick={() => save('sent')} disabled={saving} className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 disabled:opacity-50 transition-colors">
                  Send · copy link
                </button>
                {savedNote && <span className="font-sans text-sm text-wood-700">{savedNote}</span>}
                {shareUrl && (
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="font-sans text-sm text-bronze-700 underline underline-offset-4 break-all">
                    {shareUrl}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
    </AdminPage>
  );
};

export default AdminViewings;
