import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
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
  buildPaymentSchedule,
  centsToInput,
  formatMoney,
  inferPaymentTermMode,
  lineItemsTotal,
  methodLabel,
  parseMoneyToCents,
  publicInvoiceUrl,
} from './invoices/invoiceUtils';

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

const inputClass = 'w-full border border-wood-300 bg-white px-3 py-2.5 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-500';
const textareaClass = `${inputClass} min-h-[96px] resize-y leading-relaxed`;
const labelClass = 'font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 font-semibold block mb-2';
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
};

function niceError(error: unknown): string {
  const key = error instanceof Error ? error.message : String(error);
  return errorCopy[key] || key || 'Something went wrong.';
}

function invoiceToDraft(invoice: Invoice): InvoiceDraft {
  return {
    status: invoice.status === 'void' ? 'draft' : invoice.status,
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
    paymentPresetIds: invoice.paymentPresetIds,
    notes: invoice.notes,
  };
}

const AdminInvoices: React.FC = () => {
  const [presets, setPresets] = useState<PaymentPreset[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [draft, setDraft] = useState<InvoiceDraft>(EMPTY_DRAFT);
  const [presetForm, setPresetForm] = useState(EMPTY_PRESET);
  const [termMode, setTermMode] = useState<PaymentTermMode>('single');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [presetSaving, setPresetSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const totalCents = useMemo(() => lineItemsTotal(draft.lineItems), [draft.lineItems]);
  const currentStep = draft.paymentSchedule[draft.currentStepIndex] || draft.paymentSchedule[0];
  const dueTodayCents = currentStep?.amountCents || totalCents;

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
        if (presetIds.length) setDraft(prev => ({ ...prev, paymentPresetIds: presetIds }));
      }
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    setDraft(prev => {
      const schedule = buildPaymentSchedule(totalCents, termMode);
      return {
        ...prev,
        paymentSchedule: schedule,
        currentStepIndex: Math.min(prev.currentStepIndex, Math.max(0, schedule.length - 1)),
      };
    });
  }, [termMode, totalCents]);

  const updateDraft = <K extends keyof InvoiceDraft>(field: K, value: InvoiceDraft[K]) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (index: number, patch: Partial<InvoiceLineItem>) => {
    setDraft(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => i === index ? { ...item, ...patch } : item),
    }));
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
      setDraft(prev => ({
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
      setDraft(prev => ({ ...prev, paymentPresetIds: prev.paymentPresetIds.filter(item => item !== id) }));
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

  const saveInvoice = async () => {
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
        ...draft,
        status: draft.status === 'void' ? 'draft' : draft.status,
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
    if (!savedInvoice?.id) {
      await saveInvoice();
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const data = await fetch(`/api/admin/invoices/${savedInvoice.id}/send`, { method: 'POST' })
        .then(res => readJson<{ ok: boolean; invoice: Invoice; publicUrlPath: string }>(res));
      setSavedInvoice(data.invoice);
      setInvoices(prev => prev.map(invoice => invoice.id === data.invoice.id ? data.invoice : invoice));
      const url = publicInvoiceUrl(data.publicUrlPath || data.invoice.publicUrlPath);
      if (url && navigator.clipboard) await navigator.clipboard.writeText(url);
      setMessage({ type: 'ok', text: url ? `Public invoice link copied: ${url}` : 'Invoice marked as sent.' });
    } catch (error) {
      setMessage({ type: 'err', text: niceError(error) });
    } finally {
      setSaving(false);
    }
  };

  const copyInvoiceLink = async () => {
    if (!savedInvoice?.publicUrlPath) return;
    const url = publicInvoiceUrl(savedInvoice.publicUrlPath);
    if (navigator.clipboard) await navigator.clipboard.writeText(url);
    setMessage({ type: 'ok', text: `Copied: ${url}` });
  };

  return (
    <AdminLayout>
      <section className="px-5 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-5 border-b border-wood-200 pb-8 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-3">
                Admin
              </p>
              <h1 className="font-title text-4xl md:text-5xl text-wood-900">Invoices</h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="border border-wood-300 bg-white px-4 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-wood-700 hover:border-bronze-500 hover:text-bronze-800"
              >
                New invoice
              </button>
              <button
                type="button"
                onClick={saveInvoice}
                disabled={saving}
                className="bg-wood-900 px-5 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-paper-50 hover:bg-bronze-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={sendInvoice}
                disabled={saving}
                className="bg-bronze-600 px-5 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-paper-50 hover:bg-bronze-700 disabled:opacity-50"
              >
                Send / copy link
              </button>
            </div>
          </div>

          {message && (
            <div className={`mb-6 border px-4 py-3 font-sans text-sm ${
              message.type === 'ok'
                ? 'border-bronze-300 bg-bronze-50 text-bronze-900'
                : 'border-red-300 bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-8">
              <section className="bg-white border border-wood-200 p-5 md:p-7">
                <div className="mb-6 flex flex-col gap-2 border-b border-wood-100 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl text-wood-900">Payment options</h2>
                    <p className="font-sans text-sm text-wood-600">
                      Save reusable accounts and links. Selected options become buttons on the customer invoice.
                    </p>
                  </div>
                  <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold">
                    {selectedPresets.length} selected
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div>
                    {loading ? (
                      <p className="font-sans text-sm text-wood-600">Loading payment options...</p>
                    ) : presets.length === 0 ? (
                      <p className="font-sans text-sm text-wood-600">
                        No payment options yet. Add Wise, crypto, or bank transfer here.
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {presets.map(preset => {
                          const selected = draft.paymentPresetIds.includes(preset.id);
                          return (
                            <div key={preset.id} className={`border p-4 ${selected ? 'border-bronze-500 bg-bronze-50' : 'border-wood-200 bg-paper-50'}`}>
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => togglePaymentPreset(preset.id)}
                                  className="text-left"
                                >
                                  <span className="block font-serif text-xl text-wood-900">{preset.label}</span>
                                  <span className="font-sans text-sm text-wood-600">
                                    {methodLabel(preset.method)} · {preset.currency}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deletePreset(preset.id)}
                                  className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-400 hover:text-red-700"
                                >
                                  Remove
                                </button>
                              </div>
                              <p className="font-sans text-sm leading-relaxed text-wood-700 line-clamp-3">
                                {preset.instructions || preset.details || preset.url}
                              </p>
                              <button
                                type="button"
                                onClick={() => togglePaymentPreset(preset.id)}
                                className={`mt-4 w-full border px-3 py-2 font-label text-[11px] uppercase tracking-[0.12em] ${
                                  selected
                                    ? 'border-bronze-600 bg-bronze-600 text-white'
                                    : 'border-wood-300 bg-white text-wood-700 hover:border-bronze-500'
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
                        <input className={inputClass} value={presetForm.url} onChange={e => setPresetForm(prev => ({ ...prev, url: e.target.value }))} placeholder="https://..." />
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

              <section className="bg-white border border-wood-200 p-5 md:p-7">
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
                    <input className={inputClass} value={draft.currency} onChange={e => updateDraft('currency', e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" />
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Job title</span>
                    <input className={inputClass} value={draft.jobTitle} onChange={e => updateDraft('jobTitle', e.target.value)} placeholder="Commissioned wooden sculpture" />
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Description</span>
                    <textarea className={`${textareaClass} min-h-[140px]`} value={draft.jobDescription} onChange={e => updateDraft('jobDescription', e.target.value)} placeholder="Describe the full scope of the job, materials, dimensions, finish, packing, shipping coordination, or anything the client should understand." />
                  </label>
                </div>
              </section>

              <section className="bg-white border border-wood-200 p-5 md:p-7">
                <div className="mb-6 flex flex-col gap-3 border-b border-wood-100 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="font-serif text-2xl text-wood-900">Line items</h2>
                    <p className="font-sans text-sm text-wood-600">Add the quoted amount for the work.</p>
                  </div>
                  <p className="font-serif text-2xl text-wood-900">{formatMoney(totalCents, draft.currency)}</p>
                </div>

                <div className="space-y-4">
                  {draft.lineItems.map((item, index) => (
                    <div key={index} className="grid gap-3 border border-wood-100 bg-paper-50 p-4 md:grid-cols-[minmax(0,1fr)_180px_150px_auto]">
                      <label>
                        <span className={labelClass}>Description</span>
                        <input className={inputClass} value={item.description} onChange={e => updateLineItem(index, { description: e.target.value })} />
                      </label>
                      <label>
                        <span className={labelClass}>Terms</span>
                        <input className={inputClass} value={item.terms} onChange={e => updateLineItem(index, { terms: e.target.value })} placeholder="Optional" />
                      </label>
                      <label>
                        <span className={labelClass}>Amount</span>
                        <input className={inputClass} inputMode="decimal" value={centsToInput(item.amountCents)} onChange={e => updateLineItem(index, { amountCents: parseMoneyToCents(e.target.value) })} />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="self-end border border-wood-300 bg-white px-3 py-2.5 font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 hover:border-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addLineItem}
                  className="mt-4 border border-wood-300 bg-white px-4 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-wood-700 hover:border-bronze-500 hover:text-bronze-800"
                >
                  Add line item
                </button>
              </section>

              <section className="bg-white border border-wood-200 p-5 md:p-7">
                <div className="mb-6 border-b border-wood-100 pb-5">
                  <h2 className="font-serif text-2xl text-wood-900">Payment schedule</h2>
                  <p className="font-sans text-sm text-wood-600">
                    Choose the structure, then mark the current step so the invoice shows what is due today.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {(Object.keys(PAYMENT_TERM_LABELS) as PaymentTermMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTermMode(mode)}
                      className={`border px-4 py-3 text-left font-sans text-sm ${
                        termMode === mode
                          ? 'border-bronze-600 bg-bronze-50 text-bronze-900'
                          : 'border-wood-200 bg-paper-50 text-wood-700 hover:border-bronze-400'
                      }`}
                    >
                      {PAYMENT_TERM_LABELS[mode]}
                    </button>
                  ))}
                </div>

                <div className="mt-6 space-y-3">
                  {draft.paymentSchedule.map((step, index) => (
                    <button
                      key={`${step.label}-${index}`}
                      type="button"
                      onClick={() => updateDraft('currentStepIndex', index)}
                      className={`w-full border p-4 text-left ${
                        draft.currentStepIndex === index
                          ? 'border-bronze-600 bg-bronze-50'
                          : 'border-wood-200 bg-paper-50 hover:border-bronze-400'
                      }`}
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold">
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
                  <label>
                    <span className={labelClass}>Status</span>
                    <select className={inputClass} value={draft.status} onChange={e => updateDraft('status', e.target.value as InvoiceDraft['status'])}>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                    </select>
                  </label>
                  <label className="md:col-span-2">
                    <span className={labelClass}>Notes</span>
                    <textarea className={textareaClass} value={draft.notes} onChange={e => updateDraft('notes', e.target.value)} placeholder="Optional terms, validity dates, packing notes, or client-specific notes." />
                  </label>
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="sticky top-6 border border-wood-200 bg-white p-5">
                <p className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-3">
                  Current step
                </p>
                <h2 className="font-serif text-2xl text-wood-900">{currentStep?.label || 'Invoice total'}</h2>
                <p className="mt-1 font-sans text-sm leading-relaxed text-wood-600">
                  {currentStep?.description || 'Set an amount and choose payment terms.'}
                </p>
                <div className="mt-5 border-t border-wood-100 pt-5">
                  <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold">Total due today</p>
                  <p className="font-serif text-4xl text-wood-900">{formatMoney(dueTodayCents, draft.currency)}</p>
                </div>
                <div className="mt-5 border-t border-wood-100 pt-5">
                  <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-2">Payment buttons</p>
                  <div className="space-y-2">
                    {selectedPresets.length ? selectedPresets.map(preset => (
                      <div key={preset.id} className="border border-wood-200 bg-paper-50 px-3 py-2 font-sans text-sm text-wood-800">
                        {preset.label}
                      </div>
                    )) : (
                      <p className="font-sans text-sm text-red-700">Select at least one payment option.</p>
                    )}
                  </div>
                </div>
                {savedInvoice?.publicUrlPath && (
                  <div className="mt-5 border-t border-wood-100 pt-5">
                    <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-2">Public link</p>
                    <a className="block break-all font-sans text-sm text-bronze-800 underline" href={savedInvoice.publicUrlPath} target="_blank" rel="noreferrer">
                      {publicInvoiceUrl(savedInvoice.publicUrlPath)}
                    </a>
                    <button
                      type="button"
                      onClick={copyInvoiceLink}
                      className="mt-3 w-full border border-wood-300 px-3 py-2 font-label text-[11px] uppercase tracking-[0.12em] text-wood-700 hover:border-bronze-500"
                    >
                      Copy link
                    </button>
                  </div>
                )}
              </section>

              <section className="border border-wood-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-serif text-2xl text-wood-900">Recent</h2>
                  <button type="button" onClick={load} className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700">
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
                      <button
                        key={invoice.id}
                        type="button"
                        onClick={() => editInvoice(invoice)}
                        className={`w-full border p-3 text-left hover:border-bronze-500 ${
                          editingId === invoice.id ? 'border-bronze-500 bg-bronze-50' : 'border-wood-200 bg-paper-50'
                        }`}
                      >
                        <span className="block font-label text-[11px] uppercase tracking-[0.12em] text-wood-500">
                          {invoice.invoiceNumber} · {invoice.status}
                        </span>
                        <span className="block font-serif text-lg text-wood-900">{invoice.clientName}</span>
                        <span className="block font-sans text-sm text-wood-600">
                          Due now {formatMoney(invoice.dueTodayCents, invoice.currency)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
};

export default AdminInvoices;
