import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Invoice, InvoicePaymentOption } from './invoices/invoiceTypes';
import { WISE_REFERRAL_URL, formatMoney, isWiseMethod, methodLabel } from './invoices/invoiceUtils';

async function readInvoice(token: string): Promise<Invoice> {
  const res = await fetch(`/api/invoices/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'not_found');
  return data.invoice as Invoice;
}

function formatDate(value?: string | null): string {
  if (!value) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const PublicInvoice: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('not_found');
      setLoading(false);
      return;
    }

    readInvoice(token)
      .then(data => {
        setInvoice(data);
        setSelectedPaymentIndex(0);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'not_found'))
      .finally(() => setLoading(false));
  }, [token]);

  const paymentOptions = invoice?.paymentOptions || [];
  const selectedPayment = paymentOptions[selectedPaymentIndex] || paymentOptions[0] || null;
  const currentStep = invoice?.paymentSchedule[invoice.currentStepIndex] || invoice?.paymentSchedule[0] || null;
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

  if (loading) {
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
        <div className="mx-auto max-w-xl border border-wood-200 bg-white p-8">
          <p className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700 font-semibold mb-3">
            Invoice
          </p>
          <h1 className="font-serif text-3xl text-wood-900 mb-4">Invoice not available</h1>
          <p className="font-sans text-sm leading-relaxed text-wood-700">
            {error === 'db_not_configured'
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

  return (
    <section className="invoice-light min-h-screen bg-paper-100 px-4 py-8 print:bg-white print:p-0">
      <style>{`
        .invoice-a4 {
          width: min(100%, 210mm);
          min-height: 297mm;
        }
        @media print {
          @page { size: A4; margin: 0; }
          html, body, #root { background: white !important; }
          /* Keep the whole invoice on a single A4 sheet. Screen-comfortable
             padding plus a filled-in bank-details block ran ~29mm past one
             page, so print uses a tighter page padding, compresses the
             section rhythm, shrinks the bank-details block, and neutralizes
             the screen-only bottom-stretch. */
          .invoice-a4 {
            width: 210mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            padding: 8mm 12mm !important;
          }
          .invoice-a4 .mt-auto { margin-top: 0 !important; }
          .invoice-a4 > * { break-inside: avoid; }
          /* Trim each section's vertical padding. */
          .invoice-a4 .print-tight { padding-top: 0.35rem !important; padding-bottom: 0.35rem !important; }
          .invoice-a4 .print-tight-top { padding-top: 0.35rem !important; }
          .invoice-a4 header { padding-bottom: 0.4rem !important; }
          /* Compress the payment-schedule step cards. */
          .invoice-a4 .pay-step { padding: 0.3rem 0.6rem !important; }
          /* Shrink the bank/account details block (the tallest element). */
          .invoice-a4 .pay-details {
            font-size: 10px !important;
            line-height: 1.35 !important;
            margin-top: 0.35rem !important;
            padding-top: 0.35rem !important;
          }
          .invoice-print-hide { display: none !important; }
        }
      `}</style>

      <div className="invoice-print-hide mx-auto mb-5 flex max-w-[210mm] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-600 hover:text-bronze-700">
          Adrian Rasmussen
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="border border-wood-300 bg-white px-4 py-2.5 font-label text-xs uppercase tracking-[0.12em] text-wood-800 hover:border-bronze-500 hover:text-bronze-800"
        >
          Print / save PDF
        </button>
      </div>

      <article className="invoice-a4 mx-auto flex flex-col border border-wood-200 bg-white px-7 py-7 shadow-sm sm:px-9 sm:py-8 print:px-[14mm] print:py-[12mm]">
        <header className="border-b border-wood-900 pb-4">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-title text-4xl leading-none text-wood-900">Adrian Rasmussen</h1>
              <p className="mt-1 font-sans text-sm text-wood-700">Multidisciplinary artist · adrianrasmussen.com</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700 font-semibold">Invoice</p>
              <p className="font-serif text-2xl text-wood-900">{invoice.invoiceNumber}</p>
              <p className="font-sans text-sm text-wood-600">{formatDate(invoiceDate)}</p>
            </div>
          </div>
        </header>

        <div className="print-tight grid gap-6 border-b border-wood-200 py-4 sm:grid-cols-[1fr_1.15fr]">
          <section>
            <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-2">
              Prepared for
            </p>
            <h2 className="font-serif text-[1.45rem] leading-tight text-wood-900">{invoice.clientName}</h2>
            {invoice.clientEmail && <p className="font-sans text-sm text-wood-700">{invoice.clientEmail}</p>}
            {invoice.clientLocation && <p className="font-sans text-sm text-wood-700">{invoice.clientLocation}</p>}
          </section>

          <section>
            <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-2">
              Job
            </p>
            <h2 className="font-serif text-[1.45rem] leading-tight text-wood-900">{invoice.jobTitle}</h2>
            <p className="mt-1 whitespace-pre-line font-sans text-sm leading-snug text-wood-700">
              {invoice.jobDescription}
            </p>
          </section>
        </div>

        <section className="print-tight border-b border-wood-200 py-4">
          <div className="grid grid-cols-[1fr_90px] gap-4 border-b border-wood-200 pb-2 font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold">
            <span>Description</span>
            <span className="text-right">Amount</span>
          </div>
          <div>
            {invoice.lineItems.map((item, index) => (
              <div key={`${item.description}-${index}`} className="grid grid-cols-[1fr_90px] gap-4 border-b border-wood-100 py-2">
                <div>
                  <p className="font-sans text-sm text-wood-900">{item.description}</p>
                  {item.terms && <p className="font-sans text-xs text-wood-600">{item.terms}</p>}
                </div>
                <p className="text-right font-sans text-sm text-wood-900">
                  {formatMoney(item.amountCents, invoice.currency)}
                </p>
              </div>
            ))}
          </div>
          <div className="ml-auto mt-3 w-full max-w-xs space-y-1.5">
            <div className="flex items-center justify-between font-sans text-sm text-wood-700">
              <span>Subtotal</span>
              <span>{formatMoney(invoice.subtotalCents, invoice.currency)}</span>
            </div>
            <div className="flex items-center justify-between font-sans text-sm text-wood-700">
              <span>Shipping</span>
              <span>{invoice.shippingText}</span>
            </div>
            <div className="flex items-center justify-between border-t border-wood-900 pt-2 font-serif text-2xl text-wood-900">
              <span>Total</span>
              <span>{formatMoney(invoice.totalCents, invoice.currency)}</span>
            </div>
          </div>
        </section>

        <section className="print-tight grid gap-4 border-b border-wood-200 py-4 sm:grid-cols-[1fr_190px]">
          <div>
            <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-3">
              Payment schedule
            </p>
            <div className="space-y-1.5">
              {invoice.paymentSchedule.map((step, index) => (
                <div key={`${step.label}-${index}`} className={`pay-step border px-3 py-2 ${index === invoice.currentStepIndex ? 'border-bronze-500 bg-bronze-50' : 'border-wood-200 bg-paper-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500">
                        Step {index + 1} · {step.dueTiming}
                      </p>
                      <p className="font-sans text-sm text-wood-900">{step.label}</p>
                      <p className="font-sans text-xs leading-snug text-wood-600">{step.description}</p>
                    </div>
                    <p className="font-sans text-sm text-wood-900">{formatMoney(step.amountCents, invoice.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-wood-900 bg-wood-900 p-3 text-paper-50 sm:mt-7">
            <p className="font-label text-[11px] uppercase tracking-[0.12em] text-paper-200 font-semibold">Due today</p>
            <p className="font-serif text-3xl leading-tight">{formatMoney(invoice.dueTodayCents, invoice.currency)}</p>
            {currentStep && (
              <p className="mt-1 font-sans text-sm leading-snug text-paper-200">
                Current step: {currentStep.label}
              </p>
            )}
          </div>
        </section>

        <section className="print-tight-top mt-auto pt-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1.35fr]">
            <div>
              <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-3">
                Payment method
              </p>
              <div className="grid gap-2">
                {paymentOptions.map((option, index) => (
                  <PaymentButton
                    key={`${option.label}-${index}`}
                    option={option}
                    active={index === selectedPaymentIndex}
                    onClick={() => setSelectedPaymentIndex(index)}
                  />
                ))}
              </div>
            </div>

            <div className="border border-wood-200 bg-paper-50 p-3 sm:mt-7">
              {selectedPayment ? (
                <>
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-label text-[11px] uppercase tracking-[0.12em] text-bronze-700 font-semibold">
                        {methodLabel(selectedPayment.method)}
                      </p>
                      <h2 className="font-serif text-[1.35rem] leading-tight text-wood-900">{selectedPayment.label}</h2>
                    </div>
                    {paymentAction && (
                      <a
                        href={paymentAction.href}
                        target="_blank"
                        rel="noreferrer"
                        className="invoice-print-hide shrink-0 bg-wood-900 px-4 py-2.5 text-center font-label text-[11px] uppercase tracking-[0.12em] text-paper-50 hover:bg-bronze-700"
                      >
                        {paymentAction.label}
                      </a>
                    )}
                  </div>
                  {selectedPayment.instructions && (
                    <p className="whitespace-pre-line font-sans text-sm leading-snug text-wood-800">
                      {selectedPayment.instructions}
                    </p>
                  )}
                  {selectedPayment.details && (
                    <pre className="pay-details mt-2 whitespace-pre-wrap border-t border-wood-200 pt-2 font-sans text-xs leading-snug text-wood-800">
                      {selectedPayment.details}
                    </pre>
                  )}
                  {selectedPayment.url && (
                    <p className="mt-3 break-all font-sans text-xs text-wood-600">
                      {selectedPayment.url}
                    </p>
                  )}
                  {isWiseMethod(selectedPayment.method) && (
                    <p className="invoice-print-hide mt-3 border-t border-wood-200 pt-2 font-sans text-xs leading-snug text-wood-600">
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
          </div>

          {invoice.notes && (
            <div className="mt-4 border-t border-wood-200 pt-3">
              <p className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 font-semibold mb-2">
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
    onClick={onClick}
    className={`border px-3 py-2 text-left transition-colors ${
      active
        ? 'border-bronze-600 bg-bronze-600 text-paper-50'
        : 'border-wood-300 bg-white text-wood-800 hover:border-bronze-500'
    }`}
  >
    <span className="block font-sans text-sm">{option.label}</span>
    <span className={`block font-label text-[11px] uppercase tracking-[0.12em] ${active ? 'text-paper-200' : 'text-wood-500'}`}>
      {methodLabel(option.method)}
    </span>
  </button>
);

export default PublicInvoice;
