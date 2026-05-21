import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Steward claim form. Rendered at `/atlas/claim`.
 *
 * A collector enters the raw key printed on their certificate. On success
 * the server sets an HttpOnly `steward_session` cookie scoped to the
 * (pieceId, editionNumber) pair, and we redirect to `/atlas/edit`, which
 * rehydrates its state from that cookie.
 *
 * See docs/ledger-api.md → POST /api/atlas/steward/claim.
 */
const StewardClaim: React.FC = () => {
  const [rawKey, setRawKey] = useState('');
  const [error, setError] = useState<'unrecognized' | 'generic' | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async () => {
    const trimmed = rawKey.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/atlas/steward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ rawKey: trimmed }),
      });
      if (res.status === 200) {
        navigate('/atlas/edit', { replace: true });
        return;
      }
      if (res.status === 401) {
        setError('unrecognized');
      } else {
        setError('generic');
      }
    } catch {
      setError('generic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="font-display text-3xl text-wood-900 font-medium text-center mb-6 tracking-wide" style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}>
          Claim your piece
        </h1>
        <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 text-center mb-10">
          If you hold one of Adrian Rasmussen's pieces, enter the key from your certificate to anchor it on the atlas. Only your city will appear publicly, never an address. You can switch to private at any time.
        </p>
        <div className="space-y-4">
          <label htmlFor="steward-key" className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold">
            Key
          </label>
          <input
            id="steward-key"
            type="text"
            value={rawKey}
            onChange={e => setRawKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="A3kf-9zPq-WxLm-7nQr"
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="w-full border border-wood-300 bg-white px-4 py-3 font-mono text-base text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400 tracking-wide"
          />
          {error === 'unrecognized' && (
            <p className="font-serif italic text-base text-stone-600">
              That key was not recognized.
            </p>
          )}
          {error === 'generic' && (
            <p className="font-serif italic text-base text-stone-600">
              Something went wrong, please try again.
            </p>
          )}
          <button
            onClick={submit}
            disabled={!rawKey.trim() || loading}
            className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
          >
            {loading ? 'Checking...' : 'Continue'}
          </button>
        </div>
      </div>
    </section>
  );
};

export default StewardClaim;
