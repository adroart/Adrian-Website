import { useEffect, useState } from 'react';
import { useAccount } from '../../../lib/account/useAccount';
import {
  parseKeeperCertificateLedger,
  type KeeperCertificatePrice,
  type PublicArtworkLedgerEntry,
} from '../../../utils/artworkLedger';

type PrivateState =
  | { status: 'idle' | 'loading' | 'hidden' }
  | { status: 'error' }
  | { status: 'ready'; prices: KeeperCertificatePrice[] };

function formatMoney(entry: KeeperCertificatePrice) {
  const formatter = new Intl.NumberFormat(undefined, {
    style: 'currency', currency: entry.currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits;
  return formatter.format(entry.amountMinor / (10 ** digits));
}

function occurrenceLabel(entry: KeeperCertificatePrice) {
  const { precision, value } = entry.occurrence;
  if (precision === 'unknown' || value === null) return 'Date not recorded';
  if (precision === 'year') return value;
  if (precision === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value}-01T00:00:00.000Z`));
  }
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default function CertificateLedger({
  publicCode,
  title,
  publicLedger,
}: {
  publicCode: string;
  title: string;
  publicLedger: PublicArtworkLedgerEntry[];
}) {
  const { available, isLoaded, isSignedIn, userId, fetchAuthed } = useAccount();
  const [state, setState] = useState<PrivateState>({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'idle' });
    if (!available || !isLoaded || !isSignedIn || !userId) return () => controller.abort();
    setState({ status: 'loading' });
    fetchAuthed(
      `/api/keeper/certificate-ledger?publicCode=${encodeURIComponent(publicCode)}`,
      {
        method: 'GET', credentials: 'include', cache: 'no-store', signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (response.status === 403 || response.status === 404) return null;
        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          if (response.status >= 500 && errorBody?.currentKeeper === true) {
            throw Object.assign(new Error('certificate_ledger_unavailable'), { currentKeeper: true });
          }
          return null;
        }
        return parseKeeperCertificateLedger(await response.json());
      })
      .then((prices) => {
        if (!controller.signal.aborted) {
          setState(prices === null ? { status: 'hidden' } : { status: 'ready', prices });
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError' && !controller.signal.aborted) {
          setState(error?.currentKeeper === true ? { status: 'error' } : { status: 'hidden' });
        }
      });
    return () => controller.abort();
  }, [attempt, available, fetchAuthed, isLoaded, isSignedIn, publicCode, userId]);

  const privatePrices = state.status === 'ready' && state.prices.length > 0
    ? state.prices
    : null;
  if (publicLedger.length === 0 && !['ready', 'error'].includes(state.status)) return null;
  if (publicLedger.length === 0 && !privatePrices && state.status !== 'error') return null;

  return (
    <div className="mt-10 space-y-10" data-testid="certificate-ledger">
      {publicLedger.length > 0 && (
        <section aria-labelledby="creator-certificate-notes">
          <p className="collector-eyebrow">From the studio</p>
          <h4 id="creator-certificate-notes" className="sr-only">Creator notes</h4>
          <div className="space-y-8">
            {publicLedger.map((entry) => (
              <article key={entry.id} className="border-l border-bronze-300 pl-5">
                {entry.message && (
                  <p className="font-serif text-[17px] leading-[1.8] text-wood-700">{entry.message}</p>
                )}
                {entry.mediaUrl && (
                  <img
                    src={entry.mediaUrl}
                    alt={`${title}, creator note from the artwork certificate`}
                    className="mt-5 w-full max-w-md"
                    loading="lazy"
                  />
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {privatePrices && (
        <section className="border-t border-wood-200 pt-8" aria-labelledby="certificate-price-history">
          <p className="collector-eyebrow">Private to the current keeper</p>
          <h4 id="certificate-price-history" className="font-serif text-2xl text-wood-900 mb-5">Price history</h4>
          <ol className="space-y-4">
            {privatePrices.map((entry) => (
              <li key={`${entry.recordedAt}:${entry.currency}:${entry.amountMinor}`} className="flex flex-wrap justify-between gap-3 border-b border-wood-100 pb-3">
                <span className="font-sans text-sm text-wood-500">{occurrenceLabel(entry)}</span>
                <span className="font-serif text-lg text-wood-800">{formatMoney(entry)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {state.status === 'error' && (
        <div className="text-center">
          <button
            type="button"
            className="collector-button-secondary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try price history again
          </button>
        </div>
      )}
    </div>
  );
}
