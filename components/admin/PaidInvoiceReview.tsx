import './StudioSalesControls.css';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FULL_ARCHIVE } from '../../data/mockData';
import { formatMoney, parseMoneyToCents } from '../invoices/invoiceUtils';
import { useRegistryUnlock } from '../registry/useRegistryUnlock';
import { AdminAlert, AdminPage, AdminPageHeader, AdminSection } from './AdminPage';

type LinkedSale = { saleId: string; artworkRecordId: string; keeperPieceId: string | null };
type Invoice = {
  number: string; title: string; description: string; buyerName: string; buyerEmail: string;
  currency: string; totalCents: number; paidDate: string; revision: string; shipping: string;
  lineItems: { description: string; terms: string; hasVariants: boolean; amountCents: number | null }[];
};
type Review = { invoice: Invoice; linkedSale: LinkedSale | null; invoiceChangedSinceLink: boolean };
type Confirmation = {
  revision: string; artworkId: string; edition: { kind: 'unique' } | { kind: 'numbered'; number: number };
  saleDate: string; artworkPriceCents: number | null; singleArtwork: true;
};
const label = 'block font-body text-sm font-semibold text-wood-800';
const input = 'mt-1 block min-h-[var(--control-h)] w-full border border-wood-300 bg-paper-50 px-3 py-2 font-body text-base text-wood-900';
const link = 'font-body font-semibold text-bronze-800 underline underline-offset-4';
const catalog = [...FULL_ARCHIVE].sort((a, b) => a.title.localeCompare(b.title));

const messages: Record<string, string> = {
  registry_unlock_not_configured: 'Registry unlock is unavailable. Contact the Studio administrator.',
  invoice_not_found: 'This invoice could not be found.',
  invoice_not_paid: 'The invoice needs a recorded payment covering its full balance before you can review the sale.',
  invoice_changed: 'The invoice changed. Reload the review and confirm the latest details.',
  artwork_record_ambiguous: 'More than one record can match this edition, or its existing identity is unavailable. Resolve it in Artworks before linking the invoice.',
  existing_invoice_reference: 'A Verified Sale already names this invoice. Check that record before recording another sale.',
  invoice_sale_conflict: 'This invoice already has a verified sale. Reload the review to open it.',
  artwork_not_found: 'This artwork ID was not found in the catalog or registry.',
  invalid_edition: 'That edition does not match the artwork’s registry details.',
  invalid_request: 'Check the artwork, edition, date and optional artwork price.',
};

class ReviewRequestError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(messages[code || ''] || 'The review could not be completed. Retry to check whether it saved.');
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) {
    throw new ReviewRequestError(response.status, body?.error);
  }
  return body as T;
}

function isRegistryLocked(error: unknown) {
  return error instanceof ReviewRequestError && error.status === 403 && error.code === 'registry_locked';
}

const PaidInvoiceReview: React.FC = () => {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  return <ReviewForm key={invoiceId} invoiceId={invoiceId ?? ''} />;
};

function ReviewForm({ invoiceId }: { invoiceId: string }) {
  const endpoint = `/api/admin/collector-sales/invoices/${encodeURIComponent(invoiceId)}`;
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [choice, setChoice] = useState('');
  const [customId, setCustomId] = useState('');
  const [kind, setKind] = useState<'' | 'unique' | 'numbered'>('');
  const [editionNumber, setEditionNumber] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [artworkPrice, setArtworkPrice] = useState('');
  const [attempt, setAttempt] = useState<Confirmation | null>(null);
  const [singleArtwork, setSingleArtwork] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const submitting = useRef(false);
  const { unlock, markLost } = useRegistryUnlock(() => {
    if (!review?.linkedSale) setLocked(true);
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setReview(null); setAttempt(null);
    fetch(endpoint, { credentials: 'same-origin', signal: controller.signal })
      .then(readResponse<Review>)
      .then(value => { setReview(value); setSaleDate(value.invoice.paidDate); })
      .catch(failure => {
        if (controller.signal.aborted) return;
        if (isRegistryLocked(failure)) {
          markLost();
          setLocked(true);
        } else {
          setError(failure.message);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, retry, markLost]);

  const invoice = review?.invoice;
  const artworkId = choice === 'custom' ? customId.trim().toUpperCase() : choice;
  const artwork = catalog.find(item => item.id === artworkId);

  async function unlockReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unlocking) return;
    const secret = new FormData(event.currentTarget).get('registrySecret');
    if (typeof secret !== 'string' || !secret) return;
    setUnlocking(true);
    setUnlockError('');
    const opened = await unlock(secret);
    setUnlocking(false);
    if (!opened) {
      setUnlockError('The registry did not open. Check the registry secret and try again.');
      return;
    }
    setLocked(false);
    if (!review) setRetry(value => value + 1);
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (!invoice || locked || submitting.current || !kind || !artworkId || !singleArtwork) return;
    const payload = attempt ?? {
      revision: invoice.revision, artworkId, singleArtwork: true as const,
      edition: kind === 'unique' ? { kind } as const : { kind, number: Number(editionNumber) } as const,
      saleDate, artworkPriceCents: artworkPrice.trim() ? parseMoneyToCents(artworkPrice) : null,
    };
    submitting.current = true;
    setBusy(true); setError(''); setAttempt(payload);
    try {
      const { result } = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(readResponse<{ result: LinkedSale }>);
      setReview({ invoice, linkedSale: result, invoiceChangedSinceLink: false });
      setAttempt(null);
    } catch (failure) {
      if (isRegistryLocked(failure)) {
        markLost();
        setLocked(true);
        // Keep an earlier uncertain attempt frozen until its outcome is known.
        if (!attempt) setAttempt(null);
      } else {
        if (failure instanceof ReviewRequestError && failure.status >= 400 && failure.status < 500) setAttempt(null);
        setError(failure instanceof ReviewRequestError
          ? failure.message
          : 'The result is uncertain. Retry the same confirmation to check whether it saved.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <AdminPage width="medium">
      <div className="studio-sales-controls">
    <AdminPageHeader eyebrow="Verified Sales" title="Review sale" actions={
      <Link className={link} to={`/admin/invoices?invoiceId=${encodeURIComponent(invoiceId)}`}>Back to invoice</Link>
    } />
    {loading && <p role="status">Loading paid invoice…</p>}
    {error && <AdminAlert tone="error">{error} <button type="button" className={link} disabled={busy} onClick={() => setRetry(value => value + 1)}>Reload review</button></AdminAlert>}
    {locked && <AdminSection title="Unlock the private registry">
      <form className="space-y-3" onSubmit={unlockReview}>
        {review && <p className="font-body text-sm text-wood-800">Your confirmation is still here. Unlock to continue.</p>}
        {unlockError && <AdminAlert tone="error" live>{unlockError}</AdminAlert>}
        <label className={`${label} max-w-xs`}>Registry secret
          <input className={input} type="password" name="registrySecret" autoComplete="off" required autoFocus disabled={unlocking} />
        </label>
        <button type="submit" className="studio-sales-primary" disabled={unlocking}>{unlocking ? 'Unlocking…' : 'Unlock registry'}</button>
      </form>
    </AdminSection>}
    {review?.invoiceChangedSinceLink && <AdminAlert tone="warning">The invoice has changed since this sale was linked. Open Verified Sales to see the recorded facts.</AdminAlert>}
    {invoice && <AdminSection title={`${invoice.number} · ${invoice.title}`}>
      <p className="font-body text-sm text-wood-800">{invoice.buyerName}{invoice.buyerEmail && ` · ${invoice.buyerEmail}`} · {review?.invoiceChangedSinceLink ? 'Current invoice total' : 'Paid'} {formatMoney(invoice.totalCents, invoice.currency)} {invoice.currency}</p>
      {invoice.description && <p className="mt-2 whitespace-pre-wrap font-body text-sm text-wood-700">{invoice.description}</p>}
      <ul className="mt-3 divide-y divide-wood-200 font-body text-sm text-wood-800">
        {invoice.lineItems.map((item, index) => <li key={index} className="flex justify-between gap-3 py-1.5"><span>{item.description}{item.terms && <small className="block">{item.terms}</small>}{item.hasVariants && <small className="block">Options were offered. Confirm the agreed piece and edition from your correspondence.</small>}</span>{!item.hasVariants && item.amountCents !== null && <span className="shrink-0">{formatMoney(item.amountCents, invoice.currency)}</span>}</li>)}
      </ul>
      {invoice.shipping && <p className="mt-2 font-body text-sm text-wood-700">Shipping · {invoice.shipping}</p>}
    </AdminSection>}
    {review?.linkedSale && <AdminSection title="Verified sale linked">
      <p className="mb-3">{review.linkedSale.keeperPieceId ? 'The matching artwork identity is linked.' : 'The artwork and edition are recorded. Register its physical identity from Verified Sales when ready.'}</p>
      <Link className={link} to={`/admin/collector-sales?${new URLSearchParams({ saleId: review.linkedSale.saleId })}`}>Open verified sale</Link>
    </AdminSection>}
    {invoice && !review?.linkedSale && <AdminSection title="Confirm artwork and edition" description="An existing identity for the selected artwork and edition will be linked. For invoices with several artworks, use Verified Sales to record each piece.">
      <form className="space-y-4" onSubmit={confirm}>
        <fieldset className="space-y-4" disabled={locked || busy || Boolean(attempt)}>
          <label className={label}>Artwork<select className={input} value={choice} required onChange={event => {
            setChoice(event.target.value); setKind(''); setEditionNumber('');
          }}><option value="">Choose the artwork</option>{catalog.map(item => <option key={item.id} value={item.id}>{item.title} · {item.id}</option>)}<option value="custom">Enter a registry artwork ID</option></select></label>
          {choice === 'custom' && <label className={label}>Registry artwork ID<input className={input} required value={customId} maxLength={7} onChange={event => setCustomId(event.target.value)} /></label>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Edition type<select className={input} required value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="">Choose edition type</option><option value="unique">Unique work</option><option value="numbered">Numbered edition</option></select></label>
            {kind === 'numbered' && <label className={label}>Edition number<input className={input} type="number" min="1" max="9999" required value={editionNumber} onChange={event => setEditionNumber(event.target.value)} /></label>}
            <label className={label}>Sale date<input className={input} type="date" required value={saleDate} onChange={event => setSaleDate(event.target.value)} /></label>
            <label className={label}>Artwork price, excluding shipping (optional)<input className={input} type="number" min="0" step="0.01" value={artworkPrice} onChange={event => setArtworkPrice(event.target.value)} /></label>
          </div>
          <label className="flex min-h-[var(--control-h)] items-center gap-3 font-body text-sm text-wood-800"><input type="checkbox" className="size-5" required checked={singleArtwork} onChange={event => setSingleArtwork(event.target.checked)} />This invoice covers one artwork.</label>
        </fieldset>
        {artworkId && kind && <p className="font-body text-sm text-wood-800">Confirm {artwork?.title || artworkId} · {kind === 'unique' ? 'unique work' : `edition ${editionNumber || '…'}`}.</p>}
        <button className="studio-sales-primary" type="submit" disabled={locked || busy}>{busy ? 'Saving…' : attempt ? 'Retry same confirmation' : 'Confirm and link sale'}</button>
      </form>
    </AdminSection>}
  </div>
    </AdminPage>;
}

export default PaidInvoiceReview;
