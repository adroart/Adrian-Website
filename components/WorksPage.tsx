
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Artwork, BookContent, ProvenanceEvent } from '../types';
import { FULL_ARCHIVE } from '../data/mockData';
import { img as cldImg } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';
import { LAUNCH_FLAGS } from '../launchFlags';
import ArrivalGate from './legacy/ArrivalGate';
import PieceConstellation from './legacy/PieceConstellation';
import KeeperPanel from './legacy/KeeperPanel';
import {
    formatLineageEventLabel,
    publicLineageDetails,
    PublicLineageEvent,
    PublicLineageResponse,
    shouldLoadPublicLineage,
    validatePublicLineageResponse,
} from '../utils/publicLineage';

const EVENT_LABELS: Record<ProvenanceEvent['event'], string> = {
    created: 'Created',
    exhibited: 'Exhibited',
    sold: 'Acquired',
    commissioned: 'Commissioned',
    restored: 'Restored',
    transferred: 'Transferred',
};

const WorksPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const artwork = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);
    const book = useBookContent(id);

    // Draft pieces (registered from the admin, not yet in the static catalog)
    // resolve via a minimal record endpoint so a plate's QR never dead-ends.
    const [draft, setDraft] = useState<
        { status: 'idle' | 'loading' | 'found' | 'none'; artwork?: { id: string; title: string; series: string | null; editionSize: number | null } }
    >({ status: 'idle' });
    useEffect(() => {
        if (artwork || !id) { setDraft({ status: 'idle' }); return; }
        let active = true;
        setDraft({ status: 'loading' });
        fetch(`/api/works/${encodeURIComponent(id)}`)
            .then(response => (response.ok ? response.json() : null))
            .then(data => {
                if (!active) return;
                if (data?.ok && data.artwork) setDraft({ status: 'found', artwork: data.artwork });
                else setDraft({ status: 'none' });
            })
            .catch(() => { if (active) setDraft({ status: 'none' }); });
        return () => { active = false; };
    }, [artwork, id]);

    // Living Legacy: gated behind the flag. The temple-paced arrival only runs
    // when the visitor reached the page from a physical scan (?ref=qr); a direct
    // visit goes straight to the certificate so nothing feels withheld.
    const legacyOn = LAUNCH_FLAGS.livingLegacy;
    const arrivedByScan = searchParams.get('ref') === 'qr';
    const instanceCode = searchParams.get('instance');
    const showPublicLineage = shouldLoadPublicLineage(legacyOn, instanceCode, id);
    const lineage = usePublicLineage(showPublicLineage, instanceCode, id);

    useMetaTags(
        artwork
            ? { title: `${artwork.title} — Adrian Rasmussen`, description: artwork.description }
            : draft.status === 'found' && draft.artwork
                ? { title: `${draft.artwork.title} — Adrian Rasmussen` }
                : { title: 'Work Not Found — Adrian Rasmussen' }
    );

    if (!artwork) {
        if (draft.status === 'idle' || draft.status === 'loading') {
            return (
                <section className="min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
                    <p className="font-sans text-sm text-wood-500">Loading record…</p>
                </section>
            );
        }
        if (draft.status === 'found' && draft.artwork) {
            const editionParam = searchParams.get('edition');
            const draftEdition = draft.artwork.editionSize
                ? (editionParam && /^\d+$/.test(editionParam) && Number(editionParam) > 0
                    ? `${editionParam} of ${draft.artwork.editionSize}, signed and numbered`
                    : `Edition of ${draft.artwork.editionSize}`)
                : null;
            return (
                <section className="min-h-screen pt-28 pb-32 px-6">
                    <div className="max-w-2xl mx-auto">
                        <div className="border border-wood-200 p-8 md:p-12">
                            <div className="border border-wood-100 p-6 md:p-10">
                                <div className="text-center mb-10">
                                    <p className="font-label text-[11px] uppercase tracking-[0.3em] text-wood-400 mb-8 font-semibold">
                                        Adrian Rasmussen
                                    </p>
                                    <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight">
                                        {draft.artwork.title}
                                    </h1>
                                    {draft.artwork.series && (
                                        <p className="font-sans text-[13px] text-wood-400 tracking-wide">
                                            {draft.artwork.series} Series
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center justify-center gap-4 mb-10">
                                    <div className="h-px w-12 bg-bronze-300" />
                                    <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
                                    <div className="h-px w-12 bg-bronze-300" />
                                </div>
                                {draftEdition && (
                                    <p className="font-sans text-sm text-wood-600 text-center mb-4">{draftEdition}</p>
                                )}
                                <p className="font-sans text-[13px] text-wood-400 text-center">
                                    Registered artwork record
                                </p>
                            </div>
                        </div>
                        {showPublicLineage && instanceCode && (
                            <div className="mt-10">
                                <PublicLineageHistory publicCode={instanceCode} state={lineage} />
                            </div>
                        )}
                    </div>
                </section>
            );
        }
        return (
            <section className="min-h-screen pt-32 pb-32 px-6 flex items-center justify-center">
                <div className="max-w-xl text-center">
                    <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 block mb-6 font-semibold">
                        Works Registry
                    </span>
                    <h1 className="font-serif text-4xl md:text-5xl text-wood-900 mb-6 font-medium">
                        Work Not Found
                    </h1>
                    <p className="font-sans text-base text-wood-600 mb-12 leading-[1.7]">
                        No record exists for this identifier. If you scanned a QR code and reached
                        this page, the piece may not yet be registered.
                    </p>
                    <Link
                        to="/creations"
                        className="inline-flex items-center gap-3 px-8 py-4 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
                    >
                        Browse Creations
                    </Link>
                </div>
            </section>
        );
    }

    const editionDisplay = getEditionLine(artwork);
    const imageUrl = artwork.coverImage
        ? cldImg(artwork.coverImage, { w: 800 })
        : null;
    const provenance = artwork.provenance || [];

    const record = (
        <section className="min-h-screen pt-28 pb-32 px-6 print:pt-8 print:pb-8">
            <div className="max-w-2xl mx-auto">

                {/* ── Certificate frame ── */}
                <div className="border border-wood-200 p-8 md:p-12 print:p-6">

                    {/* Inner border — double-frame effect */}
                    <div className="border border-wood-100 p-6 md:p-10 print:p-4">

                        {/* Artist name */}
                        <div className="text-center mb-10">
                            <p className="font-label text-[11px] uppercase tracking-[0.3em] text-wood-400 mb-8 font-semibold">
                                Adrian Rasmussen
                            </p>

                            <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight">
                                {artwork.title}
                            </h1>

                            {artwork.series && (
                                <p className="font-sans text-[13px] text-wood-400 tracking-wide">
                                    {artwork.series} Series
                                </p>
                            )}
                        </div>

                        {/* Ornamental divider */}
                        <div className="flex items-center justify-center gap-4 mb-10">
                            <div className="h-px w-12 bg-bronze-300" />
                            <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
                            <div className="h-px w-12 bg-bronze-300" />
                        </div>

                        {/* Certificate label */}
                        <p className="text-center font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-10 font-semibold">
                            Certificate of Authenticity
                        </p>

                        {/* Image */}
                        {imageUrl && (
                            <div className="mb-10 flex justify-center">
                                <img
                                    src={imageUrl}
                                    alt={artwork.title}
                                    className="max-w-sm w-full shadow-sm"
                                    loading="eager"
                                />
                            </div>
                        )}

                        {/* Details grid */}
                        <div className="max-w-md mx-auto mb-10">
                            <div className="space-y-4">
                                <DetailRow label="Artist" value="Adrian Rasmussen" />
                                <DetailRow label="Year" value={artwork.year} />
                                {artwork.material && <DetailRow label="Materials" value={artwork.material} />}
                                {artwork.dimensions && <DetailRow label="Dimensions" value={artwork.dimensions} />}
                                {editionDisplay && <DetailRow label="Edition" value={editionDisplay} />}
                                {artwork.finish && <DetailRow label="Finish" value={artwork.finish} />}
                                {artwork.createdLocation && <DetailRow label="Origin" value={artwork.createdLocation} />}
                                <DetailRow label="Identifier" value={artwork.id} />
                            </div>
                        </div>

                        {/* Description */}
                        {artwork.description && (
                            <>
                                <div className="flex items-center justify-center gap-4 mb-8">
                                    <div className="h-px w-8 bg-wood-100" />
                                    <div className="w-1 h-1 rotate-45 border border-wood-200" />
                                    <div className="h-px w-8 bg-wood-100" />
                                </div>
                                <p className="font-sans text-[15px] text-wood-600 leading-[1.9] text-center max-w-md mx-auto mb-10">
                                    {artwork.longDescription || artwork.description}
                                </p>
                            </>
                        )}

                        {/* Provenance timeline */}
                        {provenance.length > 0 && (
                            <div className="max-w-md mx-auto mb-10">
                                <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-5 text-center">
                                    Provenance
                                </p>
                                <div className="space-y-3">
                                    {provenance.map((evt, i) => (
                                        <div key={i} className="flex items-baseline gap-4">
                                            <span className="font-sans text-[13px] text-wood-400 shrink-0 w-10 text-right tabular-nums">
                                                {evt.year}
                                            </span>
                                            <div className="w-px h-3 bg-bronze-200 shrink-0 self-center" />
                                            <div className="font-sans text-[13px] text-wood-600">
                                                <span className="text-wood-700 font-medium">
                                                    {EVENT_LABELS[evt.event]}
                                                </span>
                                                {evt.note && (
                                                    <span className="text-wood-500">
                                                        {' · '}{evt.note}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {showPublicLineage && instanceCode && (
                            <PublicLineageHistory publicCode={instanceCode} state={lineage} />
                        )}

                        {/* Signature line */}
                        <div className="flex items-center justify-center gap-4 mb-8 mt-10">
                            <div className="h-px w-12 bg-bronze-300" />
                            <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
                            <div className="h-px w-12 bg-bronze-300" />
                        </div>

                        <div className="text-center">
                            <p className="font-serif text-lg text-wood-700 italic mb-1">
                                Adrian Rasmussen
                            </p>
                            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold">
                                Artist
                            </p>
                        </div>

                    </div>{/* inner border */}
                </div>{/* outer border */}

                {/* ── The book: Adrian's authored page for this piece ── */}
                {book && hasBookContent(book) && (
                    <article className="mt-20 print:mt-12">
                        {book.epigraph && (
                            <p className="font-serif italic text-xl md:text-2xl text-wood-500 leading-[1.6] text-center max-w-xl mx-auto mb-14">
                                {book.epigraph}
                            </p>
                        )}

                        {book.body && book.body.length > 0 && (
                            <div className="max-w-xl mx-auto space-y-6 mb-16">
                                {book.body.map((para, i) => (
                                    <p
                                        key={i}
                                        className={`font-serif text-[17px] md:text-lg text-wood-700 leading-[1.9] ${i === 0 ? 'drop-cap' : ''}`}
                                    >
                                        {para}
                                    </p>
                                ))}
                            </div>
                        )}

                        {book.makersNote && book.makersNote.length > 0 && (
                            <BookSection label="From the Studio">
                                <div className="space-y-4">
                                    {book.makersNote.map((para, i) => (
                                        <p key={i} className="font-sans text-[15px] text-wood-600 leading-[1.8]">
                                            {para}
                                        </p>
                                    ))}
                                </div>
                            </BookSection>
                        )}

                        {book.materialsStory && (
                            <BookSection label="Materials">
                                <p className="font-serif text-[17px] italic text-wood-600 leading-[1.8]">
                                    {book.materialsStory}
                                </p>
                            </BookSection>
                        )}

                        {book.inspiration && (
                            <BookSection label="What It Reaches Toward">
                                <p className="font-serif text-[17px] italic text-wood-600 leading-[1.8]">
                                    {book.inspiration}
                                </p>
                            </BookSection>
                        )}
                    </article>
                )}

                {/* Below the certificate */}
                <div className="text-center mt-8 space-y-4 print:hidden">
                    <Link
                        to={`/creations/${artwork.id}`}
                        className="inline-block font-label text-[11px] uppercase tracking-[0.15em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold border-b border-bronze-300 pb-1"
                    >
                        View this piece
                    </Link>
                    <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-300 font-semibold">
                        adrianrasmussen.com/works/{artwork.id}
                    </p>
                </div>

                {/* Living Legacy (gated): constellation lens and steward doors. */}
                {legacyOn && (
                    <>
                        <div className="mt-20 print:hidden">
                            <PieceConstellation artwork={artwork} />
                        </div>
                        <KeeperPanel artwork={artwork} />
                    </>
                )}
            </div>
        </section>
    );

    // When scanned (and the flag is on), the piece wakes up first, then opens
    // into the full record. Otherwise the record renders exactly as before.
    if (legacyOn && arrivedByScan) {
        return <ArrivalGate artwork={artwork}>{record}</ArrivalGate>;
    }
    return record;
};

/** Fetch the authored book page for a piece. Returns null until loaded or
 *  if no entry exists — the works page renders fully without it. */
function useBookContent(id: string | undefined): BookContent | null {
    const [book, setBook] = useState<BookContent | null>(null);
    useEffect(() => {
        setBook(null);
        if (!id) return;
        let active = true;
        fetch(`/api/book?id=${encodeURIComponent(id)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (active && data?.ok && data.entry) setBook(data.entry);
            })
            .catch(() => { /* no page yet, or offline — render without it */ });
        return () => { active = false; };
    }, [id]);
    return book;
}

function hasBookContent(b: BookContent): boolean {
    return Boolean(
        b.epigraph ||
        (b.body && b.body.length) ||
        (b.makersNote && b.makersNote.length) ||
        b.materialsStory ||
        b.inspiration
    );
}

type LineageState =
    | { status: 'idle' | 'loading' }
    | { status: 'ready'; events: PublicLineageEvent[] }
    | { status: 'error' };

function usePublicLineage(
    enabled: boolean,
    publicCode: string | null,
    pieceId: string | undefined,
): LineageState {
    const [state, setState] = useState<LineageState>({ status: enabled ? 'loading' : 'idle' });

    useEffect(() => {
        if (!enabled || !publicCode || !pieceId) {
            setState({ status: 'idle' });
            return;
        }

        const controller = new AbortController();
        setState({ status: 'loading' });
        fetch(`/api/lineage/${encodeURIComponent(publicCode)}`, { signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error('lineage unavailable');
                return response.json() as Promise<PublicLineageResponse>;
            })
            .then((data) => {
                const validated = validatePublicLineageResponse(data, publicCode, pieceId);
                if (!validated) throw new Error('lineage mismatch');
                setState({ status: 'ready', events: validated.events });
            })
            .catch((error) => {
                if (error?.name !== 'AbortError') setState({ status: 'error' });
            });

        return () => controller.abort();
    }, [enabled, pieceId, publicCode]);

    return state;
}

function PublicLineageHistory({ publicCode, state }: { publicCode: string; state: LineageState }) {
    return (
        <section className="max-w-md mx-auto mb-10" aria-labelledby="registry-history-heading">
            <div className="flex items-center justify-center gap-4 mb-6">
                <div className="h-px w-8 bg-wood-100" />
                <h2
                    id="registry-history-heading"
                    className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold"
                >
                    Registry history
                </h2>
                <div className="h-px w-8 bg-wood-100" />
            </div>
            <p className="font-sans text-[12px] text-wood-400 text-center mb-6">
                Permanent record for <span className="font-medium text-wood-600">{publicCode}</span>
            </p>

            {state.status === 'loading' && (
                <div className="space-y-4" aria-live="polite" aria-label="Loading registry history">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="border-l border-wood-100 pl-5 py-1 animate-pulse">
                            <div className="h-3 bg-wood-100 w-28 mb-2" />
                            <div className="h-2 bg-wood-100 w-44" />
                        </div>
                    ))}
                </div>
            )}

            {state.status === 'error' && (
                <p className="border-l border-bronze-300 pl-4 py-1 font-sans text-[13px] leading-relaxed text-wood-600" role="status">
                    This history could not be verified right now. The artwork record remains unchanged.
                </p>
            )}

            {state.status === 'ready' && state.events.length === 0 && (
                <p className="font-sans text-[13px] leading-relaxed text-wood-500 text-center">
                    No public registry events have been recorded yet.
                </p>
            )}

            {state.status === 'ready' && state.events.length > 0 && (
                <ol className="space-y-5">
                    {state.events.map((event) => {
                        const details = publicLineageDetails(event.publicPayload);
                        return (
                            <li key={event.eventHash} className="relative border-l border-bronze-200 pl-5 py-0.5">
                                <span className="absolute -left-[3px] top-2 block h-[5px] w-[5px] rotate-45 bg-bronze-500" aria-hidden="true" />
                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                                    <p className="font-sans text-[13px] text-wood-700 font-medium">
                                        {formatLineageEventLabel(event.eventType)}
                                    </p>
                                    <time className="font-sans text-[11px] text-wood-400 tabular-nums" dateTime={event.eventAt}>
                                        {formatLineageDate(event.eventAt)}
                                    </time>
                                </div>
                                {details.length > 0 && (
                                    <p className="mt-1 font-sans text-[11px] text-wood-500 leading-relaxed">
                                        {details.map(([label, value]) => `${label}: ${value}`).join(' · ')}
                                    </p>
                                )}
                                <p
                                    className="mt-2 font-mono text-[9px] leading-relaxed tracking-[0.03em] text-wood-300 break-all"
                                    title="Tamper-evident event hash"
                                >
                                    {event.eventHash}
                                </p>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

function formatLineageDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

/** A titled block in the book, with an ornamental rule above the label. */
function BookSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <section className="max-w-xl mx-auto mb-14">
            <div className="flex items-center gap-4 mb-6">
                <div className="h-px w-8 bg-bronze-300" />
                <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 font-semibold">
                    {label}
                </p>
                <div className="h-px flex-1 bg-wood-100" />
            </div>
            {children}
        </section>
    );
}

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-baseline">
            <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 font-semibold">
                {label}
            </span>
            <span className="font-sans text-[14px] text-wood-700 text-right max-w-[60%]">
                {value}
            </span>
        </div>
    );
}

function getEditionLine(art: Artwork): string | null {
    if (art.editionSize) {
        if (art.editionNumber) {
            return `${art.editionNumber} of ${art.editionSize}, signed and numbered`;
        }
        return `Edition of ${art.editionSize}`;
    }
    return art.edition || null;
}

export default WorksPage;
