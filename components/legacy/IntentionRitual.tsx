import React, { useEffect, useState } from 'react';
import { useAccount } from '../../lib/account/useAccount';

/**
 * IntentionRitual — the deep door's ceremony: compose → confirm-before-it-sets
 * → locked for the year. Journaling stays open anytime; only the yearly
 * motivation locks (and only inside the steward's birthday window).
 *
 * The body never touches the chain: the server stores it with a random salt and
 * writes only a salted commitment toward the ledger. This component only ever
 * sends/receives the plain body over the authed session; the hashing happens
 * server-side (functions/api/keeper/intention.js).
 *
 * Design system: paper/wood/stone/bronze, Cormorant/Lato/Cinzel, middle-dot
 * separators, no em dashes, no icons, no badges. Calm pacing, nothing loud.
 */

const INTENTION_MAX = 2000;

interface IntentionView {
  id: string;
  kind: 'motivation' | 'journal';
  state: 'erased' | 'pending' | 'locked' | 'open';
  createdAt: string;
  confirmedAt?: string;
  setsForYear?: number;
  body?: string;
}

interface BirthdayWindow {
  open: boolean;
  distanceDays: number;
}

export const IntentionRitual: React.FC<{ pieceId: string; editionNumber?: number }> = ({
  pieceId,
  editionNumber = 0,
}) => {
  const { fetchAuthed, isSignedIn, isLoaded } = useAccount();
  const [intentions, setIntentions] = useState<IntentionView[]>([]);
  const [birthday, setBirthday] = useState<BirthdayWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pieceId, editionNumber: String(editionNumber) });
      const res = await fetchAuthed(`/api/keeper/intention?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIntentions(Array.isArray(data.intentions) ? data.intentions : []);
        setBirthday(data.birthdayWindow ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchAuthed, pieceId, editionNumber]);

  useEffect(() => {
    if (isLoaded && isSignedIn) void load();
  }, [isLoaded, isSignedIn, load]);

  const lockedThisYear = intentions.find(
    (i) => i.kind === 'motivation' && i.state === 'locked' && i.setsForYear === new Date().getUTCFullYear(),
  );
  const pendingMotivation = intentions.find(
    (i) => i.kind === 'motivation' && i.state === 'pending',
  );
  const journals = intentions.filter((i) => i.kind === 'journal' && i.state === 'open');

  if (loading) {
    return <p className="font-sans text-[13px] text-wood-400 text-center py-6">Listening.</p>;
  }

  return (
    <div className="space-y-12">
      {/* ── The yearly intention ── */}
      <section>
        <SectionLabel>This Year’s Intention</SectionLabel>
        {lockedThisYear ? (
          <LockedIntention intention={lockedThisYear} />
        ) : pendingMotivation ? (
          <ConfirmStep
            intention={pendingMotivation}
            pieceId={pieceId}
            editionNumber={editionNumber}
            onChanged={load}
            onError={setError}
          />
        ) : (
          <ComposeMotivation
            pieceId={pieceId}
            editionNumber={editionNumber}
            birthday={birthday}
            onChanged={load}
            onError={setError}
          />
        )}
      </section>

      {/* ── Journaling (anytime) ── */}
      <section>
        <SectionLabel>Journal</SectionLabel>
        <p className="font-sans text-[13px] text-wood-500 leading-[1.8] mb-5 text-center max-w-md mx-auto">
          A reflection you may write anytime. It does not lock. It simply stays with the piece.
        </p>
        <ComposeJournal
          pieceId={pieceId}
          editionNumber={editionNumber}
          onChanged={load}
          onError={setError}
        />
        {journals.length > 0 && (
          <div className="mt-8 space-y-5 max-w-md mx-auto">
            {journals.map((j) => (
              <article key={j.id} className="border-l border-bronze-200 pl-4">
                <p className="font-serif text-[15px] text-wood-600 leading-[1.8] whitespace-pre-line">
                  {j.body}
                </p>
                <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-300 font-semibold mt-2">
                  {formatDate(j.createdAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      {error && (
        <p className="font-sans text-[13px] text-bronze-700 text-center">{error}</p>
      )}
    </div>
  );
};

// ── The locked intention, set and held ──

function LockedIntention({ intention }: { intention: IntentionView }) {
  return (
    <div className="max-w-md mx-auto text-center animate-fade-in">
      <p className="font-serif text-lg md:text-xl text-wood-700 italic leading-[1.7] mb-4 whitespace-pre-line">
        {intention.body}
      </p>
      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600 font-semibold">
        Set for {intention.setsForYear} · It holds until next year
      </p>
    </div>
  );
}

// ── Compose the yearly motivation (only inside the birthday window) ──

function ComposeMotivation({
  pieceId,
  editionNumber,
  birthday,
  onChanged,
  onError,
}: {
  pieceId: string;
  editionNumber: number;
  birthday: BirthdayWindow | null;
  onChanged: () => void;
  onError: (m: string | null) => void;
}) {
  const { fetchAuthed } = useAccount();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const windowOpen = birthday?.open ?? false;

  if (!windowOpen) {
    return (
      <p className="font-sans text-[14px] text-wood-500 leading-[1.8] text-center max-w-md mx-auto">
        The yearly intention is set in the days around your birthday. When that window opens, this
        is where you will fuse it into the piece. Your journaling stays open anytime.
      </p>
    );
  }

  const submit = async () => {
    onError(null);
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetchAuthed('/api/keeper/intention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId, editionNumber, action: 'compose', kind: 'motivation', body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.message || 'That intention could not be composed right now.');
        return;
      }
      setText('');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <p className="font-serif text-[16px] text-wood-600 leading-[1.8] text-center mb-6">
        What do you set into motion this year?
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, INTENTION_MAX))}
        rows={4}
        placeholder="Write it as you mean it."
        className="w-full bg-paper-50 border border-wood-200 px-4 py-3 font-serif text-[16px] text-wood-700 leading-[1.7] focus:outline-none focus:border-bronze-400 transition-colors resize-none"
      />
      <div className="flex items-center justify-between mt-4">
        <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-300 font-semibold tabular-nums">
          {text.trim().length} · {INTENTION_MAX}
        </span>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="px-7 py-3 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors disabled:opacity-40"
        >
          {busy ? 'Composing' : 'Compose'}
        </button>
      </div>
    </div>
  );
}

// ── Confirm-before-it-sets, with the grace window ──

function ConfirmStep({
  intention,
  pieceId,
  editionNumber,
  onChanged,
  onError,
}: {
  intention: IntentionView;
  pieceId: string;
  editionNumber: number;
  onChanged: () => void;
  onError: (m: string | null) => void;
}) {
  const { fetchAuthed } = useAccount();
  const [busy, setBusy] = useState(false);
  // Grace countdown mirrors the server floor (CONFIRM_GRACE_MS = 30s). The
  // server is authoritative; this only paces the UI so the button settles.
  const graceUntil = new Date(intention.createdAt).getTime() + 30 * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  const remainingMs = Math.max(0, graceUntil - now);
  const ready = remainingMs <= 0;

  const confirm = async () => {
    onError(null);
    setBusy(true);
    try {
      const res = await fetchAuthed('/api/keeper/intention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId, editionNumber, action: 'confirm', intentionId: intention.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.message || 'It is not quite ready to set. A moment more.');
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto text-center animate-fade-in">
      <p className="font-label text-[10px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-6">
        See it as the field will see it
      </p>
      <p className="font-serif text-lg md:text-xl text-wood-700 italic leading-[1.7] mb-8 whitespace-pre-line">
        {intention.body}
      </p>
      <button
        onClick={confirm}
        disabled={busy || !ready}
        className="px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors disabled:opacity-40"
      >
        {busy ? 'Setting' : ready ? 'Set it for the year' : 'Take a breath'}
      </button>
      <p className="font-sans text-[12px] text-wood-400 leading-[1.7] mt-5">
        Once set, it holds until next year. Until you confirm, nothing is fixed.
      </p>
    </div>
  );
}

// ── Anytime journal entry ──

function ComposeJournal({
  pieceId,
  editionNumber,
  onChanged,
  onError,
}: {
  pieceId: string;
  editionNumber: number;
  onChanged: () => void;
  onError: (m: string | null) => void;
}) {
  const { fetchAuthed } = useAccount();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    onError(null);
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetchAuthed('/api/keeper/intention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceId, editionNumber, action: 'compose', kind: 'journal', body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError(data.message || 'That entry could not be saved right now.');
        return;
      }
      setText('');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, INTENTION_MAX))}
        rows={3}
        placeholder="A note to the piece."
        className="w-full bg-paper-50 border border-wood-200 px-4 py-3 font-serif text-[15px] text-wood-700 leading-[1.7] focus:outline-none focus:border-bronze-400 transition-colors resize-none"
      />
      <div className="flex justify-end mt-3">
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="px-6 py-2.5 border border-wood-300 text-wood-600 font-label text-[11px] uppercase tracking-[0.15em] font-semibold hover:border-bronze-400 hover:text-bronze-700 transition-colors disabled:opacity-40"
        >
          {busy ? 'Saving' : 'Keep this'}
        </button>
      </div>
    </div>
  );
}

// ── Shared bits ──

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      <div className="h-px w-8 bg-bronze-300" />
      <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold">
        {children}
      </p>
      <div className="h-px w-8 bg-bronze-300" />
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default IntentionRitual;
