import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Invoice, InvoiceLineItem, InvoicePaymentOption } from './invoices/invoiceTypes';
import { img } from '../utils/media';
import { WISE_REFERRAL_URL, amountDueAtMilestone, buildPaymentSchedule, formatMoney, inferPaymentTermMode, isWiseMethod, methodLabel } from './invoices/invoiceUtils';

async function readInvoice(token: string, previewId: string | null, signal: AbortSignal): Promise<Invoice> {
  if (previewId !== null && (!/^[1-9]\d*$/.test(previewId) || !Number.isSafeInteger(Number(previewId)))) {
    throw new Error('not_found');
  }
  const url = previewId === null ? `/api/invoices/${encodeURIComponent(token)}` : `/api/admin/invoices/${previewId}`;
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok || !data.invoice) throw new Error(data?.error || 'not_found');
  if (previewId !== null && (String(data.invoice.id) !== previewId || data.invoice.publicToken !== token)) {
    throw new Error('not_found');
  }
  return data.invoice as Invoice;
}

function formatDate(value?: string | null): string {
  if (!value) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function comparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

const PublicInvoice: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const previewId = searchParams.get('studio-preview');
  const source = JSON.stringify([token, previewId]);
  const [result, setResult] = useState<{ source: string; invoice: Invoice | null; error?: string } | null>(null);
  const invoice = result?.source === source ? result.invoice : null;
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setSelectedPaymentIndex(0);
    setVariantChoice({});
    setPlanChoice('single');
    setChoiceChanges(0);
    if (!token) {
      setResult({ source, invoice: null, error: 'not_found' });
      return;
    }

    readInvoice(token, previewId, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResult({ source, invoice: data }); })
      .catch(err => {
        if (!controller.signal.aborted) setResult({ source, invoice: null, error: err instanceof Error ? err.message : 'not_found' });
      });
    return () => controller.abort();
  }, [token, previewId, source]);

  // Buyer-selected variant (size) per line item index. Defaults to variant 0.
  const [variantChoice, setVariantChoice] = useState<Record<number, number>>({});
  // Counts option clicks so the changed totals can replay a short highlight.
  const [choiceChanges, setChoiceChanges] = useState(0);
  const chooseVariant = (index: number, variantIndex: number) => {
    if ((variantChoice[index] ?? 0) === variantIndex) return;
    setVariantChoice((prev) => ({ ...prev, [index]: variantIndex }));
    setChoiceChanges((n) => n + 1);
  };
  const flashClass = choiceChanges > 0 ? 'invoice-flash' : '';

  // The effective amount for a line: the chosen variant's price, else its base.
  const lineAmount = (item: InvoiceLineItem, index: number): number => {
    if (item.variants && item.variants.length > 0) {
      const v = item.variants[variantChoice[index] ?? 0] || item.variants[0];
      return v.amountCents;
    }
    return item.amountCents;
  };

  // Live totals: if any line has variants, recompute from the chosen prices so
  // the displayed Total / Due today follow the buyer's size pick. Otherwise use
  // the stored totals unchanged (no behaviour change for normal invoices).
  // Buyer's payment choice (only when the invoice offers it): pay in full or 2.
  const [planChoice, setPlanChoice] = useState<'single' | 'two_part'>('single');

  // Consecutive line items sharing a section render under one heading with
  // their own subtotal. Invoices without sections form one unlabelled group.
  const lineGroups = useMemo(() => {
    const groups: { section: string; image: string; caption: string; items: { item: InvoiceLineItem; index: number }[] }[] = [];
    (invoice?.lineItems || []).forEach((item, index) => {
      const section = item.section?.trim() || '';
      let group = groups[groups.length - 1];
      if (!group || group.section !== section) {
        group = { section, image: '', caption: '', items: [] };
        groups.push(group);
      }
      group.items.push({ item, index });
      if (!group.image && item.sectionImage) {
        group.image = item.sectionImage;
        group.caption = item.sectionImageCaption || '';
      }
    });
    return groups;
  }, [invoice]);

  const amountPaid = invoice?.amountPaidCents ?? 0;
  const variantsExist = !!invoice?.lineItems.some((i) => i.variants && i.variants.length > 0);
  const hasVariants = amountPaid === 0 && variantsExist;
  const liveSubtotal = invoice
    ? invoice.lineItems.reduce((sum, item, i) => sum + lineAmount(item, i), 0)
    : 0;
  const displaySubtotal = hasVariants ? liveSubtotal : (invoice?.subtotalCents ?? 0);
  const displayTotal = hasVariants ? liveSubtotal : (invoice?.totalCents ?? 0);

  // When the invoice offers a payment choice, recompute the schedule live from
  // the chosen size (liveSubtotal) × the chosen plan. Otherwise use the stored
  // schedule, recomputing only its amounts if a size changed the total.
  const balanceDue = Math.max(0, displayTotal - amountPaid);

  const offerChoice = !!invoice?.offerPaymentChoice && amountPaid === 0;
  const displaySchedule = useMemo(() => {
    if (!invoice) return [];
    if (amountPaid > 0) return invoice.paymentSchedule;
    if (offerChoice) return buildPaymentSchedule(liveSubtotal, planChoice);
    if (hasVariants) return buildPaymentSchedule(displayTotal, inferPaymentTermMode(invoice.paymentSchedule));
    return invoice.paymentSchedule;
  }, [invoice, offerChoice, planChoice, liveSubtotal, hasVariants, displayTotal, amountPaid]);
  const activeStepIndex = Math.min(invoice?.currentStepIndex ?? 0, Math.max(0, displaySchedule.length - 1));
  const currentStep = displaySchedule[activeStepIndex] ?? null;
  const displayDueToday = amountPaid > 0
    ? amountDueAtMilestone(displayTotal, amountPaid, displaySchedule, activeStepIndex)
    : (currentStep?.amountCents ?? (invoice?.dueTodayCents ?? 0));

  const paymentOptions = invoice?.paymentOptions || [];
  const selectedPayment = paymentOptions[selectedPaymentIndex] || paymentOptions[0] || null;
  const invoiceDate = invoice?.sentAt || invoice?.createdAt || null;

  const paymentAction = useMemo(() => {
    if (!selectedPayment) return null;
    if (selectedPayment.url) {
      return {
        label: `Pay with ${selectedPayment.label}`,
        href: selectedPayment.url,
      };
    }
    return null;
  }, [selectedPayment]);

  if (result?.source !== source) {
    return (
      <section className="invoice-light min-h-screen bg-paper-100 px-6 py-16">
        <div className="mx-auto max-w-xl font-label text-xs uppercase tracking-[0.12em] text-wood-600">
          Loading invoice...
        </div>
      </section>
    );
  }

  if (!invoice) {
    return (
      <section className="invoice-light min-h-screen bg-paper-100 px-6 py-16">
        <div className="mx-auto max-w-xl border border-wood-200 bg-surface-card p-8">
          <p className="font-label text-label uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-3">
            Invoice
          </p>
          <h1 className="font-serif text-3xl text-wood-900 mb-4">Invoice not available</h1>
          <p className="font-sans text-sm leading-relaxed text-wood-700">
            {previewId !== null ? 'Open the saved preview from Studio while signed in as an administrator.'
              : result.error === 'db_not_configured'
              ? 'The invoice database is not connected yet.'
              : 'This invoice link could not be found or is no longer active.'}
          </p>
          <Link to="/" className="mt-6 inline-block font-label text-xs uppercase tracking-[0.12em] text-bronze-700 underline">
            adrianrasmussen.com
          </Link>
        </div>
      </section>
    );
  }

  const jobTitle = comparableText(invoice.jobTitle);
  const jobDescription = comparableText(invoice.jobDescription);
  const artworkLineIndex = jobTitle ? invoice.lineItems.findIndex(item => (
    !item.section?.trim() && comparableText(item.description) === jobTitle
  )) : -1;
  const shippingLines = invoice.lineItems.flatMap((item, index) => (
    comparableText(item.description) === 'shipping' && item.amountCents > 0 && !item.variants?.length ? [index] : []
  ));
  const shippingLineIndex = shippingLines.length === 1 ? shippingLines[0] : -1;
  const showInstallments = displaySchedule.length > 1;
  const totalDueToday = !showInstallments && amountPaid === 0 && displayDueToday === displayTotal && displayTotal > 0
    && (!currentStep?.dueTiming || comparableText(currentStep.dueTiming) === 'due today');
  const singleStepHeading = currentStep && (totalDueToday
    ? (comparableText(currentStep.label) === 'full payment' ? '' : currentStep.label)
    : [currentStep.label, currentStep.dueTiming].filter(Boolean).join(' · '));
  const showSubtotal = displaySubtotal !== displayTotal && !(amountPaid > 0 && variantsExist);

  return (
    <section className="invoice-light min-h-screen bg-paper-100 px-3 py-4 sm:px-6 sm:py-6 print:bg-surface-card print:p-0">
      {previewId !== null && <p className="invoice-print-hide mb-2 text-center font-sans text-xs text-wood-700">
        Studio preview · Saved invoice
      </p>}
      <style>{`
        .invoice-flash { animation: invoice-flash 1.4s ease-out; }
        @keyframes invoice-flash {
          0%, 30% { background-color: var(--color-bronze-100); box-shadow: 0 0 0 4px var(--color-bronze-100); }
          100% { background-color: transparent; box-shadow: 0 0 0 4px transparent; }
        }
        @media (prefers-reduced-motion: reduce) { .invoice-flash { animation: none; } }
        .invoice-a4 {
          width: min(100%, 210mm);
        }
        @media print {
          @page { size: A4; margin: 0; }
          html, body, #root { background: white !important; }
          /* Keep the whole invoice on a single A4 sheet. Screen-comfortable
             padding plus a filled-in bank-details block ran ~29mm past one
             page, so print uses a tighter page padding, compresses the
             section rhythm, and shrinks the bank-details block. */
          .invoice-a4 {
            width: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            padding: 7mm 12mm !important;
          }
          .invoice-a4 > * { break-inside: avoid; }
          /* Trim each section's vertical padding. */
          .invoice-a4 .print-tight { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          .invoice-a4 .print-tight-top { padding-top: 0.25rem !important; }
          .invoice-a4 header { padding-bottom: 0.3rem !important; }
          /* Compress the payment-schedule step cards (tighter when 2 steps show). */
          .invoice-a4 .pay-step { padding: 0.25rem 0.55rem !important; }
          .invoice-a4 .pay-step p { line-height: 1.25 !important; }
          /* Shrink the bank/account details block (the tallest element). */
          .invoice-a4 .pay-details {
            font-size: var(--text-micro) !important;
            line-height: 1.35 !important;
            margin-top: 0.35rem !important;
            padding-top: 0.35rem !important;
          }
          .invoice-print-hide { display: none !important; }
        }
      `}</style>

      <article className="invoice-a4 mx-auto border border-wood-200 bg-surface-card px-4 py-3 sm:px-7 sm:py-5">
        <header className="border-b border-wood-900 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <Link to="/" className="btn btn-ghost font-serif text-xl leading-tight">
              Adrian Rasmussen
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="invoice-print-hide btn btn-outline"
            >
              Print / save PDF
            </button>
          </div>
          <p className="font-label text-xs text-wood-700">Invoice {invoice.invoiceNumber} · {formatDate(invoiceDate)}</p>
          <div className="mt-2 grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)] sm:gap-6">
            <div>
              <h1 className="font-serif text-3xl leading-tight text-wood-900 sm:text-4xl">{invoice.jobTitle || 'Invoice'}</h1>
              {invoice.jobDescription && <p className="whitespace-pre-line font-sans text-sm leading-snug text-wood-700">{invoice.jobDescription}</p>}
            </div>
            <div className="sm:text-right">
              <p className="font-sans text-sm text-wood-700"><span className="font-label text-xs">Prepared for</span> <span className="text-wood-900">{invoice.clientName}</span></p>
              {invoice.clientEmail && <p className="font-sans text-xs text-wood-700 [overflow-wrap:anywhere]">{invoice.clientEmail}</p>}
              {invoice.clientLocation && <p className="font-sans text-xs text-wood-700">{invoice.clientLocation}</p>}
            </div>
          </div>
        </header>

        <section className="print-tight border-b border-wood-200 py-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-wood-200 pb-1 font-label text-xs text-wood-600 font-semibold">
            <span>Description</span>
            <span className="text-right">Amount</span>
          </div>
          <div>
            {lineGroups.map((group, groupIndex) => (
              <div
                key={`${group.section}-${groupIndex}`}
                className={group.section ? `invoice-section mt-4 border border-wood-200 px-4 pb-2 pt-4 ${groupIndex === 0 ? 'bg-paper-100' : 'bg-paper-50'}` : ''}
              >
                {group.section && (
                  <div className="flex items-start gap-4 border-b border-wood-200 pb-3">
                    {group.image && (
                      <img
                        src={img(group.image, { w: 400, h: 400 })}
                        alt={group.caption || group.section}
                        width={400}
                        height={400}
                        loading="lazy"
                        className="h-24 w-24 shrink-0 bg-wood-900 object-cover sm:h-32 sm:w-32"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="font-label text-label uppercase tracking-[0.12em] text-bronze-700 font-semibold">
                        {group.section}
                      </p>
                      {group.caption && (
                        <p className="mt-1 font-serif text-lg leading-snug text-wood-900">{group.caption}</p>
                      )}
                    </div>
                  </div>
                )}
                {group.items.map(({ item, index }) => (
                  <div key={`${item.description}-${index}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 border-b border-wood-100 py-2">
                    <div>
                      <p className="font-sans text-sm text-wood-900">{index === artworkLineIndex ? 'Artwork' : item.description}</p>
                      {item.terms && !(index === artworkLineIndex && comparableText(item.terms) === jobDescription) && <p className="font-sans text-xs text-wood-600">{item.terms}</p>}
                      {index === shippingLineIndex && invoice.shippingText && comparableText(invoice.shippingText) !== comparableText(item.terms) && (
                        <p className="whitespace-pre-line font-sans text-xs text-wood-600 [overflow-wrap:anywhere]">{invoice.shippingText}</p>
                      )}
                      {hasVariants && item.variants && item.variants.length > 0 && (
                        <p className="print-only hidden font-sans text-xs text-wood-600">
                          {(item.variants[variantChoice[index] ?? 0] || item.variants[0]).label}
                        </p>
                      )}
                    </div>
                    <p className="text-right font-sans text-sm text-wood-900 tabular-nums">
                      <span
                        key={`${index}-${variantChoice[index] ?? 'default'}`}
                        className={variantChoice[index] !== undefined ? 'invoice-flash' : ''}
                      >
                        {amountPaid > 0 && item.variants?.length
                          ? 'Included'
                          : formatMoney(lineAmount(item, index), invoice.currency)}
                      </span>
                    </p>
                    {hasVariants && item.variants && item.variants.length > 0 && (
                      <div role="radiogroup" aria-label={item.description} className="no-print col-span-2 -mt-1">
                        <p className="mb-2 font-label text-label uppercase tracking-[0.12em] text-bronze-700 font-semibold">
                          Choose one · required
                        </p>
                        <div className="grid gap-2">
                          {item.variants.map((v, vi) => {
                            const active = (variantChoice[index] ?? 0) === vi;
                            const difference = v.amountCents - lineAmount(item, index);
                            return (
                              <button
                                key={v.label}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => chooseVariant(index, vi)}
                                className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border px-3 py-2.5 sm:grid-cols-[4.5rem_1fr_auto] text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bronze-600 ${
                                  active
                                    ? 'border-wood-900 bg-wood-900 text-paper-50'
                                    : 'border-wood-300 bg-paper-50 text-wood-800 hover:border-bronze-600 hover:bg-bronze-50'
                                }`}
                              >
                                <span className={`col-span-2 font-label text-micro uppercase tracking-[0.12em] font-semibold sm:col-span-1 ${active ? 'text-paper-50' : 'text-bronze-700'}`}>
                                  {active ? 'Selected' : 'Select'}
                                </span>
                                <span className="font-sans text-sm leading-snug">{v.label}</span>
                                <span className="text-right font-sans text-sm leading-snug">
                                  {formatMoney(v.amountCents, invoice.currency)}
                                  {!active && difference !== 0 && (
                                    <span className="block text-xs text-wood-600">
                                      {difference > 0 ? '+' : '-'}{formatMoney(Math.abs(difference), invoice.currency)} to total
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {group.section && !(amountPaid > 0 && group.items.some(({ item }) => item.variants?.length)) && (
                  <div className="flex items-center justify-between pb-1 pt-3 font-sans text-sm font-semibold text-wood-900">
                    <span>{group.section} subtotal</span>
                    <span>{formatMoney(group.items.reduce((sum, { item, index }) => sum + lineAmount(item, index), 0), invoice.currency)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="ml-auto mt-2 w-full max-w-xs space-y-1">
            {showSubtotal && <div className="flex items-center justify-between font-sans text-sm text-wood-700">
              <span>Subtotal</span>
              <span>{formatMoney(displaySubtotal, invoice.currency)}</span>
            </div>}
            {shippingLineIndex < 0 && invoice.shippingText && <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 font-sans text-sm text-wood-700">
              <span>Shipping</span>
              <span className="text-right [overflow-wrap:anywhere]">{invoice.shippingText}</span>
            </div>}
            <div className="flex items-baseline justify-between gap-3 font-sans text-sm text-wood-900">
              <span className="font-semibold">{totalDueToday ? 'Total due today' : 'Total'}</span>
              <span key={`total-${choiceChanges}`} className={`font-serif text-2xl tabular-nums ${flashClass}`}>{formatMoney(displayTotal, invoice.currency)}</span>
            </div>
            {(invoice.amountPaidCents || 0) > 0 && (
              <>
                <div className="flex items-center justify-between font-sans text-sm text-wood-700 pt-1.5">
                  <span>Paid</span>
                  <span>-{formatMoney(invoice.amountPaidCents || 0, invoice.currency)}</span>
                </div>
                {balanceDue > 0 && (
                  <div className="flex items-center justify-between border-t border-wood-900 pt-2 font-serif text-2xl text-bronze-700">
                    <span>Balance due</span>
                    <span key={`balance-${choiceChanges}`} className={flashClass}>{formatMoney(balanceDue, invoice.currency)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {(!totalDueToday || offerChoice || singleStepHeading || currentStep?.description) && (
          <section className="print-tight border-b border-wood-200 py-2.5" aria-label="Payment schedule">
            {offerChoice && (
              <div className="no-print mb-2 flex flex-wrap gap-2" role="group" aria-label="Payment plan">
                {([['single', 'Pay in full'], ['two_part', '2 payments']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={planChoice === mode}
                    onClick={() => setPlanChoice(mode)}
                    className={planChoice === mode ? 'chip is-active' : 'chip'}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {showInstallments ? (
              <div className="divide-y divide-wood-200">
                {displaySchedule.map((step, index) => (
                  <div key={`${step.label}-${index}`} aria-current={index === activeStepIndex ? 'step' : undefined} className={`pay-step grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-2 py-1.5 ${index === activeStepIndex ? 'bg-bronze-50' : ''}`}>
                    <div>
                      <p className="font-label text-xs text-wood-600">Step {index + 1} · {step.dueTiming}</p>
                      <p className="font-sans text-sm text-wood-900">{step.label}</p>
                      {step.description && <p className="font-sans text-xs leading-snug text-wood-600">{step.description}</p>}
                    </div>
                    <p className="font-sans text-sm text-wood-900 tabular-nums">{formatMoney(step.amountCents, invoice.currency)}</p>
                  </div>
                ))}
              </div>
            ) : currentStep && (
              <p className="font-sans text-sm leading-snug text-wood-700">
                {singleStepHeading && <span className="font-semibold text-wood-900">{singleStepHeading}{currentStep.description && ' · '}</span>}
                {currentStep.description}
              </p>
            )}
            {!totalDueToday && <div className="ml-auto flex w-full max-w-xs items-baseline justify-between gap-3 pt-1">
              <p className="font-sans text-sm font-semibold text-wood-900">Due today</p>
              <p className="text-right font-serif text-xl leading-tight text-wood-900 tabular-nums">
                <span key={`due-${choiceChanges}`} className={flashClass}>
                  {displayDueToday === null ? 'Confirm with the studio' : formatMoney(displayDueToday, invoice.currency)}
                </span>
              </p>
            </div>}
          </section>
        )}

        <section className="print-tight-top pt-2.5">
          {balanceDue > 0 && displayDueToday !== null && displayDueToday > 0 && <div>
            {paymentOptions.length > 1 && (
              <div className="invoice-print-hide mb-2 flex flex-wrap gap-2" role="group" aria-label="Payment method">
                {paymentOptions.map((option, index) => (
                  <PaymentButton
                    key={`${option.label}-${index}`}
                    option={option}
                    active={index === selectedPaymentIndex}
                    onClick={() => setSelectedPaymentIndex(index)}
                  />
                ))}
              </div>
            )}

            <div className="bg-paper-50 px-3 py-2.5">
              {selectedPayment ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div>
                      <h2 className="font-serif text-xl leading-tight text-wood-900">{selectedPayment.label}</h2>
                      {comparableText(selectedPayment.label) !== comparableText(methodLabel(selectedPayment.method)) && (
                        <p className="font-label text-xs text-wood-600">{methodLabel(selectedPayment.method)}</p>
                      )}
                    </div>
                    {paymentAction && (
                      <a
                        href={paymentAction.href}
                        target="_blank"
                        rel="noreferrer"
                        className="invoice-print-hide btn btn-primary"
                      >
                        {paymentAction.label}
                      </a>
                    )}
                  </div>
                  {selectedPayment.instructions && (
                    <p className="mt-1 whitespace-pre-line font-sans text-sm leading-snug text-wood-800">
                      {selectedPayment.instructions}
                    </p>
                  )}
                  {selectedPayment.details && isWiseMethod(selectedPayment.method) ? (
                    <div className="mt-2">
                      <p className="font-label text-xs text-wood-600">Send to this Wisetag</p>
                      <p className="font-sans text-base leading-tight text-wood-900 [overflow-wrap:anywhere]">{selectedPayment.details}</p>
                    </div>
                  ) : selectedPayment.details ? (
                    <pre className="pay-details mt-2 whitespace-pre-wrap font-sans text-sm leading-snug text-wood-800 [overflow-wrap:anywhere]">
                      {selectedPayment.details}
                    </pre>
                  ) : null}
                  {selectedPayment.url && (
                    <p className="print-only mt-2 hidden break-all font-sans text-xs text-wood-600">
                      {selectedPayment.url}
                    </p>
                  )}
                  {/* Fallback so the buyer always knows how to pay, even if a
                      method's link/details were not filled in. */}
                  {!selectedPayment.url && !selectedPayment.details && !selectedPayment.instructions && (
                    <p className="mt-2 font-sans text-xs leading-snug text-wood-600">
                      Payment details for {selectedPayment.label} will be sent to you directly. Reply to this invoice or contact the studio to arrange payment.
                    </p>
                  )}
                  {isWiseMethod(selectedPayment.method) && (
                    <p className="invoice-print-hide mt-2 font-sans text-xs leading-snug text-wood-600">
                      New to Wise?{' '}
                      <a
                        href={WISE_REFERRAL_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-bronze-700 underline hover:text-bronze-800"
                      >
                        Sign up free here
                      </a>{' '}
                      to send your payment with low fees.
                    </p>
                  )}
                </>
              ) : (
                <p className="font-sans text-sm text-wood-700">Payment details will be provided separately.</p>
              )}
            </div>
          </div>}
          {invoice.notes && (
            <div className="mt-2 border-t border-wood-200 pt-2">
              <p className="mb-1 font-label text-xs font-semibold text-wood-600">
                Notes
              </p>
              <p className="whitespace-pre-line font-sans text-sm leading-snug text-wood-700">{invoice.notes}</p>
            </div>
          )}
        </section>
      </article>
    </section>
  );
};

const PaymentButton: React.FC<{
  option: InvoicePaymentOption;
  active: boolean;
  onClick: () => void;
}> = ({ option, active, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={active ? 'chip is-active' : 'chip'}
  >
    {option.label}
  </button>
);

export default PublicInvoice;
