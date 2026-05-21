import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { CITIES } from '../data/cities';
import { FULL_ARCHIVE } from '../data/mockData';
import type { CityCentroid, LedgerEvent, LedgerEventType, StewardRecord } from '../types';

// ───────────────────────────────────────────────────────────────────────────
// Style tokens — mirrored from AdminPoetry.tsx so this page sits beside it
// without drift. Keep these strings identical to that file.
// ───────────────────────────────────────────────────────────────────────────
const fieldLabel =
    'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
const fieldInput =
    'w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';
const sectionTitle =
    'font-title text-2xl text-wood-900 mb-2 tracking-[0.05em]';
const sectionLead =
    'font-sans text-sm text-wood-500 mb-6';

const EVENT_TYPES: LedgerEventType[] = [
    'created',
    'placed',
    'moved',
    'withdrawn',
    'revealed',
    'retired',
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

interface PieceOption {
    id: string;
    label: string;
}

// Order: drop SOLD pieces to the bottom but keep them selectable.
// Label format: "title (series · year)" (or "title (category · year)" when no series).
const pieceOptions: PieceOption[] = FULL_ARCHIVE
    .map((a) => ({
        id: a.id,
        label: `${a.title} (${a.series ?? a.category} · ${a.year})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

const pieceById = new Map(FULL_ARCHIVE.map((a) => [a.id, a]));

const resolvePieceTitle = (pieceId: string, editionNumber?: number): string => {
    const a = pieceById.get(pieceId);
    const base = a ? a.title : pieceId;
    return editionNumber ? `${base} · #${editionNumber}` : base;
};

const formatNow = (): string => {
    // datetime-local wants 'YYYY-MM-DDTHH:mm' in local time.
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

const formatRelative = (iso: string | null | undefined): string => {
    if (!iso) return '—';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return '—';
    const diff = Date.now() - ts;
    const s = Math.round(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const days = Math.round(h / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} mo ago`;
    const years = Math.round(months / 12);
    return `${years} yr ago`;
};

// ───────────────────────────────────────────────────────────────────────────
// City autocomplete
// ───────────────────────────────────────────────────────────────────────────

const CityAutocomplete: React.FC<{
    value: string;
    onChange: (cityId: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
    const [query, setQuery] = useState<string>(() => {
        if (!value) return '';
        const c = CITIES.find((x) => x.id === value);
        return c ? `${c.city}, ${c.country}` : value;
    });
    const [open, setOpen] = useState(false);

    const matches = useMemo<CityCentroid[]>(() => {
        const q = query.trim().toLowerCase();
        if (!q) return CITIES.slice(0, 8);
        return CITIES.filter((c) => {
            const hay = `${c.city} ${c.country} ${c.region ?? ''} ${c.id}`.toLowerCase();
            return hay.includes(q);
        }).slice(0, 12);
    }, [query]);

    const pick = (c: CityCentroid) => {
        onChange(c.id);
        setQuery(`${c.city}, ${c.country}`);
        setOpen(false);
    };

    return (
        <div className="relative">
            <input
                type="text"
                value={query}
                onFocus={() => setOpen(true)}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onChange={(e) => {
                    setQuery(e.target.value);
                    onChange('');
                    setOpen(true);
                }}
                placeholder={placeholder ?? 'Lisbon, Portugal'}
                className={fieldInput}
            />
            {open && matches.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-wood-300 shadow-sm">
                    {matches.map((c) => (
                        <li key={c.id}>
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(c);
                                }}
                                className="w-full text-left px-4 py-2 font-sans text-sm text-wood-700 hover:bg-paper-100 hover:text-bronze-700"
                            >
                                {c.city}, {c.country}
                                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 ml-2">
                                    {c.id}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {value && (
                <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 mt-1">
                    Selected: {value}
                </p>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Seed Event form
// ───────────────────────────────────────────────────────────────────────────

interface EventForm {
    pieceId: string;
    editionNumber: string;
    type: LedgerEventType;
    date: string;
    cityId: string;
    note: string;
}

const EMPTY_EVENT: EventForm = {
    pieceId: '',
    editionNumber: '',
    type: 'created',
    date: formatNow(),
    cityId: '',
    note: '',
};

const SeedEventSection: React.FC = () => {
    const [form, setForm] = useState<EventForm>(EMPTY_EVENT);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<LedgerEvent | null>(null);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!form.pieceId) {
            setError('Pick a piece.');
            return;
        }
        if (!form.type) {
            setError('Pick an event type.');
            return;
        }
        setSaving(true);
        setError(null);
        setResult(null);
        try {
            const event = {
                id: crypto.randomUUID(),
                pieceId: form.pieceId,
                editionNumber: form.editionNumber
                    ? Number(form.editionNumber)
                    : undefined,
                type: form.type,
                date: form.date
                    ? new Date(form.date).toISOString()
                    : new Date().toISOString(),
                cityId: form.cityId || null,
                note: form.note.trim() || undefined,
                actor: 'admin' as const,
            };
            const res = await fetch('/api/atlas/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event }),
            });
            if (res.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.event) {
                setResult(data.event as LedgerEvent);
                setForm({ ...EMPTY_EVENT, date: formatNow() });
            } else {
                setError(data?.error || 'Could not append event.');
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Seed Event</h2>
            <p className={sectionLead}>
                Append a new event to the per-piece ledger. The hash chain is
                computed server-side.
            </p>

            {error && (
                <p className="font-serif italic text-sm text-stone-600 mb-4">
                    {error}
                </p>
            )}

            {result && (
                <div className="mb-6 border border-bronze-300 bg-bronze-50 px-4 py-3">
                    <p className="font-sans text-sm text-bronze-800 mb-2">
                        Event appended.
                    </p>
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 mb-1">
                        Hash
                    </p>
                    <code className="block font-mono text-xs text-wood-900 break-all">
                        {result.hash}
                    </code>
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className={fieldLabel}>Piece</label>
                    <select
                        value={form.pieceId}
                        onChange={(e) =>
                            setForm({ ...form, pieceId: e.target.value })
                        }
                        className={fieldInput}
                    >
                        <option value="">Choose a piece...</option>
                        {pieceOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Edition number (optional)</label>
                        <input
                            type="number"
                            min={1}
                            value={form.editionNumber}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    editionNumber: e.target.value,
                                })
                            }
                            placeholder="1"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Event type</label>
                        <select
                            value={form.type}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    type: e.target.value as LedgerEventType,
                                })
                            }
                            className={fieldInput}
                        >
                            {EVENT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Date</label>
                        <input
                            type="datetime-local"
                            value={form.date}
                            onChange={(e) =>
                                setForm({ ...form, date: e.target.value })
                            }
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>City</label>
                        <CityAutocomplete
                            value={form.cityId}
                            onChange={(cityId) => setForm({ ...form, cityId })}
                        />
                    </div>
                </div>

                <div>
                    <label className={fieldLabel}>Note (admin-private)</label>
                    <textarea
                        value={form.note}
                        onChange={(e) =>
                            setForm({ ...form, note: e.target.value })
                        }
                        rows={3}
                        placeholder="From Adrian's notebook, p.42"
                        className={`${fieldInput} font-serif text-base leading-[1.7] resize-y`}
                    />
                </div>

                <button
                    onClick={submit}
                    disabled={saving}
                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                    {saving ? 'Appending...' : 'Append event'}
                </button>
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Issue Steward Key
// ───────────────────────────────────────────────────────────────────────────

interface StewardForm {
    pieceId: string;
    editionNumber: string;
    name: string;
    email: string;
}

const EMPTY_STEWARD: StewardForm = {
    pieceId: '',
    editionNumber: '',
    name: '',
    email: '',
};

const IssueStewardKeySection: React.FC<{ onIssued: () => void }> = ({
    onIssued,
}) => {
    const [form, setForm] = useState<StewardForm>(EMPTY_STEWARD);
    const [saving, setSaving] = useState(false);
    const [rawKey, setRawKey] = useState<string | null>(null);
    const [warning, setWarning] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const submit = async () => {
        if (!form.pieceId) {
            setError('Pick a piece.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const body = {
                pieceId: form.pieceId,
                editionNumber: form.editionNumber
                    ? Number(form.editionNumber)
                    : undefined,
                name: form.name.trim() || undefined,
                email: form.email.trim() || undefined,
            };
            const res = await fetch('/api/atlas/stewards/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.rawKey) {
                setRawKey(data.rawKey);
                setWarning(
                    data.warning ??
                        'This key will only be shown once. Print or copy it now.',
                );
                setForm(EMPTY_STEWARD);
                onIssued();
            } else {
                setError(data?.error || 'Could not issue key.');
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    const copy = async () => {
        if (!rawKey) return;
        try {
            await navigator.clipboard.writeText(rawKey);
            setCopied(true);
        } catch {
            // ignore; user can select and copy manually
        }
    };

    const dismiss = () => {
        setRawKey(null);
        setWarning('');
        setCopied(false);
    };

    return (
        <div className="bg-white border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Issue Steward Key</h2>
            <p className={sectionLead}>
                Generates a one-time key for a collector. The raw key is shown
                once on this screen and never stored.
            </p>

            {error && (
                <p className="font-serif italic text-sm text-stone-600 mb-4">
                    {error}
                </p>
            )}

            {rawKey && (
                <div className="mb-6 border border-bronze-400 bg-bronze-50 px-4 py-4">
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold mb-2">
                        New steward key
                    </p>
                    <code className="block font-mono text-base text-wood-900 break-all bg-white border border-wood-200 px-3 py-2 mb-3">
                        {rawKey}
                    </code>
                    <p className="font-serif italic text-sm text-stone-700 mb-3">
                        {warning}
                    </p>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={copy}
                            className="font-label text-[11px] uppercase tracking-[0.15em] text-paper-50 bg-wood-900 hover:bg-bronze-700 transition-colors font-semibold px-4 py-2"
                        >
                            {copied ? 'Copied' : 'Copy key'}
                        </button>
                        <button
                            type="button"
                            onClick={dismiss}
                            className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 font-semibold"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className={fieldLabel}>Piece</label>
                    <select
                        value={form.pieceId}
                        onChange={(e) =>
                            setForm({ ...form, pieceId: e.target.value })
                        }
                        className={fieldInput}
                    >
                        <option value="">Choose a piece...</option>
                        {pieceOptions.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Edition number (optional)</label>
                        <input
                            type="number"
                            min={1}
                            value={form.editionNumber}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    editionNumber: e.target.value,
                                })
                            }
                            placeholder="1"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Name (optional)</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            placeholder="Maya"
                            className={fieldInput}
                        />
                    </div>
                </div>

                <div>
                    <label className={fieldLabel}>Email (optional)</label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                        }
                        placeholder="collector@example.com"
                        className={fieldInput}
                    />
                </div>

                <button
                    onClick={submit}
                    disabled={saving}
                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                    {saving ? 'Issuing...' : 'Issue key'}
                </button>
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Steward Roster
// ───────────────────────────────────────────────────────────────────────────

const StewardRoster: React.FC<{
    stewards: StewardRecord[];
    loading: boolean;
    error: string | null;
}> = ({ stewards, loading, error }) => {
    return (
        <div className="bg-white border border-wood-200 p-8">
            <h2 className={sectionTitle}>Steward Roster</h2>
            <p className={sectionLead}>
                Read-only view of issued keys. Hashes are never shown.
            </p>

            {error && (
                <p className="font-serif italic text-sm text-stone-600">
                    {error}
                </p>
            )}

            {loading && (
                <p className="font-sans text-sm text-wood-400">Loading...</p>
            )}

            {!loading && !error && stewards.length === 0 && (
                <p className="font-sans text-sm text-wood-400">
                    No stewards issued yet.
                </p>
            )}

            {!loading && stewards.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-wood-200">
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Piece
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Name
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Email
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Status
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Issued
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2">
                                    Last claim
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stewards.map((s, i) => (
                                <tr
                                    key={`${s.pieceId}-${s.editionNumber ?? 0}-${i}`}
                                    className="border-b border-wood-100"
                                >
                                    <td className="font-serif text-base text-wood-900 py-3 pr-4">
                                        {resolvePieceTitle(
                                            s.pieceId,
                                            s.editionNumber,
                                        )}
                                    </td>
                                    <td className="font-sans text-sm text-wood-700 py-3 pr-4">
                                        {s.name ?? '—'}
                                    </td>
                                    <td className="font-sans text-sm text-wood-700 py-3 pr-4">
                                        {s.email ?? '—'}
                                    </td>
                                    <td className="font-sans text-sm text-wood-700 py-3 pr-4">
                                        {s.outreachStatus}
                                    </td>
                                    <td className="font-sans text-sm text-wood-500 py-3 pr-4">
                                        {formatRelative(s.keyIssuedAt)}
                                    </td>
                                    <td className="font-sans text-sm text-wood-500 py-3">
                                        {s.lastClaimAt
                                            ? formatRelative(s.lastClaimAt)
                                            : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

const AdminAtlas: React.FC = () => {
    const [stewards, setStewards] = useState<StewardRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [rosterError, setRosterError] = useState<string | null>(null);

    const loadStewards = async () => {
        setLoading(true);
        setRosterError(null);
        try {
            const res = await fetch('/api/atlas/stewards');
            if (res.status === 401) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setStewards(data.stewards || []);
            } else {
                setRosterError(data?.error || 'Could not load roster.');
            }
        } catch {
            setRosterError('Could not load roster.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStewards();
    }, []);

    return (
        <AdminLayout>
            <section className="pt-12 pb-32 px-6">
                <div className="max-w-2xl mx-auto">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
                        Admin
                    </p>
                    <h1 className="font-title text-4xl text-wood-900 mb-2 tracking-[0.05em]">
                        Atlas
                    </h1>
                    <p className="font-sans text-sm text-wood-500 mb-12">
                        Seed ledger events and issue steward keys for the world
                        map.
                    </p>

                    <SeedEventSection />
                    <IssueStewardKeySection onIssued={loadStewards} />
                    <StewardRoster
                        stewards={stewards}
                        loading={loading}
                        error={rosterError}
                    />
                </div>
            </section>
        </AdminLayout>
    );
};

export default AdminAtlas;
