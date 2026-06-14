
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Artwork, BookContent, ProvenanceEvent } from '../types';
import { FULL_ARCHIVE } from '../data/mockData';
import { img as cldImg } from '../utils/cloudinary';
import { useMetaTags } from '../hooks/useMetaTags';

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
    const artwork = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);
    const book = useBookContent(id);

    useMetaTags(
        artwork
            ? { title: `${artwork.title} — Adrian Rasmussen`, description: artwork.description }
            : { title: 'Work Not Found — Adrian Rasmussen' }
    );

    if (!artwork) {
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

    return (
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
            </div>
        </section>
    );
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
