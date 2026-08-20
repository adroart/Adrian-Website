
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { QR_RULES } from '../data/qrRegistry';

type EntryType = 'oracle' | 'artwork' | 'exhibition' | 'custom';

type LiveEntry = {
    source: 'legacy' | 'registry';
    code: string;
    type: EntryType;
    label?: string;
    destination?: string;
    createdAt?: string | null;
    pieceId?: string;
    plateStatus?: string;
    registrationStatus?: string | null;
    registeredAt?: string | null;
};

const TYPE_LABELS: Record<EntryType, string> = {
    oracle: 'Oracle',
    artwork: 'Artwork',
    exhibition: 'Exhibition',
    custom: 'Custom',
};

function isLiveEntry(value: unknown): value is LiveEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<LiveEntry>;
    return (entry.source === 'legacy' || entry.source === 'registry')
        && typeof entry.code === 'string'
        && typeof entry.type === 'string';
}

function isEntryList(value: unknown): value is LiveEntry[] {
    return Array.isArray(value) && value.every(isLiveEntry);
}

function labelOrPiece(entry: LiveEntry): string {
    if (entry.source === 'legacy') return entry.label || '';
    return entry.pieceId || '';
}

function destinationOrStatus(entry: LiveEntry): string {
    if (entry.source === 'legacy') return entry.destination || '';
    const parts = [entry.plateStatus, entry.registrationStatus].filter(Boolean);
    return parts.join(' · ');
}

function created(entry: LiveEntry): string {
    return (entry.source === 'legacy' ? entry.createdAt : entry.registeredAt) || '';
}

type LoadState = 'loading' | 'signed-out' | 'error' | 'ready';

const QRIndex: React.FC = () => {
    const [state, setState] = useState<LoadState>('loading');
    const [entries, setEntries] = useState<LiveEntry[]>([]);
    const [filter, setFilter] = useState<EntryType | 'all'>('all');

    const load = useCallback(async (signal?: AbortSignal) => {
        setState('loading');
        try {
            const response = await fetch('/api/admin/qr-index', { cache: 'no-store', signal });
            if (response.status === 401 || response.status === 403) {
                setEntries([]);
                setState('signed-out');
                return;
            }
            if (!response.ok) throw new Error('qr index unavailable');
            const data: unknown = await response.json();
            const list = data && typeof data === 'object' ? (data as { entries?: unknown }).entries : undefined;
            if (!isEntryList(list)) throw new Error('qr index incomplete');
            setEntries(list);
            setState('ready');
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') return;
            setEntries([]);
            setState('error');
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void load(controller.signal);
        return () => controller.abort();
    }, [load]);

    const filtered = useMemo(
        () => filter === 'all' ? entries : entries.filter(e => e.type === filter),
        [entries, filter],
    );

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: entries.length };
        for (const e of entries) c[e.type] = (c[e.type] || 0) + 1;
        return c;
    }, [entries]);

    const types = useMemo(
        () => Array.from(new Set(entries.map(e => e.type))),
        [entries],
    );

    return (
        <section className="min-h-screen pt-28 pb-32 px-6">
            <div className="max-w-3xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 block mb-4 font-semibold">
                        Private Registry
                    </span>
                    <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-2">
                        QR Code Index
                    </h1>
                    <p className="font-sans text-sm text-wood-500">
                        {state === 'ready' ? `${entries.length} registered codes` : 'Every issued QR code, in one place'}
                    </p>
                </div>

                {/* Rules */}
                <div className="mb-12 p-6 border border-wood-100 bg-paper-100/50">
                    <h2 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold mb-4">
                        Rules
                    </h2>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-sans text-sm text-wood-600">
                        <span className="text-wood-500">Domain</span>
                        <span>{QR_RULES.domain}</span>
                        <span className="text-wood-500">QR URL</span>
                        <span>{QR_RULES.domain}{QR_RULES.basePath}:code</span>
                        <span className="text-wood-500">Max code length</span>
                        <span>{QR_RULES.maxCodeLength} characters</span>
                        <span className="text-wood-500">Charset</span>
                        <span>{QR_RULES.charset}</span>
                        <span className="text-wood-500">QR version</span>
                        <span>v{QR_RULES.qrVersion} ({QR_RULES.gridSize})</span>
                        <span className="text-wood-500">Error correction</span>
                        <span>Level {QR_RULES.errorCorrection} (15%)</span>
                    </div>
                </div>

                {/* Routing */}
                <div className="mb-12 p-6 border border-wood-100 bg-paper-100/50">
                    <h2 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold mb-4">
                        Routing
                    </h2>
                    <div className="space-y-2 font-sans text-sm text-wood-600">
                        <div className="flex gap-3">
                            <code className="text-bronze-700 shrink-0">/qr/1..64</code>
                            <span className="text-wood-400">→</span>
                            <span>mandalacodes.com oracle card</span>
                        </div>
                        <div className="flex gap-3">
                            <code className="text-bronze-700 shrink-0">/qr/oracle</code>
                            <span className="text-wood-400">→</span>
                            <span>mandalacodes.com oracle home</span>
                        </div>
                        <div className="flex gap-3">
                            <code className="text-bronze-700 shrink-0">/qr/:code</code>
                            <span className="text-wood-400">→</span>
                            <span>/works/:code (artwork record)</span>
                        </div>
                    </div>
                </div>

                {state === 'signed-out' && (
                    <p className="text-center font-sans text-sm text-wood-400 py-6">
                        The registry listing requires the artist's sign-in.
                    </p>
                )}

                {state === 'error' && (
                    <p className="text-center font-sans text-sm text-wood-400 py-6">
                        The registry listing could not be checked. Reload to try again.
                    </p>
                )}

                {state === 'loading' && (
                    <p className="text-center font-sans text-sm text-wood-400 py-6" role="status">
                        Checking the registry…
                    </p>
                )}

                {state === 'ready' && (
                    <>
                        {/* Filter */}
                        <div className="flex gap-3 mb-6 flex-wrap">
                            <FilterButton
                                active={filter === 'all'}
                                onClick={() => setFilter('all')}
                                label={`All (${counts.all})`}
                            />
                            {types.map(t => (
                                <FilterButton
                                    key={t}
                                    active={filter === t}
                                    onClick={() => setFilter(t)}
                                    label={`${TYPE_LABELS[t]} (${counts[t] || 0})`}
                                />
                            ))}
                        </div>

                        {/* Table */}
                        <div className="border border-wood-100 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-wood-100 bg-paper-100/50">
                                        <Th>Code</Th>
                                        <Th>Type</Th>
                                        <Th>Label/Piece</Th>
                                        <Th>Destination/Status</Th>
                                        <Th>Created</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(entry => (
                                        <tr key={`${entry.source}:${entry.code}`} className="border-b border-wood-50 hover:bg-paper-100/30 transition-colors">
                                            <Td>
                                                <code className="text-bronze-700 text-xs">{entry.code}</code>
                                            </Td>
                                            <Td>
                                                <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500">
                                                    {TYPE_LABELS[entry.type]}
                                                </span>
                                            </Td>
                                            <Td>{labelOrPiece(entry)}</Td>
                                            <Td>
                                                <span className="text-wood-500 text-xs break-all">{destinationOrStatus(entry)}</span>
                                            </Td>
                                            <Td>{created(entry)}</Td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {filtered.length === 0 && (
                            <p className="text-center font-sans text-sm text-wood-400 py-12">
                                No QR codes match this filter.
                            </p>
                        )}
                    </>
                )}
            </div>
        </section>
    );
};

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`font-label text-[11px] uppercase tracking-[0.15em] px-4 py-2 transition-colors font-semibold ${
                active
                    ? 'bg-wood-900 text-paper-50'
                    : 'bg-paper-100 text-wood-600 hover:bg-paper-200'
            }`}
        >
            {label}
        </button>
    );
}

function Th({ children }: { children: React.ReactNode }) {
    return (
        <th className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 font-semibold px-4 py-3">
            {children}
        </th>
    );
}

function Td({ children }: { children: React.ReactNode }) {
    return (
        <td className="font-sans text-sm text-wood-700 px-4 py-3">
            {children}
        </td>
    );
}

export default QRIndex;
