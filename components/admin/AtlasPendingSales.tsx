import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FULL_ARCHIVE } from '../../data/mockData';
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection } from './AdminPage';

/**
 * Admin viewer for the atlas_sale_events queue — the pending-sale bridge a
 * Stripe checkout writes into (functions/api/_lib/atlasSale.js), confirmed
 * here via functions/api/admin/atlas-sales/[id].js. This is the first place
 * that queue has been readable anywhere since the mandalacodes admin list
 * (its old home) moved behind the atlas 410 boundary on 2026-08-09.
 *
 * Confirm only: no reject, no edit. A dismiss/edit surface is a deliberate
 * follow-up, not built here.
 */

interface SaleQueueItem {
  saleId: string;
  sku: string | null;
  pieceId: string | null;
  editionNumber: number | null;
  buyerEmail: string;
  buyerName: string | null;
  saleDate: string;
  priceCents: number | null;
  currency: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  receivedAt: number;
  confirmedAt: number | null;
  dismissedReason: string | null;
}

interface QueueResponse {
  ok: boolean;
  pending?: SaleQueueItem[];
  resolved?: SaleQueueItem[];
  pagination?: { resolved?: { hasMore?: boolean; nextCursor?: string | null } };
  error?: string;
}

interface ConfirmationResult {
  saleId: string;
  pieceId: string;
  editionNumber: number;
  keeperPieceId: string | null;
  registrationStatus: 'registered' | 'pending';
  publicCode?: string;
}

function money(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  const amount = (cents / 100).toFixed(2);
  return currency ? `${currency} ${amount}` : amount;
}

function artworkTitle(pieceId: string | null): string | null {
  if (!pieceId) return null;
  const artwork = FULL_ARCHIVE.find((a) => a.id === pieceId);
  return artwork ? artwork.title.replace(/\s*-\s*\d+$/, '') : null;
}

const ConfirmationSummary: React.FC<{ result: ConfirmationResult }> = ({ result }) => (
  result.registrationStatus === 'registered' ? (
    <p>
      Sale confirmed for <strong>{result.pieceId}</strong> · edition {result.editionNumber}.
      {' '}Linked to canonical identity {result.publicCode}.
    </p>
  ) : (
    <p>
      Sale confirmed for <strong>{result.pieceId}</strong> · edition {result.editionNumber}.
      {' '}No identity was created. <Link to="/admin/register">Complete canonical registration</Link> when the edition facts and backup evidence are ready.
    </p>
  )
);

const PendingRow: React.FC<{
  sale: SaleQueueItem;
  onConfirmed: (result: ConfirmationResult) => void;
}> = ({ sale, onConfirmed }) => {
  const [pieceId, setPieceId] = useState(sale.pieceId ?? sale.sku ?? '');
  const [editionNumber, setEditionNumber] = useState(
    sale.editionNumber != null ? String(sale.editionNumber) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = useCallback(async () => {
    const trimmed = pieceId.trim();
    if (!trimmed) {
      setError('A piece id is required to confirm this sale.');
      return;
    }
    const edition = Number(editionNumber);
    if (!editionNumber.trim() || !Number.isInteger(edition) || edition < 0) {
      setError('Edition must be a whole number, zero or more.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/atlas-sales/${encodeURIComponent(sale.saleId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId: trimmed, editionNumber: edition }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'The confirm did not go through.');
        return;
      }
      onConfirmed(data as ConfirmationResult);
    } catch {
      setError('The confirm did not go through.');
    } finally {
      setBusy(false);
    }
  }, [pieceId, editionNumber, sale.saleId, onConfirmed]);

  return (
    <li className="admin-atlas-sale-row">
      <div className="admin-atlas-sale-row-facts">
        <p className="admin-atlas-sale-row-buyer">{sale.buyerEmail}</p>
        {sale.buyerName && <p className="admin-atlas-sale-row-muted">{sale.buyerName}</p>}
        <p className="admin-atlas-sale-row-muted">
          {new Date(sale.saleDate).toLocaleDateString()} &middot; {money(sale.priceCents, sale.currency)}
        </p>
        {sale.sku && <p className="admin-atlas-sale-row-muted">sku: {sale.sku}</p>}
      </div>
      <div className="admin-atlas-sale-row-action">
        <label>
          Piece id
          <input
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            placeholder={artworkTitle(sale.pieceId) ?? 'e.g. UL-100'}
          />
        </label>
        <label>
          Edition (0 for a unique piece)
          <input
            value={editionNumber}
            onChange={(e) => setEditionNumber(e.target.value)}
            inputMode="numeric"
          />
        </label>
        <button type="button" onClick={() => void confirm()} disabled={busy}>
          {busy ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
      {error && <p className="admin-atlas-sale-row-error">{error}</p>}
    </li>
  );
};

const ResolvedRow: React.FC<{ sale: SaleQueueItem }> = ({ sale }) => {
  const canCheckRegistration = sale.status === 'confirmed'
    && Boolean(sale.pieceId?.trim())
    && Number.isSafeInteger(sale.editionNumber)
    && (sale.editionNumber ?? -1) >= 0
    && (sale.editionNumber ?? 10_000) <= 9999;
  const [registration, setRegistration] = useState<
    { state: 'idle' | 'checking' | 'error' } | { state: 'ready'; result: ConfirmationResult }
  >({ state: canCheckRegistration ? 'checking' : 'idle' });

  const checkRegistration = useCallback(async (signal?: AbortSignal) => {
    if (!canCheckRegistration || !sale.pieceId || sale.editionNumber == null) return;
    setRegistration({ state: 'checking' });
    try {
      const response = await fetch(`/api/admin/atlas-sales/${encodeURIComponent(sale.saleId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId: sale.pieceId, editionNumber: sale.editionNumber }),
        signal,
      });
      const data = await response.json();
      const exactResult = response.ok && data.ok
        && data.saleId === sale.saleId
        && data.pieceId === sale.pieceId
        && data.editionNumber === sale.editionNumber
        && (data.registrationStatus === 'pending'
          || (data.registrationStatus === 'registered' && typeof data.publicCode === 'string' && data.publicCode));
      if (!exactResult) {
        setRegistration({ state: 'error' });
        return;
      }
      setRegistration({ state: 'ready', result: data as ConfirmationResult });
    } catch (error) {
      if ((error as { name?: string })?.name !== 'AbortError') setRegistration({ state: 'error' });
    }
  }, [canCheckRegistration, sale.editionNumber, sale.pieceId, sale.saleId]);

  useEffect(() => {
    if (!canCheckRegistration) {
      setRegistration({ state: 'idle' });
      return undefined;
    }
    const controller = new AbortController();
    void checkRegistration(controller.signal);
    return () => controller.abort();
  }, [canCheckRegistration, checkRegistration]);

  return (
    <li className="admin-atlas-sale-row admin-atlas-sale-row-resolved">
      <div className="admin-atlas-sale-row-facts">
        <p className="admin-atlas-sale-row-buyer">{sale.buyerEmail}</p>
        {registration.state === 'ready' ? (
          <ConfirmationSummary result={registration.result} />
        ) : (
          <p className="admin-atlas-sale-row-muted">
            {sale.status} &middot; {sale.pieceId ?? '—'}
            {sale.editionNumber != null ? ` (edition ${sale.editionNumber})` : ''}
            {registration.state === 'checking' && <> &middot; Checking canonical registration…</>}
          </p>
        )}
        {registration.state === 'error' && (
          <p className="admin-atlas-sale-row-error">
            Canonical registration status could not be checked.{' '}
            <button type="button" onClick={() => void checkRegistration()}>Try again</button>
          </p>
        )}
      </div>
    </li>
  );
};

const AtlasPendingSales: React.FC = () => {
  const [pending, setPending] = useState<SaleQueueItem[] | null>(null);
  const [resolved, setResolved] = useState<SaleQueueItem[]>([]);
  const [resolvedCursor, setResolvedCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmations, setConfirmations] = useState<ConfirmationResult[]>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/atlas-sales', { cache: 'no-store' });
      const data: QueueResponse = await response.json();
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'The pending sales queue did not load.');
        return;
      }
      setPending(data.pending ?? []);
      setResolved(data.resolved ?? []);
      setResolvedCursor(data.pagination?.resolved?.hasMore
        ? data.pagination.resolved.nextCursor ?? null
        : null);
      setLoadMoreError(null);
      setError(null);
    } catch {
      setError('The pending sales queue did not load.');
    }
  }, []);

  const loadMoreResolved = useCallback(async () => {
    if (!resolvedCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const params = new URLSearchParams({ cursor: resolvedCursor });
      const response = await fetch(`/api/admin/atlas-sales?${params}`, { cache: 'no-store' });
      const data: QueueResponse = await response.json();
      if (!response.ok || !data.ok) {
        setLoadMoreError('More resolved sales could not be loaded.');
        return;
      }
      setResolved((current) => {
        const seen = new Set(current.map((sale) => sale.saleId));
        return [...current, ...(data.resolved ?? []).filter((sale) => !seen.has(sale.saleId))];
      });
      setResolvedCursor(data.pagination?.resolved?.hasMore
        ? data.pagination.resolved.nextCursor ?? null
        : null);
    } catch {
      setLoadMoreError('More resolved sales could not be loaded.');
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, resolvedCursor]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirmed = useCallback(
    (result: ConfirmationResult) => {
      setConfirmations((current) => [
        result,
        ...current.filter((item) => item.saleId !== result.saleId),
      ]);
      setPending((current) => (current ?? []).filter((s) => s.saleId !== result.saleId));
      void load();
    },
    [load],
  );

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Atlas"
        title="Pending sales"
        description="Sales that arrived from checkout and are waiting to be matched to an artwork and edition. Confirmation links a complete registered identity when one exists. Otherwise the sale stays confirmed while canonical registration remains to be done."
      />
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      <AdminSection title="Waiting">
        {confirmations.length > 0 && (
          <ul className="admin-atlas-sale-list">
            {confirmations.map((result) => (
              <li key={result.saleId} className="admin-atlas-sale-row admin-atlas-sale-row-done">
                <ConfirmationSummary result={result} />
              </li>
            ))}
          </ul>
        )}
        {pending === null ? (
          <p>Loading…</p>
        ) : pending.length === 0 ? (
          <AdminEmptyState
            title="Nothing waiting"
            description="Every sale that has come through checkout is already confirmed or resolved."
          />
        ) : (
          <ul className="admin-atlas-sale-list">
            {pending.map((sale) => (
              <PendingRow key={sale.saleId} sale={sale} onConfirmed={handleConfirmed} />
            ))}
          </ul>
        )}
      </AdminSection>
      {resolved.length > 0 && (
        <AdminSection title="Recently resolved">
          <ul className="admin-atlas-sale-list">
            {resolved.map((sale) => (
              confirmations.some((result) => result.saleId === sale.saleId)
                ? null
                : <ResolvedRow key={sale.saleId} sale={sale} />
            ))}
          </ul>
          {loadMoreError && (
            <p className="admin-atlas-sale-row-error">{loadMoreError}</p>
          )}
          {resolvedCursor && (
            <button type="button" onClick={() => void loadMoreResolved()} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : loadMoreError ? 'Try loading more again' : 'Load more'}
            </button>
          )}
        </AdminSection>
      )}
    </AdminPage>
  );
};

export default AtlasPendingSales;
