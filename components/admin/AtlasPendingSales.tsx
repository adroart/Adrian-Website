import React, { useCallback, useEffect, useState } from 'react';
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
  error?: string;
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

const PendingRow: React.FC<{
  sale: SaleQueueItem;
  onConfirmed: (saleId: string) => void;
}> = ({ sale, onConfirmed }) => {
  const [pieceId, setPieceId] = useState(sale.pieceId ?? sale.sku ?? '');
  const [editionNumber, setEditionNumber] = useState(
    sale.editionNumber != null ? String(sale.editionNumber) : '0',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const confirm = useCallback(async () => {
    const trimmed = pieceId.trim();
    if (!trimmed) {
      setError('A piece id is required to confirm this sale.');
      return;
    }
    const edition = Number(editionNumber);
    if (!Number.isInteger(edition) || edition < 0) {
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
      if (data.recoveryCode) setRecoveryCode(data.recoveryCode);
      onConfirmed(sale.saleId);
    } catch {
      setError('The confirm did not go through.');
    } finally {
      setBusy(false);
    }
  }, [pieceId, editionNumber, sale.saleId, onConfirmed]);

  if (recoveryCode) {
    return (
      <li className="admin-atlas-sale-row admin-atlas-sale-row-done">
        <p>
          Confirmed. A new piece record was registered for <strong>{pieceId}</strong> — this
          recovery code exists only here, once. Copy it and send it to the collector:
        </p>
        <code>{recoveryCode}</code>
      </li>
    );
  }

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
          Edition
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

const ResolvedRow: React.FC<{ sale: SaleQueueItem }> = ({ sale }) => (
  <li className="admin-atlas-sale-row admin-atlas-sale-row-resolved">
    <div className="admin-atlas-sale-row-facts">
      <p className="admin-atlas-sale-row-buyer">{sale.buyerEmail}</p>
      <p className="admin-atlas-sale-row-muted">
        {sale.status} &middot; {sale.pieceId ?? '—'}
        {sale.editionNumber != null ? ` (edition ${sale.editionNumber})` : ''}
      </p>
    </div>
  </li>
);

const AtlasPendingSales: React.FC = () => {
  const [pending, setPending] = useState<SaleQueueItem[] | null>(null);
  const [resolved, setResolved] = useState<SaleQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
    } catch {
      setError('The pending sales queue did not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirmed = useCallback(
    (saleId: string) => {
      setPending((current) => (current ?? []).filter((s) => s.saleId !== saleId));
      void load();
    },
    [load],
  );

  return (
    <AdminPage width="medium">
      <AdminPageHeader
        eyebrow="Atlas"
        title="Pending sales"
        description="Sales that arrived from the checkout flow and are waiting to be confirmed into a piece record. Confirming registers the piece if it is not already registered, and hands you a one-time recovery code to send the collector."
      />
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      <AdminSection title="Waiting">
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
              <ResolvedRow key={sale.saleId} sale={sale} />
            ))}
          </ul>
        </AdminSection>
      )}
    </AdminPage>
  );
};

export default AtlasPendingSales;
