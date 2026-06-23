/**
 * Register a Piece, the artist's Living Legacy desk.
 *
 * Pick a physical piece, generate its recovery code, see the code ONCE to print
 * on the back of the art, and the system stores only the code's fingerprint
 * (a SHA-256 hash). After that the piece is claimable by whoever scans the QR
 * and enters the printed code.
 *
 * The plaintext recovery code is shown exactly once, right after registering.
 * It is never stored in plaintext, never logged, and never shown again. If it is
 * lost before a keeper claims the piece, re-register to mint a fresh code (which
 * voids the old printed one).
 *
 * Auth + chrome come from AdminLayout, the same gate every admin page uses: an
 * unauthed visitor is bounced to /admin/login. Design system is paper / wood /
 * stone / bronze with Cinzel titles, Cormorant body, Lato labels. No icons, no
 * badges, no em dashes.
 */
import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { FULL_ARCHIVE } from '../data/mockData';

const inputClass =
  'w-full border border-wood-300 bg-white px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const labelClass =
  'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';

interface PieceRow {
  id: string;
  pieceId: string;
  editionNumber: number;
  keeperBound: boolean;
  currentDisplayLocation: string | null;
  registeredAt: string | null;
  claimedAt: string | null;
  releasedAt: string | null;
}

/** Map a piece id to a human title for the table + dropdown. */
const TITLE_BY_ID: Record<string, string> = Object.fromEntries(
  FULL_ARCHIVE.map((a) => [a.id, a.title]),
);

function titleFor(pieceId: string): string {
  return TITLE_BY_ID[pieceId] || pieceId;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const AdminPieces: React.FC = () => {
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [pieceId, setPieceId] = useState('');
  const [editionNumber, setEditionNumber] = useState('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState('');

  // The freshly minted code, shown exactly once. Cleared when the artist starts
  // a new registration or dismisses it.
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuedFor, setIssuedFor] = useState('');
  const [issuedNote, setIssuedNote] = useState('');
  const [copied, setCopied] = useState(false);

  const sortedPieces = useMemo(
    () =>
      [...FULL_ARCHIVE].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      ),
    [],
  );

  const loadList = async () => {
    setListLoading(true);
    try {
      const res = await fetch('/api/admin/pieces');
      const d = await res.json().catch(() => ({}));
      if (d?.ok) setRows(d.pieces as PieceRow[]);
    } finally {
      setListLoading(false);
    }
  };
  useEffect(() => {
    loadList();
  }, []);

  const register = async () => {
    if (!pieceId) {
      setError('Pick a piece first.');
      return;
    }
    setRegistering(true);
    setError('');
    setIssuedCode(null);
    setCopied(false);
    try {
      const res = await fetch('/api/admin/pieces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceId,
          editionNumber: editionNumber.trim() ? Number(editionNumber) : 0,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.ok) {
        throw new Error(d?.message || d?.error || `register failed (${res.status})`);
      }
      setIssuedCode(d.recoveryCode as string);
      setIssuedFor(titleFor(pieceId));
      setIssuedNote(d.message || '');
      setPieceId('');
      setEditionNumber('');
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not register the piece.');
    } finally {
      setRegistering(false);
    }
  };

  const copyCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard?.writeText(issuedCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-paper-50 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-2">
            Living Legacy
          </p>
          <h1 className="font-title text-3xl md:text-4xl text-wood-900 mb-3">Register a Piece</h1>
          <p className="font-serif text-wood-600 leading-relaxed mb-10 max-w-2xl">
            Pick a physical piece and generate its recovery code. You see the code once, to print on
            the back of the art. The system keeps only the code's fingerprint. After that the piece is
            claimable by whoever scans it and enters the code.
          </p>

          {/* The freshly minted code, shown exactly once. */}
          {issuedCode && (
            <div className="border border-bronze-500 bg-bronze-200/20 p-6 mb-10">
              <p className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 font-semibold mb-2">
                Recovery code · {issuedFor}
              </p>
              <p className="font-title text-2xl md:text-4xl text-wood-900 tracking-[0.18em] break-all mb-4">
                {issuedCode}
              </p>
              <p className="font-serif text-wood-700 leading-relaxed mb-5 max-w-2xl">
                {issuedNote ||
                  'Print this code on the back of the art. It will not be shown again.'}{' '}
                Write it down or print it now. The site never stores the code itself, only its
                fingerprint, so there is no way to look it up later.
              </p>
              <div className="flex items-center gap-5 flex-wrap">
                <button
                  type="button"
                  onClick={copyCode}
                  className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 transition-colors"
                >
                  {copied ? 'Copied' : 'Copy the code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIssuedCode(null);
                    setCopied(false);
                  }}
                  className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-500 hover:text-wood-900 underline underline-offset-4"
                >
                  I have it, hide this
                </button>
              </div>
            </div>
          )}

          {/* Register form */}
          <div className="border border-wood-200 bg-white p-5 mb-12">
            <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
              <div>
                <label className={labelClass} htmlFor="piece-select">
                  Piece
                </label>
                <select
                  id="piece-select"
                  value={pieceId}
                  onChange={(e) => setPieceId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Choose a piece</option>
                  {sortedPieces.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} · {a.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:w-32">
                <label className={labelClass} htmlFor="edition-input">
                  Edition (optional)
                </label>
                <input
                  id="edition-input"
                  type="number"
                  min={0}
                  value={editionNumber}
                  onChange={(e) => setEditionNumber(e.target.value)}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={register}
                disabled={registering}
                className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 border border-bronze-500 px-5 py-2.5 hover:bg-bronze-200 disabled:opacity-50 transition-colors"
              >
                {registering ? 'Registering…' : 'Register this piece'}
              </button>
              {error && <span className="font-sans text-sm text-red-700">{error}</span>}
            </div>
          </div>

          {/* Registered pieces */}
          <h2 className="font-title text-xl text-wood-900 mb-4">Registered pieces</h2>
          {listLoading && rows.length === 0 ? (
            <p className="font-sans text-sm text-wood-500">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="border border-wood-200 bg-white p-8 text-center">
              <p className="font-serif text-wood-600">
                No pieces registered yet. Register the first one above.
              </p>
            </div>
          ) : (
            <div className="border border-wood-200 bg-white divide-y divide-wood-200">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
                >
                  <div>
                    <span className="font-serif text-lg text-wood-900">
                      {titleFor(row.pieceId)}
                    </span>
                    <span className="font-sans text-sm text-wood-400 ml-3">
                      {row.pieceId}
                      {row.editionNumber ? ` · edition ${row.editionNumber}` : ''}
                    </span>
                    {row.currentDisplayLocation && (
                      <span className="font-sans text-sm text-wood-500 ml-3">
                        · {row.currentDisplayLocation}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-5 shrink-0">
                    <span className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-500">
                      {row.keeperBound ? 'Claimed' : 'Awaiting a keeper'}
                    </span>
                    {row.registeredAt && (
                      <span className="font-sans text-xs text-wood-400">
                        {formatDate(row.registeredAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPieces;
