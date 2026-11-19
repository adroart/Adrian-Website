import './admin/StudioSalesControls.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AdminAlert, AdminPage } from './admin/AdminPage';
import { exactAdminPageSelection } from './admin/adminMode';
import type {
  Invoice,
  InvoiceDraft,
  InvoiceLineItem,
  PaymentMethod,
  PaymentPreset,
  PaymentTermMode,
} from './invoices/invoiceTypes';
import {
  PAYMENT_TERM_LABELS,
  amountDueAtMilestone,
  buildPaymentSchedule,
  centsToInput,
  formatMoney,
  inferPaymentTermMode,
  lineItemsTotal,
  methodLabel,
  parseMoneyToCents,
  publicInvoiceUrl,
} from './invoices/invoiceUtils';

function ReviewSaleLink({ invoice }: { invoice: Invoice }) {
  if (invoice.status !== 'paid' || invoice.totalCents <= 0
    || invoice.amountPaidCents !== invoice.totalCents || !invoice.paidAt) return null;
  return <Link to={`/admin/collector-sales/invoices/${invoice.id}`}
    className="studio-sales-secondary mt-2">
    Review sale
  </Link>;
}

const EMPTY_LINE_ITEM: InvoiceLineItem = {
  description: 'Commissioned artwork',
  terms: '',
  amountCents: 0,
};

const EMPTY_DRAFT: InvoiceDraft = {
  status: 'draft',
  clientName: '',
  clientEmail: '',
  clientLocation: '',
  jobTitle: '',
  jobDescription: '',
  currency: 'USD',
  lineItems: [{ ...EMPTY_LINE_ITEM }],
  paymentSchedule: buildPaymentSchedule(0, 'single'),
  currentStepIndex: 0,
  shippingText: 'To be confirmed',
  paymentPresetIds: [],
  notes: '',
  offerPaymentChoice: false,
};

const EMPTY_PRESET = {
  label: '',
  method: 'wise' as PaymentMethod,
  currency: 'USD',
  instructions: '',
  details: '',
  url: '',
  isDefault: false,
  isActive: true,
};

const inputClass = 'input placeholder:text-wood-400';
const textareaClass = `${inputClass} min-h-[96px] resize-y leading-relaxed`;
const labelClass = 'font-label text-label uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
const PAYMENT_METHOD_ORDER: Record<string, number> = { wise: 1, crypto: 2, bank: 3 };

function sortPaymentPresets(presets: PaymentPreset[]): PaymentPreset[] {
  return [...presets].sort((a, b) => (
    Number(b.isDefault) - Number(a.isDefault) ||
    (PAYMENT_METHOD_ORDER[a.method] || 9) - (PAYMENT_METHOD_ORDER[b.method] || 9) ||
    a.label.localeCompare(b.label)
  ));
}

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const error = data?.error || `request_failed_${res.status}`;
    throw new Error(error);
  }
  return data as T;
}

const errorCopy: Record<string, string> = {
  unauthorized: 'Sign in again to continue.',
  db_not_configured: 'The D1 database is not connected yet. The page is ready, but saving needs Cloudflare D1 enabled.',
  payment_options_required: 'Select at least one payment option.',
  line_items_required: 'Add at least one invoice line item with an amount.',
  payment_schedule_required: 'Choose a payment schedule.',
  job_description_required: 'Add the description of the job.',
  job_title_required: 'Add a job title.',
  client_name_required: 'Add the client name.',
  payment_required: 'Use Record payment to mark an invoice paid.',
  invoice_changed_or_locked: 'This invoice changed or its payment terms are locked. Reload the saved invoice before continuing.',
  accepted_quote_locked: 'This invoice uses the agreed artwork price and configuration. Start a new quote for a different agreement.',
  invoice_not_ready_to_share: 'Refresh the invoice and check that its saved amount, schedule, and payment options are complete.',
};

function niceError(error: unknown): string {
  const key = error instanceof Error ? error.message : String(error);
  return errorCopy[key] || key || 'Something went wrong.';
}

async function copyLink(url: string): Promise<boolean> {
  if (!url || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

function invoiceToDraft(invoice: Invoice): InvoiceDraft {
  return {
    status: invoice.status,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientLocation: invoice.clientLocation,
    jobTitle: invoice.jobTitle,
    jobDescription: invoice.jobDescription,
    currency: invoice.currency,
    lineItems: invoice.lineItems.length ? invoice.lineItems : [{ ...EMPTY_LINE_ITEM }],
    paymentSchedule: invoice.paymentSchedule,
    currentStepIndex: invoice.currentStepIndex,
    shippingText: invoice.shippingText,
    paymentPresetIds: invoice.paymentPresetIds.length ? invoice.paymentPresetIds : invoice.paymentPresetId ? [invoice.paymentPresetId] : [],
    notes: invoice.notes,
    offerPaymentChoice: Boolean(invoice.offerPaymentChoice),
  };
}

const AdminInvoices: React.FC = () => {
  const [searchParams] = useSearchParams();
  const pageSelection = exactAdminPageSelection(searchParams, 'invoiceId');
  const creatingFromShortcut = pageSelection.kind === 'create';
  const linkedInvoiceId = pageSelection.kind === 'exact' ? pageSelection.id : null;
  const selectedFromUrlRef = useRef<number | null>(null);
  const [presets, setPresets] = useState<PaymentPreset[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [draft, setDraft] = useState<InvoiceDraft>(EMPTY_DRAFT);
  const [presetForm, setPresetForm] = useState(EMPTY_PRESET);
  const [termMode, setTermMode] = useState<PaymentTermMode>('single');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [exactInvoiceLoading, setExactInvoiceLoading] = useState(false);
  const [exactInvoiceResult, setExactInvoiceResult] = useState<{
    requestId: number;
    invoice: Invoice | null;
    error: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [presetSaving, setPresetSaving] = useState(false);
  const [paymentBusyId, setPaymentBusyId] = useState<number | null>(null);
  const paymentAttemptRef = useRef<Record<number, {
    key: string; paidCents: number; expectedCurrency: string; expectedTotalCents: number;
  }>>({});
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const paidCents = savedInvoice?.amountPaidCents ?? 0;
  const paymentLocked = paidCents > 0;
  const sourceQuote = savedInvoice?.sourceQuote;
  const lineTotal = lineItemsTotal(draft.lineItems);
  const totalCents = savedInvoice && (paymentLocked || lineTotal === savedInvoice.subtotalCents)
    ? savedInvoice.totalCents : lineTotal;
  const paymentSchedule = savedInvoice && (paymentLocked || (
    termMode === inferPaymentTermMode(savedInvoice.paymentSchedule) && totalCents === savedInvoice.totalCents
    && savedInvoice.paymentSchedule.length > 0
  )) ? savedInvoice.paymentSchedule : buildPaymentSchedule(totalCents, termMode);
  const stepIndex = Math.min(draft.currentStepIndex, Math.max(0, paymentSchedule.length - 1));
  const currentStep = paymentSchedule[stepIndex];
  const dueTodayCents = currentStep?.amountCents ?? totalCents;
  const milestoneDue = paymentLocked ? amountDueAtMilestone(totalCents, paidCents, paymentSchedule, stepIndex) : dueTodayCents;
  const editingDraft = { ...draft, paymentSchedule, currentStepIndex: stepIndex };
  const dirty = !!savedInvoice && JSON.stringify(editingDraft) !== JSON.stringify(invoiceToDraft(savedInvoice));
  const busy = saving || paymentBusyId !== null;
  const enoughToShare = !!savedInvoice && savedInvoice.totalCents > 0 && savedInvoice.paymentSchedule.length > 0
    && (!sourceQuote || savedInvoice.paymentOptions.length > 0);
  const shareReady = !!savedInvoice && enoughToShare && savedInvoice.status !== 'void' && !dirty && !busy;

  const selectedPresets = useMemo(
    () => presets.filter(preset => draft.paymentPresetIds.includes(preset.id)),
    [draft.paymentPresetIds, presets],
  );

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [presetData, invoiceData] = await Promise.all([
        fetch('/api/admin/payment-presets').then(res => readJson<{ ok: boolean; presets: PaymentPreset[] }>(res)),
        fetch('/api/admin/invoices?limit=30').then(res => readJson<{ ok: boolean; invoices: Invoice[] }>(res)),
      ]);
      const nextPresets = sortPaymentPresets(presetData.presets || []);
      setPresets(nextPresets);
      setInvoices(invoiceData.invoices || []);
      if (!draft.paymentPresetIds.length) {
        const presetIds = nextPresets.map(preset => preset.id);
        if (presetIds.length) setDraft(prev => prev.paymentPresetIds.length ? prev : { ...prev, paymentPresetIds: presetIds });
      }
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (linkedInvoiceId === null) {
      setExactInvoiceResult(null);
      setExactInvoiceLoading(false);
      return;
    }
    const controller = new AbortController();
    setExactInvoiceLoading(true);
    setExactInvoiceResult(null);
    setEditingId(null);
    setSavedInvoice(null);
    setDraft({ ...EMPTY_DRAFT, paymentPresetIds: presets.map(preset => preset.id) });
    void fetch(`/api/admin/invoices?invoiceId=${encodeURIComponent(String(linkedInvoiceId))}`, {
      cache: 'no-store', signal: controller.signal,
    })
      .then(response => readJson<{ ok: boolean; invoices: Invoice[] }>(response))
      .then(data => {
        if (controller.signal.aborted) return;
        const exact = data.invoices || [];
        if (exact.length > 1) throw new Error('invalid_response');
        setExactInvoiceResult({ requestId: linkedInvoiceId, invoice: exact[0] || null, error: null });
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        setExactInvoiceResult({ requestId: linkedInvoiceId, invoice: null, error: niceError(error) });
      })
      .finally(() => {
        if (!controller.signal.aborted) setExactInvoiceLoading(false);
      });
    return () => controller.abort();
  }, [linkedInvoiceId]);

  const updateDraft = <K extends keyof InvoiceDraft>(field: K, value: InvoiceDraft[K]) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (index: number, patch: Partial<InvoiceLineItem>) => {
    setDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
  };

  // What the user is actively typing in each amount field, by index. While a
  // field is being edited we show the raw text, so the input never reformats
  // mid-keystroke and traps the caret. On blur we normalize to cents.
  const [amountEdits, setAmountEdits] = useState<Record<number, string>>({});

  const onAmountChange = (index: number, raw: string) => {
    // Allow only digits and a single decimal point while typing.
    const cleaned = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmountEdits(prev => ({ ...prev, [index]: cleaned }));
    updateLineItem(index, { amountCents: parseMoneyToCents(cleaned) });
  };

  const onAmountBlur = (index: number) => {
    setAmountEdits(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addLineItem = () => {
    setDraft(prev => ({ ...prev, lineItems: [...prev.lineItems, { ...EMPTY_LINE_ITEM, description: '' }] }));
  };

  const removeLineItem = (index: number) => {
    setDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.length === 1
        ? [{ ...EMPTY_LINE_ITEM }]
        : prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  // Size variants on a line item. When present, the buyer picks one on the
  // public invoice and the chosen price drives the total; the line's amount
  // tracks the first variant.
  const addVariant = (lineIndex: number) => {
    setDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) =>
        i === lineIndex ? { ...item, variants: [...(item.variants || []), { label: '', amountCents: 0 }] } : item,
      ),
    }));
  };
  const updateVariant = (lineIndex: number, vIndex: number, patch: Partial<{ label: string; amountCents: number }>) => {
    setDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => {
        if (i !== lineIndex) return item;
        const variants = (item.variants || []).map((v, vi) => (vi === vIndex ? { ...v, ...patch } : v));
        return { ...item, variants, amountCents: variants[0]?.amountCents ?? item.amountCents };
      }),
    }));
  };
  const removeVariant = (lineIndex: number, vIndex: number) => {
    setDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => {
        if (i !== lineIndex) return item;
        const variants = (item.variants || []).filter((_, vi) => vi !== vIndex);
        return { ...item, variants: variants.length ? variants : undefined };
      }),
    }));
  };

  const togglePaymentPreset = (id: number) => {
    setDraft(prev => {
      const exists = prev.paymentPresetIds.includes(id);
      return {
        ...prev,
        paymentPresetIds: exists
          ? prev.paymentPresetIds.filter(item => item !== id)
          : [...prev.paymentPresetIds, id],
      };
    });
  };

  const savePreset = async () => {
    if (!presetForm.label.trim()) {
      setMessage({ type: 'err', text: 'Add a label for the payment option.' });
      return;
    }
    if (!presetForm.instructions.trim() && !presetForm.details.trim() && !presetForm.url.trim()) {
      setMessage({ type: 'err', text: 'Add instructions, account details, or a payment link.' });
      return;
    }

    setPresetSaving(true);
    setMessage(null);
    try {
      const data = await fetch('/api/admin/payment-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(presetForm),
      }).then(res => readJson<{ ok: boolean; preset: PaymentPreset }>(res));

      setPresetForm(EMPTY_PRESET);
      setPresets(prev => sortPaymentPresets([
        ...prev.map(preset => data.preset.isDefault ? { ...preset, isDefault: false } : preset),
        data.preset,
      ]));
      if (!paymentLocked) setDraft(prev => ({
        ...prev,
        paymentPresetIds: data.preset.isDefault || prev.paymentPresetIds.length === 0
          ? [...new Set([...prev.paymentPresetIds, data.preset.id])]
          : prev.paymentPresetIds,
      }));
      setMessage({ type: 'ok', text: 'Payment option saved.' });
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    } finally {
      setPresetSaving(false);
    }
  };

  const deletePreset = async (id: number) => {
    if (!confirm('Remove this payment option from future invoices?')) return;
    try {
      await fetch(`/api/admin/payment-presets/${id}`, { method: 'DELETE' }).then(res => readJson(res));
      setPresets(prev => prev.filter(preset => preset.id !== id));
      if (!paymentLocked) setDraft(prev => ({ ...prev, paymentPresetIds: prev.paymentPresetIds.filter(item => item !== id) }));
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSavedInvoice(null);
    setTermMode('single');
    setDraft({
      ...EMPTY_DRAFT,
      paymentPresetIds: presets.map(preset => preset.id),
    });
    setMessage(null);
  };

  const editInvoice = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setSavedInvoice(invoice);
    setTermMode(inferPaymentTermMode(invoice.paymentSchedule));
    setDraft(invoiceToDraft(invoice));
    setMessage(null);
  };

  useEffect(() => {
    if (loading || exactInvoiceLoading) return;
    if (linkedInvoiceId !== null) {
      if (!exactInvoiceResult || exactInvoiceResult.requestId !== linkedInvoiceId) return;
      if (exactInvoiceResult.invoice) {
        selectedFromUrlRef.current = linkedInvoiceId;
        editInvoice(exactInvoiceResult.invoice);
      } else {
        selectedFromUrlRef.current = null;
        resetForm();
        setMessage({
          type: 'err',
          text: exactInvoiceResult.error || 'The requested invoice was not found.',
        });
      }
      return;
    }
    if (pageSelection.kind === 'invalid') {
      selectedFromUrlRef.current = null;
      resetForm();
      setMessage({ type: 'err', text: 'The invoice link is not valid.' });
    } else if (selectedFromUrlRef.current !== null) {
      selectedFromUrlRef.current = null;
      resetForm();
    }
  }, [exactInvoiceLoading, exactInvoiceResult, linkedInvoiceId, loading, pageSelection.kind]);

  const markPaid = async (invoice: Invoice) => {
    if (paymentBusyId === invoice.id) return;
    if (busy || (savedInvoice?.id === invoice.id && dirty)) return;
    const paidSoFar = invoice.amountPaidCents || 0;
    const balance = invoice.totalCents - paidSoFar;
    let attempt = paymentAttemptRef.current[invoice.id];
    if (!attempt) {
      const entered = window.prompt(
        `Record a payment for ${invoice.clientName}.\n` +
          `Total ${formatMoney(invoice.totalCents, invoice.currency)} · ` +
          `already paid ${formatMoney(paidSoFar, invoice.currency)} · ` +
          `balance ${formatMoney(balance, invoice.currency)}.\n\n` +
          `Amount paid now (${invoice.currency}):`,
        String((balance / 100).toFixed(2)),
      );
      if (entered === null) return;
      const normalized = entered.trim();
      if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
        setMessage({ type: 'err', text: 'Enter a valid payment amount with no more than two decimal places.' });
        return;
      }
      const paidCents = Math.round(Number(normalized) * 100);
      if (!Number.isSafeInteger(paidCents) || paidCents <= 0) {
        setMessage({ type: 'err', text: 'Enter a positive payment amount.' });
        return;
      }
      attempt = {
        key: crypto.randomUUID(), paidCents, expectedCurrency: invoice.currency, expectedTotalCents: invoice.totalCents,
      };
      paymentAttemptRef.current[invoice.id] = attempt;
    }
    setPaymentBusyId(invoice.id);
    try {
      const response = await fetch(`/api/admin/invoices/${invoice.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidCents: attempt.paidCents, idempotencyKey: attempt.key,
          expectedCurrency: attempt.expectedCurrency, expectedTotalCents: attempt.expectedTotalCents,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status < 500) delete paymentAttemptRef.current[invoice.id];
        throw new Error(body?.error || `request_failed_${response.status}`);
      }
      const data = await readJson<{ ok: boolean; invoice: Invoice }>(response);
      delete paymentAttemptRef.current[invoice.id];
      setInvoices(prev => prev.map(inv => (inv.id === data.invoice.id ? data.invoice : inv)));
      setSavedInvoice(previous => previous?.id === data.invoice.id ? data.invoice : previous);
      if (editingId === data.invoice.id) setDraft(invoiceToDraft(data.invoice));
      const newBalance = data.invoice.totalCents - (data.invoice.amountPaidCents || 0);
      setMessage({
        type: 'ok',
        text: newBalance > 0
          ? `Recorded ${formatMoney(attempt.paidCents, data.invoice.currency)}. Balance due ${formatMoney(newBalance, data.invoice.currency)}.`
          : `Paid in full (${formatMoney(data.invoice.totalCents, data.invoice.currency)}).`,
      });
    } catch (error) {
      const uncertain = Boolean(paymentAttemptRef.current[invoice.id]);
      setMessage({ type: 'err', text: uncertain
        ? 'The result is uncertain. Press Record payment again to retry the exact same payment safely.'
        : niceError(error) });
    } finally {
      setPaymentBusyId(null);
    }
  };

  const saveInvoice = async () => {
    if (busy || savedInvoice?.status === 'void') return;
    if (!draft.clientName.trim() || !draft.jobTitle.trim() || !draft.jobDescription.trim()) {
      setMessage({ type: 'err', text: 'Client name, job title, and description are required.' });
      return;
    }
    if (!draft.paymentPresetIds.length) {
      setMessage({ type: 'err', text: 'Select at least one payment option.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...editingDraft,
        currency: draft.currency.toUpperCase(),
        paymentPresetId: draft.paymentPresetIds[0] ?? null,
        totalCents,
        dueTodayCents,
      };
      const url = editingId ? `/api/admin/invoices/${editingId}` : '/api/admin/invoices';
      const method = editingId ? 'PUT' : 'POST';
      const data = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(res => readJson<{ ok: boolean; invoice: Invoice }>(res));

      setSavedInvoice(data.invoice);
      setDraft(invoiceToDraft(data.invoice));
      setTermMode(inferPaymentTermMode(data.invoice.paymentSchedule));
      setEditingId(data.invoice.id);
      setInvoices(prev => {
        const without = prev.filter(invoice => invoice.id !== data.invoice.id);
        return [data.invoice, ...without];
      });
      setMessage({ type: 'ok', text: 'Invoice saved.' });
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    } finally {
      setSaving(false);
    }
  };

  const sendInvoice = async () => {
    if (!savedInvoice || !shareReady) return;

    setSaving(true);
    setMessage(null);
    try {
      const version = savedInvoice.updatedAt ? Date.parse(savedInvoice.updatedAt) / 1000 : null;
      const headers = version ? { 'If-Match': `"${version}:${savedInvoice.amountPaidCents ?? 0}"` } : undefined;
      const data = await fetch(`/api/admin/invoices/${savedInvoice.id}/send`, { method: 'POST', headers })
        .then(res => readJson<{ ok: boolean; invoice: Invoice; publicUrlPath: string }>(res));
      setSavedInvoice(data.invoice);
      setDraft(invoiceToDraft(data.invoice));
      setInvoices(prev => prev.map(invoice => invoice.id === data.invoice.id ? data.invoice : invoice));
      const url = publicInvoiceUrl(data.publicUrlPath || data.invoice.publicUrlPath);
      const copied = await copyLink(url);
      setMessage({ type: 'ok', text: copied ? 'Buyer link copied. Send it to the buyer when ready.' : 'Marked as sent. Copy the buyer link below to send it manually.' });
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    } finally {
      setSaving(false);
    }
  };

  const copyInvoiceLink = async () => {
    if (!savedInvoice?.publicUrlPath || !shareReady || !savedInvoice.sentAt) return;
    await sendInvoice();
  };

  return (
    <AdminPage width="wide">
      <div className="studio-sales-controls">
        <div className="mx-auto max-w-7xl">
          <div className="studio-sales-invoice-header flex flex-col gap-3 border-b border-wood-200 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-label text-label uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-3">
                Admin
              </p>
              <h1 className="font-title text-4xl md:text-5xl text-wood-900">
                {creatingFromShortcut ? 'Create invoice' : 'Invoices'}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resetForm}
                disabled={busy}
                className="border border-wood-300 bg-paper-50 px-4 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-wood-700 hover:border-bronze-500 hover:text-bronze-800"
              >
                New invoice
              </button>
              <button
                type="button"
                onClick={saveInvoice}
                disabled={busy || savedInvoice?.status === 'void'}
                className="studio-sales-primary"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={sendInvoice}
                disabled={!shareReady}
                className="studio-sales-secondary"
              >
                Send / copy link
              </button>
            </div>
          </div>

          {(!savedInvoice || dirty) && <p className="mb-5 font-sans text-sm text-wood-700">
            {savedInvoice ? 'Save your changes before sharing the buyer link.' : 'Save the invoice first to preview it or share a buyer link.'}
          </p>}
          {sourceQuote && <section className="mb-5 border border-wood-200 bg-paper-50 p-4" aria-label="Accepted quote">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-wood-900">Accepted quote</h2>
                <p className="font-sans text-sm text-wood-700">{sourceQuote.referenceName || sourceQuote.name} · {formatMoney(sourceQuote.amountCents, sourceQuote.currency)} · {PAYMENT_TERM_LABELS[sourceQuote.termMode]}</p>
              </div>
              <Link className="font-label text-sm text-bronze-800 underline" to={`/admin/pricing?quoteId=${sourceQuote.id}`}>Open source quote</Link>
            </div>
            {(sourceQuote.conversation || sourceQuote.conversationUrl) && <p className="mt-2 break-words font-sans text-sm text-wood-700">
              Original conversation (private): {sourceQuote.conversationUrl
                ? <a className="text-bronze-800 underline" href={sourceQuote.conversationUrl} target="_blank" rel="noopener noreferrer">Open in original channel</a>
                : sourceQuote.conversation}
            </p>}
          </section>}
          {message && <div className="mb-6"><AdminAlert
            tone={message.type === 'ok' ? 'success' : 'error'}
            live={message.type === 'err'}
          >{message.text}</AdminAlert></div>}

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <fieldset disabled={busy || savedInvoice?.status === 'void'} className="min-w-0 space-y-8 border-0 p-0">
              <legend className="sr-only">Invoice editor</legend>
              <section className="bg-paper-50 border border-wood-200 p-5 md:p-7">
                <div className="mb-6 flex flex-col gap-2 border-b border-wood-100 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl text-wood-900">Payment options</h2>
                    <p className="font-sans text-sm text-wood-600">
                      Save reusable accounts and links. Selected options become buttons on the customer invoice.
                    </p>
                  </div>
                  <p className="font-label text-label uppercase tracking-[0.12em] text-wood-500 font-semibold">
                    {selectedPresets.length} selected
                  </p>
                </div>

                <div className="studio-sales-payment-grid grid gap-6">
                  <div>
                    {loading ? (
                      <p className="font-sans text-sm text-wood-600">Loading payment options...</p>
                    ) : presets.length === 0 ? (
                      <p className="font-sans text-sm text-wood-600">
                        No payment options yet. Add Wise, PayPal, crypto, or bank transfer here.
                      </p>
                    ) : (
                      <div className="studio-sales-payment-list grid gap-3">
                        {presets.map(preset => {
                          const selected = draft.paymentPresetIds.includes(preset.id);
                          return (
                            <div key={preset.id} className={`border p-4 ${selected ? 'border-bronze-500 bg-bronze-50' : 'border-wood-200 bg-paper-50'}`}>
                              <div className="studio-sales-preset-heading mb-3 flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  disabled={paymentLocked}
                                  onClick={() => togglePaymentPreset(preset.id)}
                                  className="studio-sales-preset-title"
                                >
                                  <span className="block font-serif text-xl text-wood-900">{preset.label}</span>
                                  <span className="font-sans text-sm text-wood-600">
                                    {methodLabel(preset.method)} · {preset.currency}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePreset(preset.id)}
                                  className="font-label text-label uppercase tracking-[0.12em] text-wood-400 hover:text-[#e0a08a]"
                                >
                                  Remove
                                </button>
                              </div>
                              <p className="font-sans text-sm leading-relaxed text-wood-700 line-clamp-3">
                                {preset.instructions || preset.details || preset.url}
                              </p>
                              <button
                                type="button"
                                disabled={paymentLocked}
                                onClick={() => togglePaymentPreset(preset.id)}
                                className={`mt-4 w-full border px-3 py-2 font-label text-label uppercase tracking-[0.12em] ${
                                  selected
                                    ? 'border-bronze-600 bg-bronze-600 text-ink-on-dark dark:text-paper-50'
                                    : 'border-wood-300 bg-paper-50 text-wood-700 hover:border-bronze-500'
                                }`}
                              >
                                {selected ? 'Selected' : 'Use on invoice'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border border-wood-200 bg-paper-50 p-4">
                    <h3 className="font-label text-xs uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-4">
                      Add payment option
                    </h3>
                    <div className="space-y-4">
                      <label>
                        <span className={labelClass}>Label</span>
                        <input className={inputClass} value={presetForm.label} onChange={e => setPresetForm(prev => ({ ...prev, label: e.target.value }))} placeholder="Wise USD" />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className={labelClass}>Method</span>
                          <select className={inputClass} value={presetForm.method} onChange={e => setPresetForm(prev => ({ ...prev, method: e.target.value as PaymentMethod }))}>
                            <option value="wise">Wise</option>
                            <option value="crypto">Crypto</option>
                            <option value="bank">Bank</option>
                            <option value="paypal">PayPal</option>
                          </select>
                        </label>
                        <label>
                          <span className={labelClass}>Currency</span>
                          <input className={inputClass} value={presetForm.currency} onChange={e => setPresetForm(prev => ({ ...prev, currency: e.target.value.toUpperCase().slice(0, 3) }))} placeholder="USD" />
                        </label>
                      </div>
                      <label>
                        <span className={labelClass}>Instructions</span>
                        <textarea className={textareaClass} value={presetForm.instructions} onChange={e => setPresetForm(prev => ({ ...prev, instructions: e.target.value }))} placeholder="Pay through Wise using the link below." />
                      </label>
                      <label>
                        <span className={labelClass}>Details</span>
                        <textarea className={textareaClass} value={presetForm.details} onChange={e => setPresetForm(prev => ({ ...prev, details: e.target.value }))} placeholder="Account name, bank details, reference note..." />
                      </label>
                      <label>
                        <span className={labelClass}>Link</span>
                        <input className={inputClass} value={presetForm.url} onChange={e => setPresetForm(prev => ({ ...prev, url: e.target.value }))} placeholder={presetForm.method === 'paypal' ? 'https://paypal.me/…' : 'https://...'} />
                      </label>
                      <label className="flex items-center gap-3 font-sans text-sm text-wood-700">
                        <input type="checkbox" checked={presetForm.isDefault} onChange={e => setPresetForm(prev => ({ ...prev, isDefault: e.target.checked }))} />
                        Default option
                      </label>
                      <button
                        type="button"
                        onClick={savePreset}
                        disabled={presetSaving}
                        className="w-full bg-wood-900 px-4 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-paper-50 hover:bg-bronze-700 disabled:opacity-50"
                      >
                        {presetSaving ? 'Saving...' : 'Save payment option'}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-paper-50 border border-wood-200 p-5 md:p-7">
                <div className="mb-6 border-b border-wood-100 pb-5">
                  <h2 className="font-serif text-2xl text-wood-900">Job details</h2>
                  <p className="font-sans text-sm text-wood-600">
                    This is the description the client sees on the invoice.
                  </p>
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <label>
                    <span className={labelClass}>Client name</span>
                    <input className={inputClass} value={draft.clientName} onChange={e => updateDraft('clientName', e.target.value)} placeholder="Collector name" />
                  </label>
                  <label>
                    <span className={labelClass}>Client email</span>
                    <input className={inputClass} value={draft.clientEmail} onChange={e => updateDraft('clientEmail', e.target.value)} placeholder="name@example.com" />
                  </label>
                  <label>
                    <span className={labelClass}>Client location</span>
                    <input className={inputClass} value={draft.clientLocation} onChange={e => updateDraft('clientLocation', e.target.value)} placeholder="City, country" />
                  </label>
                  <label>
                    <span className={labelClass}>Currency</span>
                    <input disabled={paymentLocked || !!sourceQuote} className={inputClass} value={draft.currency} onChange={e => updateDraft('currency', e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" />
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Job title</span>
                    <input disabled={!!sourceQuote} className={inputClass} value={draft.jobTitle} onChange={e => updateDraft('jobTitle', e.target.value)} placeholder="Commissioned wooden sculpture" />
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Description</span>
                    <textarea disabled={!!sourceQuote} className={`${textareaClass} min-h-[140px]`} value={draft.jobDescription} onChange={e => updateDraft('jobDescription', e.target.value)} placeholder="Describe the full scope of the job, materials, dimensions, finish, packing, shipping coordination, or anything the client should understand." />
                  </label>
                </div>
              </section>

              <section className="bg-paper-50 border border-wood-200 p-5 md:p-7">
                <fieldset disabled={paymentLocked} className="min-w-0 border-0 p-0">
                <legend className="sr-only">Quoted line items</legend>
                <div className="mb-6 flex flex-col gap-3 border-b border-wood-100 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl text-wood-900">Line items</h2>
                    <p className="font-sans text-sm text-wood-600">{sourceQuote
                      ? 'The accepted artwork amount is fixed. Add the agreed shipping charge separately.'
                      : 'Add the quoted amount for the work.'}</p>
                  </div>
                  <p className="font-serif text-2xl text-wood-900">{formatMoney(totalCents, draft.currency)}</p>
                </div>

                {sourceQuote ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap justify-between gap-3 border-b border-wood-200 pb-3">
                      <div>
                        <p className="font-sans font-semibold text-wood-900">{sourceQuote.name}</p>
                        <p className="font-sans text-sm text-wood-700">{sourceQuote.configuration}</p>
                      </div>
                      <p className="font-serif text-xl text-wood-900">{formatMoney(sourceQuote.amountCents, sourceQuote.currency)}</p>
                    </div>
                    <label className="block max-w-xs">
                      <span className={labelClass}>Agreed shipping amount ({sourceQuote.currency})</span>
                      <input className={inputClass} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                        value={amountEdits[1] ?? (draft.lineItems[1]?.amountCents ? centsToInput(draft.lineItems[1].amountCents) : '')}
                        onBlur={() => onAmountBlur(1)}
                        onChange={e => {
                          const amount = parseMoneyToCents(e.target.value);
                          setAmountEdits(values => ({ ...values, 1: e.target.value }));
                          setDraft(previous => ({ ...previous, lineItems: amount
                            ? [previous.lineItems[0], { description: 'Shipping', terms: '', amountCents: amount }]
                            : previous.lineItems.slice(0, 1) }));
                        }} />
                    </label>
                  </div>
                ) : <>
                <div className="space-y-4">
                  {draft.lineItems.map((item, index) => {
                    const hasVariants = !!(item.variants && item.variants.length > 0);
                    return (
                    <div key={index} className="border border-wood-100 bg-paper-50 p-4">
                      <label className="mb-3 block max-w-xs">
                        <span className={labelClass}>Section</span>
                        <input className={inputClass} value={item.section || ''} onChange={e => updateLineItem(index, { section: e.target.value })} placeholder="Optional, e.g. Upgrade" />
                      </label>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_150px_auto]">
                        <label>
                          <span className={labelClass}>Description</span>
                          <input className={inputClass} value={item.description} onChange={e => updateLineItem(index, { description: e.target.value })} />
                        </label>
                        <label>
                          <span className={labelClass}>Terms</span>
                          <input className={inputClass} value={item.terms} onChange={e => updateLineItem(index, { terms: e.target.value })} placeholder="Optional" />
                        </label>
                        <label>
                          <span className={labelClass}>Amount{hasVariants ? ' (from sizes)' : ''}</span>
                          <input
                            className={`${inputClass} ${hasVariants ? 'opacity-60' : ''}`}
                            inputMode="decimal"
                            disabled={hasVariants}
                            value={hasVariants ? centsToInput(item.variants![0]?.amountCents || 0) : (amountEdits[index] ?? (item.amountCents ? centsToInput(item.amountCents) : ''))}
                            onChange={e => onAmountChange(index, e.target.value)}
                            onBlur={() => onAmountBlur(index)}
                            placeholder="0.00"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="self-end border border-wood-300 bg-paper-50 px-3 py-2.5 font-label text-label uppercase tracking-[0.12em] text-wood-600 hover:border-[#e0a08a] hover:text-[#e0a08a]"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Size options (optional). Add 2+ to let the buyer pick a
                          size on the invoice; the chosen price drives the total. */}
                      <div className="mt-3 border-t border-wood-100 pt-3">
                        {hasVariants && (
                          <div className="space-y-2 mb-2">
                            {item.variants!.map((v, vi) => (
                              <div key={vi} className="flex gap-2 items-center">
                                <input
                                  className={`${inputClass} max-w-[160px]`}
                                  value={v.label}
                                  onChange={e => updateVariant(index, vi, { label: e.target.value })}
                                  placeholder="Size, e.g. 3 x 3 ft"
                                />
                                <input
                                  className={`${inputClass} max-w-[120px]`}
                                  inputMode="decimal"
                                  value={v.amountCents ? centsToInput(v.amountCents) : ''}
                                  onChange={e => updateVariant(index, vi, { amountCents: parseMoneyToCents(e.target.value) })}
                                  placeholder="0.00"
                                />
                                <button type="button" onClick={() => removeVariant(index, vi)} className="font-label text-micro uppercase tracking-[0.12em] text-wood-500 hover:text-[#e0a08a]">Remove</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => addVariant(index)}
                          className="font-label text-micro uppercase tracking-[0.12em] text-bronze-700 hover:text-bronze-800 underline underline-offset-4"
                        >
                          + Add size option
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={addLineItem}
                  className="mt-4 border border-wood-300 bg-paper-50 px-4 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-wood-700 hover:border-bronze-500 hover:text-bronze-800"
                >
                  Add line item
                </button>
                </>}
                </fieldset>
              </section>

              <section className="bg-paper-50 border border-wood-200 p-5 md:p-7">
                <div className="mb-6 border-b border-wood-100 pb-5">
                  <h2 className="font-serif text-2xl text-wood-900">Payment schedule</h2>
                  <p className="font-sans text-sm text-wood-600">
                    {paymentLocked
                      ? 'The artwork, amount, currency, and payment terms are fixed after a payment. Select the milestone that is now due.'
                      : 'Choose the structure, then mark the current step so the invoice shows what is due today.'}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {(Object.keys(PAYMENT_TERM_LABELS) as PaymentTermMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      disabled={paymentLocked || !!sourceQuote}
                      onClick={() => setTermMode(mode)}
                      className={`border px-4 py-3 text-left font-sans text-sm ${
                        termMode === mode
                          ? 'border-bronze-600 bg-bronze-600 text-ink-on-dark dark:text-paper-50'
                          : 'border-wood-200 bg-paper-50 text-wood-700 hover:border-bronze-400'
                      }`}
                    >
                      {PAYMENT_TERM_LABELS[mode]}
                    </button>
                  ))}
                </div>

                <label className="mt-4 flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={paymentLocked || !!sourceQuote}
                    checked={!!draft.offerPaymentChoice}
                    onChange={e => updateDraft('offerPaymentChoice', e.target.checked)}
                    className="accent-bronze-600 w-4 h-4"
                  />
                  <span className="font-sans text-sm text-wood-700">
                    Let the buyer choose on the invoice: pay in full, or in 2 payments (recalculates from their size pick)
                  </span>
                </label>

                <div className="mt-6 space-y-3">
                  {paymentSchedule.map((step, index) => (
                    <button
                      key={`${step.label}-${index}`}
                      type="button"
                      onClick={() => updateDraft('currentStepIndex', index)}
                      className={`w-full border p-4 text-left ${
                        stepIndex === index
                          ? 'border-bronze-600 bg-bronze-50'
                          : 'border-wood-200 bg-paper-50 hover:border-bronze-400'
                      }`}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-label text-label uppercase tracking-[0.12em] text-wood-500 font-semibold">
                            Step {index + 1} · {step.dueTiming || 'Due'}
                          </p>
                          <h3 className="font-serif text-xl text-wood-900">{step.label}</h3>
                          <p className="font-sans text-sm leading-relaxed text-wood-700">{step.description}</p>
                        </div>
                        <p className="font-serif text-2xl text-wood-900">{formatMoney(step.amountCents, draft.currency)}</p>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  <label>
                    <span className={labelClass}>Shipping text</span>
                    <input className={inputClass} value={draft.shippingText} onChange={e => updateDraft('shippingText', e.target.value)} />
                  </label>
                  <div>
                    <span className={labelClass}>Status</span>
                    <p className="font-sans text-sm capitalize text-wood-900">{draft.status}</p>
                  </div>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Notes</span>
                    <textarea className={textareaClass} value={draft.notes} onChange={e => updateDraft('notes', e.target.value)} placeholder="Optional terms, validity dates, packing notes, or client-specific notes." />
                  </label>
                </div>
              </section>
            </fieldset>

            <aside className="space-y-6">
              <section className="sticky top-6 border border-wood-200 bg-paper-50 p-5">
                <p className="font-label text-label uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-3">
                  Current step
                </p>
                <h2 className="font-serif text-2xl text-wood-900">{currentStep?.label || 'Invoice total'}</h2>
                <p className="mt-1 font-sans text-sm leading-relaxed text-wood-600">
                  {currentStep?.description || 'Set an amount and choose payment terms.'}
                </p>
                <div className="mt-5 border-t border-wood-100 pt-5">
                  <p className="font-label text-label uppercase tracking-[0.12em] text-wood-500 font-semibold">Total due today</p>
                  <p className="font-serif text-4xl text-wood-900">{milestoneDue === null ? 'Confirm payment terms' : formatMoney(milestoneDue, draft.currency)}</p>
                </div>
                <div className="mt-5 border-t border-wood-100 pt-5">
                  <p className="font-label text-label uppercase tracking-[0.12em] text-wood-500 font-semibold mb-2">Payment buttons</p>
                  <div className="space-y-2">
                    {selectedPresets.length ? selectedPresets.map(preset => (
                      <div key={preset.id} className="border border-wood-200 bg-paper-50 px-3 py-2 font-sans text-sm text-wood-800">
                        {preset.label}
                      </div>
                    )) : (
                      <p className="font-sans text-sm text-danger">Select at least one payment option.</p>
                    )}
                  </div>
                </div>
                {savedInvoice && <ReviewSaleLink invoice={savedInvoice} />}
                {savedInvoice?.publicUrlPath && (
                  <div className="mt-5 border-t border-wood-100 pt-5">
                    <a className="block font-sans text-sm text-bronze-800 underline" href={`${savedInvoice.publicUrlPath}?studio-preview=${savedInvoice.id}`} target="_blank" rel="noreferrer">
                      Preview saved invoice
                    </a>
                    {shareReady && savedInvoice.sentAt && (
                      <>
                        <span className="mt-2 block break-all font-sans text-sm text-wood-700">{publicInvoiceUrl(savedInvoice.publicUrlPath)}</span>
                        <button
                          type="button"
                          onClick={copyInvoiceLink}
                          className="mt-3 w-full border border-wood-300 px-3 py-2 font-label text-label uppercase tracking-[0.12em] text-wood-700 hover:border-bronze-500"
                        >
                          Copy buyer link
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>

              <section className="border border-wood-200 bg-paper-50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-2xl text-wood-900">Recent</h2>
                  <button type="button" onClick={load} className="font-label text-label uppercase tracking-[0.12em] text-bronze-700">
                    Refresh
                  </button>
                </div>
                {loading ? (
                  <p className="font-sans text-sm text-wood-600">Loading invoices...</p>
                ) : invoices.length === 0 ? (
                  <p className="font-sans text-sm text-wood-600">No saved invoices yet.</p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map(invoice => (
                      <div
                        key={invoice.id}
                        className={`border p-3 ${
                          editingId === invoice.id ? 'border-bronze-500 bg-bronze-50' : 'border-wood-200 bg-paper-50'
                        }`}
                      >
                        <button type="button" disabled={busy} onClick={() => editInvoice(invoice)} className="studio-sales-row w-full hover:opacity-80">
                          <span className="block font-label text-label uppercase tracking-[0.12em] text-wood-500">
                            {invoice.invoiceNumber} · {invoice.status}
                          </span>
                          <span className="block font-serif text-lg text-wood-900">{invoice.clientName}</span>
                          <span className="block font-sans text-sm text-wood-600">
                            Total {formatMoney(invoice.totalCents, invoice.currency)}
                            {(invoice.amountPaidCents || 0) > 0 && invoice.totalCents - (invoice.amountPaidCents || 0) > 0 && (
                              <span className="text-bronze-700"> · balance {formatMoney(invoice.totalCents - (invoice.amountPaidCents || 0), invoice.currency)}</span>
                            )}
                          </span>
                        </button>
                        <ReviewSaleLink invoice={invoice} />
                        {invoice.status !== 'paid' && invoice.status !== 'void' && invoice.totalCents > (invoice.amountPaidCents || 0)
                          && (!invoice.sourceQuote || invoice.paymentOptions.length > 0) && (
                          <button
                            type="button"
                            onClick={() => markPaid(invoice)}
                            disabled={busy || (savedInvoice?.id === invoice.id && dirty)}
                            className="mt-2 border border-wood-300 bg-paper-50 px-3 py-1.5 font-label text-micro uppercase tracking-[0.12em] text-wood-700 hover:border-success-line hover:text-success"
                          >
                            {paymentBusyId === invoice.id ? 'Recording…' : 'Record payment'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
    </div>
    </AdminPage>
  );
};

export default AdminInvoices;
