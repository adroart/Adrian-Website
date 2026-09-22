
import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Artwork, BookContent, ProvenanceEvent } from '../types';
import { FULL_ARCHIVE } from '../data/mockData';
import { img as cldImg } from '../utils/media';
import { ulAltText, ulCardNumber } from '../utils/universalLanguage';
import { useMetaTags } from '../hooks/useMetaTags';
import { LAUNCH_FLAGS } from '../launchFlags';
import ArrivalGate from './legacy/ArrivalGate';
import PieceConstellation from './legacy/PieceConstellation';
import KeeperPanel from './legacy/KeeperPanel';
import CertificateScreen from './collector/legacy/CertificateScreen';
import PublicDream from './collector/legacy/PublicDream';
import {
    isPublicRegistryCode,
    validatePublicPlateIdentity,
} from '../utils/publicRegistry';
import type {
    PublicCreatorHistoryEntryType,
    PublicPlateIdentity,
} from '../utils/publicRegistry';
import {
    formatLineageEventLabel,
    publicLineageDetails,
    PublicLineageEvent,
    PublicLineageResponse,
    shouldLoadPublicLineage,
    validatePublicLineageResponse,
} from '../utils/publicLineage';

// Living Legacy new-generation arrival (components/collector/wired.tsx).
// Loaded lazily so the collector surface costs nothing while the launch flag
// is off and nothing on ordinary catalog visits.
const CollectorPieceArrival = lazy(() => import('./collector/wired'));

const EVENT_LABELS: Record<ProvenanceEvent['event'], string> = {
    created: 'Created',
    exhibited: 'Exhibited',
    sold: 'Acquired',
    commissioned: 'Commissioned',
    restored: 'Restored',
    transferred: 'Transferred',
};

const CREATOR_HISTORY_LABELS: Record<PublicCreatorHistoryEntryType, string> = {
    contributor: 'Contributor',
    creation_place: 'Creation place',
    intention: 'Intention',
    material: 'Material',
    technique: 'Technique',
    note: 'Studio note',
};

const WorksPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const artwork = useMemo(() => FULL_ARCHIVE.find(a => a.id === id), [id]);
    const book = useBookContent(id);

    // Registered pieces absent from the static catalog (an admin draft, or an
    // artwork typed inline during registration) resolve via a minimal record
    // endpoint so a plate's QR never dead-ends.
    const [draft, setDraft] = useState<
        { status: 'idle' | 'loading' | 'found' | 'none'; artwork?: DraftArtwork }
    >({ status: 'idle' });
    useEffect(() => {
        if (artwork || !id) { setDraft({ status: 'idle' }); return; }
        let active = true;
        setDraft({ status: 'loading' });
        fetch(`/api/works/${encodeURIComponent(id)}`)
            .then(response => (response.ok ? response.json() : null))
            .then(data => {
                if (!active) return;
                if (data?.ok && data.artwork) setDraft({ status: 'found', artwork: normalizeDraftArtwork(data.artwork) });
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
    const hasInstanceParam = searchParams.has('instance');
    const instanceValues = searchParams.getAll('instance');
    const instanceCode = instanceValues.length === 1 ? instanceValues[0] : null;
    const publicCode = isPublicRegistryCode(instanceCode) ? instanceCode : null;
    const invalidInstance = hasInstanceParam && !publicCode;
    const [identityState, retryIdentity] = usePublicRegistryIdentity(publicCode);
    const verifiedIdentity = identityState.status === 'ready' && identityState.publicCode === publicCode
        ? identityState.identity
        : null;
    const showPublicLineage = shouldLoadPublicLineage(legacyOn, instanceCode, id)
        && verifiedIdentity?.publicCode === instanceCode
        && verifiedIdentity?.artworkId === id;
    const showVerifiedPublicLineage = showPublicLineage && instanceCode && (verifiedIdentity !== null);
    const lineage = usePublicLineage(showPublicLineage, instanceCode, id);
    const canonicalMismatch = Boolean(
        verifiedIdentity && id && verifiedIdentity.artworkId !== id,
    );

    useEffect(() => {
        if (!verifiedIdentity || !id || verifiedIdentity.artworkId === id) return;
        const canonicalQuery = new URLSearchParams({
            instance: verifiedIdentity.publicCode,
            ref: 'qr',
        });
        const canonicalPath = `/works/${encodeURIComponent(verifiedIdentity.artworkId)}?${canonicalQuery.toString()}`;
        navigate(canonicalPath, { replace: true });
    }, [id, navigate, verifiedIdentity]);

    useMetaTags(
        verifiedIdentity
            ? { title: `${verifiedIdentity.title} · Adrian Rasmussen` }
            : artwork
            ? { title: `${artwork.title} — Adrian Rasmussen`, description: artwork.description }
            : draft.status === 'found' && draft.artwork
                ? { title: `${draft.artwork.title} — Adrian Rasmussen` }
                : { title: 'Work Not Found — Adrian Rasmussen' }
    );

    const publicIdentityRecord = publicCode ? (
        <PublicIdentityRecord
            identityState={identityState}
            publicCode={publicCode}
            onRetry={retryIdentity}
            headingLevel={artwork && legacyOn && arrivedByScan ? 2 : 1}
        />
    ) : null;

    if (invalidInstance) return <InvalidPublicIdentityState />;
    if (canonicalMismatch) return <PublicIdentityRedirectState />;
    if (publicCode && !verifiedIdentity) return publicIdentityRecord;

    // Living Legacy ON and the visit carries a verified ?instance code: the
    // new-generation collector piece page becomes the body, replacing what the
    // legacy ArrivalGate/KeeperPanel path below occupied. With the flag OFF
    // this branch is unreachable and the current behavior below is unchanged.
    if (legacyOn && publicCode && verifiedIdentity) {
        return (
            <Suspense fallback={null}>
                <CollectorPieceArrival
                    identity={verifiedIdentity}
                    artwork={artwork ?? null}
                    beginClaim={searchParams.get('claim') === '1'}
                />
            </Suspense>
        );
    }

    let record: React.ReactNode;
    if (!artwork) {
        if (draft.status === 'idle' || draft.status === 'loading') {
            record = (
                <section className={`${publicCode ? 'pt-16' : 'pt-32'} pb-32 px-6 flex items-center justify-center`}>
                    <p className="font-sans text-sm text-wood-500">Loading record…</p>
                </section>
            );
        } else if (draft.status === 'found' && draft.artwork) {
            record = (
                <DraftArtworkRecord
                    draft={verifiedIdentity ? {
                        ...draft.artwork,
                        title: verifiedIdentity.title,
                        series: verifiedIdentity.series,
                        edition: { kind: verifiedIdentity.edition.kind, size: verifiedIdentity.edition.size },
                    } : draft.artwork}
                    identity={verifiedIdentity}
                    showPublicLineage={Boolean(showVerifiedPublicLineage)}
                    lineage={lineage}
                    legacyOn={legacyOn}
                    followsIdentity={Boolean(publicCode)}
                />
            );
        } else {
            record = <WorkNotFound compact={Boolean(publicCode)} />;
        }
    } else {
        record = (
            <CatalogArtworkRecord
                artwork={verifiedIdentity ? {
                    ...artwork,
                    title: verifiedIdentity.title,
                    series: verifiedIdentity.series ?? artwork.series,
                    editionSize: verifiedIdentity.edition.size ?? undefined,
                    editionNumber: verifiedIdentity.edition.number ?? undefined,
                } : artwork}
                book={book}
                identity={verifiedIdentity}
                showPublicLineage={Boolean(showVerifiedPublicLineage)}
                lineage={lineage}
                legacyOn={legacyOn}
                followsIdentity={Boolean(publicCode) || (legacyOn && arrivedByScan)}
            />
        );
    }

    // The optional arrival remains gated. Exact identity loading does not depend
    // on this flag, so the public identity stays outside the legacy arrival.
    if (artwork && legacyOn && arrivedByScan) {
        return (
            <ArrivalGate artwork={artwork} identity={verifiedIdentity} headingLevel={1}>
                {publicIdentityRecord}
                {record}
            </ArrivalGate>
        );
    }
    return <>{publicIdentityRecord}{record}</>;
};

function InvalidPublicIdentityState() {
    return (
        <section
            data-testid="public-registry-invalid"
            className="min-h-screen pt-28 pb-32 px-6 flex items-center justify-center"
            role="status"
        >
            <div className="max-w-2xl w-full border border-wood-200 p-8 md:p-12 text-center">
                <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-5">
                    Plate identity is invalid
                </h1>
                <p className="font-sans text-sm leading-relaxed text-wood-600">
                    This link does not contain a valid public artwork code. Check the plate and scan it again.
                </p>
            </div>
        </section>
    );
}

function PublicIdentityRedirectState() {
    return (
        <section
            data-testid="public-registry-redirect"
            className="min-h-screen pt-28 pb-32 px-6 flex items-center justify-center"
            aria-live="polite"
        >
            <div className="max-w-2xl w-full border border-wood-200 p-8 md:p-12 text-center">
                <h1 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold">
                    Opening the verified artwork record
                </h1>
            </div>
        </section>
    );
}

type DraftArtwork = {
    id: string;
    title: string;
    series: string | null;
    year: string | null;
    dimensions: string | null;
    materials: string[];
    category: string | null;
    description: string | null;
    edition: { kind: 'unique' | 'numbered' | null; size: number | null };
};

/** Fills in defaults for an /api/works/:id response, tolerating the older,
 *  thinner {id, title, series, editionSize} shape as well as the current one. */
function normalizeDraftArtwork(raw: any): DraftArtwork {
    return {
        id: raw?.id,
        title: raw?.title,
        series: raw?.series ?? null,
        year: raw?.year ?? null,
        dimensions: raw?.dimensions ?? null,
        materials: Array.isArray(raw?.materials) ? raw.materials : [],
        category: raw?.category ?? null,
        description: raw?.description ?? null,
        edition: {
            kind: raw?.edition?.kind === 'unique' || raw?.edition?.kind === 'numbered' ? raw.edition.kind : null,
            size: typeof raw?.edition?.size === 'number'
                ? raw.edition.size
                : typeof raw?.editionSize === 'number' ? raw.editionSize : null,
        },
    };
}

function draftEditionLine(edition: DraftArtwork['edition']): string | null {
    if (edition.size) return `Edition of ${edition.size}`;
    if (edition.kind === 'unique') return 'Unique';
    return null;
}

function DraftArtworkRecord({
    draft,
    identity,
    showPublicLineage,
    lineage,
    legacyOn,
    followsIdentity,
}: {
    draft: DraftArtwork;
    identity: PublicPlateIdentity | null;
    showPublicLineage: boolean;
    lineage: LineageState;
    legacyOn: boolean;
    followsIdentity: boolean;
}) {
    const editionLine = draftEditionLine(draft.edition);
    return (
        <section
            data-testid="draft-artwork-record"
            className={`${followsIdentity ? 'pt-16' : 'min-h-screen pt-28'} pb-32 px-6`}
        >
            <div className="max-w-2xl mx-auto">
                <div className="border border-wood-200 p-8 md:p-12">
                    <div className="border border-wood-100 p-6 md:p-10">
                        <div className="text-center mb-10">
                            <p className="font-label text-[11px] uppercase tracking-[0.3em] text-wood-400 mb-8 font-semibold">
                                Adrian Rasmussen
                            </p>
                            {followsIdentity ? (
                                <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight">
                                    {draft.title}
                                </h2>
                            ) : (
                                <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight">
                                    {draft.title}
                                </h1>
                            )}
                            {draft.series && (
                                <p className="font-sans text-[13px] text-wood-400 tracking-wide">{draft.series} Series</p>
                            )}
                        </div>
                        <OrnamentalDivider />
                        {/* Registered work, quietly degraded: whatever the registry snapshot
                            knows, shown without an image slot, price, or shop elements. */}
                        {!identity && (
                            <div className="max-w-md mx-auto mb-10">
                                <div className="space-y-4">
                                    {draft.year && <DetailRow label="Year" value={draft.year} />}
                                    {draft.materials.length > 0 && (
                                        <DetailRow label="Materials" value={draft.materials.join(', ')} />
                                    )}
                                    {draft.dimensions && <DetailRow label="Dimensions" value={draft.dimensions} />}
                                    {editionLine && <DetailRow label="Edition" value={editionLine} />}
                                    {draft.category && <DetailRow label="Category" value={draft.category} />}
                                    <DetailRow label="Identifier" value={draft.id} />
                                </div>
                            </div>
                        )}
                        {!identity && draft.description && (
                            <p className="font-sans text-[15px] text-wood-600 leading-[1.9] text-center max-w-md mx-auto mb-10">
                                {draft.description}
                            </p>
                        )}
                        <p className="font-sans text-[13px] text-wood-400 text-center">Registered · in the artist's registry</p>
                        {identity && (
                            <div className="mt-10">
                                <CertificateScreen
                                    artworkId={identity.artworkId}
                                    publicCode={identity.publicCode}
                                    title={identity.title}
                                />
                            </div>
                        )}
                        {showPublicLineage && identity && (
                            <div className="mt-10">
                                <PublicLineageHistory publicCode={identity.publicCode} state={lineage} />
                            </div>
                        )}
                    </div>
                </div>
                {legacyOn && identity && (
                    <>
                        <div className="mt-16 print:hidden">
                            <PublicDream publicCode={identity.publicCode} />
                        </div>
                        <KeeperPanel publicIdentity={identity} />
                    </>
                )}
            </div>
        </section>
    );
}

function WorkNotFound({ compact }: { compact: boolean }) {
    return (
        <section className={`${compact ? 'pt-16' : 'min-h-screen pt-32'} pb-32 px-6 flex items-center justify-center`}>
            <div className="max-w-xl text-center">
                <span className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 block mb-6 font-semibold">
                    Works Registry
                </span>
                {compact ? (
                    <h2 className="font-serif text-4xl md:text-5xl text-wood-900 mb-6 font-medium">Work Not Found</h2>
                ) : (
                    <h1 className="font-serif text-4xl md:text-5xl text-wood-900 mb-6 font-medium">Work Not Found</h1>
                )}
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

function CatalogArtworkRecord({
    artwork,
    book,
    identity,
    showPublicLineage,
    lineage,
    legacyOn,
    followsIdentity,
}: {
    artwork: Artwork;
    book: BookContent | null;
    identity: PublicPlateIdentity | null;
    showPublicLineage: boolean;
    lineage: LineageState;
    legacyOn: boolean;
    followsIdentity: boolean;
}) {
    const editionDisplay = getEditionLine(artwork);
    const imageUrl = artwork.coverImage ? cldImg(artwork.coverImage, { w: 800 }) : null;
    const imageAlt = artwork.series === 'Universal Language'
        ? ulAltText(artwork, ulCardNumber(artwork.coverImage))
        : artwork.title;
    const provenance = artwork.provenance || [];

    return (
        <section
            data-testid="catalog-artwork-record"
            className={`min-h-screen ${followsIdentity ? 'pt-16' : 'pt-28'} pb-32 px-6 print:pt-8 print:pb-8`}
        >
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

                            {followsIdentity ? (
                                <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight">
                                    {artwork.title}
                                </h2>
                            ) : (
                                <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight">
                                    {artwork.title}
                                </h1>
                            )}

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
                        {!identity && (
                            <p className="text-center font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-10 font-semibold">
                                Artwork catalogue
                            </p>
                        )}

                        {/* Image */}
                        {imageUrl && (
                            <div className="mb-10 flex justify-center">
                                <img
                                    src={imageUrl}
                                    alt={imageAlt}
                                    className="max-w-sm w-full shadow-sm"
                                    loading="eager"
                                />
                            </div>
                        )}

                        {/* Details grid */}
                        {!identity && (
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
                        )}

                        {identity && (
                            <CertificateScreen
                                artworkId={identity.artworkId}
                                publicCode={identity.publicCode}
                                title={identity.title}
                            />
                        )}

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
                        {!identity && provenance.length > 0 && (
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

                        {showPublicLineage && identity?.publicCode && (
                            <PublicLineageHistory publicCode={identity.publicCode} state={lineage} />
                        )}

                        {/* Signature line */}
                        {!identity && (
                            <>
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
                            </>
                        )}

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

                        {!identity && book.materialsStory && (
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
                {legacyOn && identity && (
                    <>
                        <div className="mt-20 print:hidden">
                            <PublicDream publicCode={identity.publicCode} />
                        </div>
                        <div className="mt-20 print:hidden">
                            <PieceConstellation artwork={artwork} publicCode={identity.publicCode} />
                        </div>
                        <KeeperPanel publicIdentity={identity} />
                    </>
                )}
            </div>
        </section>
    );
}

type PublicIdentityState =
    | { status: 'idle' }
    | { status: 'loading'; publicCode: string }
    | { status: 'ready'; publicCode: string; identity: PublicPlateIdentity }
    | { status: 'not-found' | 'unavailable'; publicCode: string };

function usePublicRegistryIdentity(
    publicCode: string | null,
): [PublicIdentityState, () => void] {
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<PublicIdentityState>(
        publicCode ? { status: 'loading', publicCode } : { status: 'idle' },
    );

    useEffect(() => {
        if (!publicCode) {
            setState({ status: 'idle' });
            return;
        }

        const controller = new AbortController();
        setState({ status: 'loading', publicCode });
        fetch(`/api/registry/${encodeURIComponent(publicCode)}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(async response => {
                if (response.status === 404) {
                    setState({ status: 'not-found', publicCode });
                    return null;
                }
                if (response.status === 503) {
                    setState({ status: 'unavailable', publicCode });
                    return null;
                }
                if (!response.ok) throw new Error('registry unavailable');

                const data = await response.json();
                if (
                    data?.ok !== true
                    || !validatePublicPlateIdentity(data?.identity)
                    || data.identity.publicCode !== publicCode
                ) {
                    throw new Error('registry identity mismatch');
                }
                return data.identity as PublicPlateIdentity;
            })
            .then(identity => {
                if (identity && !controller.signal.aborted) {
                    setState({ status: 'ready', publicCode, identity });
                }
            })
            .catch(error => {
                if (error?.name !== 'AbortError') setState({ status: 'unavailable', publicCode });
            });

        return () => controller.abort();
    }, [attempt, publicCode]);

    return [state, () => setAttempt(value => value + 1)];
}

type RecordProbeState =
    | { status: 'idle' }
    | { status: 'checking'; publicCode: string }
    | { status: 'present'; publicCode: string }
    | { status: 'absent'; publicCode: string };

/** Probes whether a permanent Piece Record exists for this public code,
 *  via a cheap HEAD request, so the link below can be offered only when
 *  the record is actually there. An absent record is never a collector's
 *  problem, so this never surfaces as an error state, only as no link. */
function usePublicRecordProbe(publicCode: string | null): RecordProbeState {
    const [state, setState] = useState<RecordProbeState>(
        publicCode ? { status: 'checking', publicCode } : { status: 'idle' },
    );

    useEffect(() => {
        if (!publicCode) {
            setState({ status: 'idle' });
            return;
        }

        const controller = new AbortController();
        setState({ status: 'checking', publicCode });
        fetch(`/api/records/${encodeURIComponent(publicCode)}`, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(response => {
                if (controller.signal.aborted) return;
                setState({ status: response.ok ? 'present' : 'absent', publicCode });
            })
            .catch(error => {
                if (error?.name !== 'AbortError') setState({ status: 'absent', publicCode });
            });

        return () => controller.abort();
    }, [publicCode]);

    return state;
}

function PublicIdentityRecord({
    identityState,
    publicCode,
    onRetry,
    headingLevel,
}: {
    identityState: PublicIdentityState;
    publicCode: string;
    onRetry: () => void;
    headingLevel: 1 | 2;
}) {
    const recordProbe = usePublicRecordProbe(
        identityState.status === 'ready' && identityState.publicCode === publicCode ? publicCode : null,
    );

    if (
        identityState.status === 'idle'
        || identityState.publicCode !== publicCode
        || identityState.status === 'loading'
    ) {
        return (
            <section className="pt-28 px-6" aria-live="polite">
                <div className="max-w-2xl mx-auto border border-wood-200 p-8 md:p-12 text-center">
                    <h1 className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-400 font-semibold">
                        Verifying artwork identity
                    </h1>
                </div>
            </section>
        );
    }

    if (identityState.status === 'not-found') {
        return (
            <section data-testid="public-registry-not-found" className="pt-28 px-6" role="status">
                <div className="max-w-2xl mx-auto border border-wood-200 p-8 md:p-12 text-center">
                    <h1 className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 mb-4 font-semibold">
                        Registry identity not found
                    </h1>
                    <p className="font-sans text-sm leading-relaxed text-wood-600">
                        No public registry identity exists for this code.
                    </p>
                </div>
            </section>
        );
    }

    if (identityState.status === 'unavailable') {
        return (
            <section data-testid="public-registry-unavailable" className="pt-28 px-6" role="status">
                <div className="max-w-2xl mx-auto border border-wood-200 p-8 md:p-12 text-center">
                    <h1 className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 mb-4 font-semibold">
                        Registry temporarily unavailable
                    </h1>
                    <p className="font-sans text-sm leading-relaxed text-wood-600 mb-7">
                        This identity could not be verified right now. No unverified details are shown.
                    </p>
                    <button
                        type="button"
                        onClick={onRetry}
                        className="px-7 py-3 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-bronze-600 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </section>
        );
    }

    if (identityState.status !== 'ready') return null;
    const { identity } = identityState;
    return (
        <section data-testid="public-registry-identity" className="pt-28 px-6 print:pt-8">
            <div className="max-w-2xl mx-auto border border-bronze-300 p-6 sm:p-8 md:p-12 print:p-6">
                <div className="border border-wood-100 p-5 sm:p-6 md:p-10 print:p-4 min-w-0">
                    <div className="text-center mb-9">
                        <p className="font-label text-[10px] uppercase tracking-[0.25em] text-bronze-600 mb-7 font-semibold">
                            Verified artwork identity
                        </p>
                        <p className="font-label text-[11px] uppercase tracking-[0.3em] text-wood-400 mb-7 font-semibold">
                            {identity.artistName}
                        </p>
                        {headingLevel === 1 ? (
                            <h1 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight break-words">
                                {identity.title}
                            </h1>
                        ) : (
                            <h2 className="font-serif text-3xl md:text-4xl text-wood-900 font-medium mb-3 leading-tight break-words">
                                {identity.title}
                            </h2>
                        )}
                        {identity.series && (
                            <p className="font-sans text-[13px] text-wood-400 tracking-wide break-words">
                                {identity.series} Series
                            </p>
                        )}
                    </div>

                    <OrnamentalDivider />

                    <div className="max-w-md mx-auto mb-10 space-y-4 min-w-0">
                        <DetailRow label="Artist" value={identity.artistName} />
                        <DetailRow label="Artwork ID" value={identity.artworkId} />
                        <DetailRow label="Edition" value={identity.edition.label} />
                        <DetailRow label="Public code" value={identity.publicCode} />
                        <DetailRow label="Plate status" value={formatPlateStatus(identity.plateStatus)} />
                    </div>

                    <div className="max-w-md mx-auto min-w-0">
                        <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-5 text-center">
                            Public provenance
                        </p>
                        {identity.publicProvenance.length === 0 ? (
                            <p className="font-sans text-[13px] text-wood-500 text-center">
                                No public provenance recorded.
                            </p>
                        ) : (
                            <ol className="space-y-3">
                                {identity.publicProvenance.map((event, index) => (
                                    <li key={`${event.year}-${event.event}-${index}`} className="flex items-start gap-3 min-w-0">
                                        <span className="font-sans text-[13px] text-wood-400 shrink-0 max-w-[40%] break-all tabular-nums">
                                            {event.year}
                                        </span>
                                        <span className="w-px h-3 bg-bronze-200 shrink-0 mt-1" aria-hidden="true" />
                                        <span className="font-sans text-[13px] text-wood-600 break-words min-w-0">
                                            <span className="text-wood-700 font-medium">{EVENT_LABELS[event.event]}</span>
                                            {event.note && <span className="text-wood-500">{' · '}{event.note}</span>}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    {identity.creatorHistory.length > 0 && (
                        <div className="max-w-md mx-auto mt-10 pt-10 border-t border-wood-100 min-w-0">
                            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-5 text-center">
                                Creator history
                            </p>
                            <ol className="space-y-5">
                                {identity.creatorHistory.map((entry, index) => (
                                    <li key={`${entry.entryType}-${entry.title}-${index}`} className="border-l border-bronze-200 pl-4 min-w-0">
                                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                                            <p className="font-label text-[10px] uppercase tracking-[0.14em] text-bronze-600 font-semibold">
                                                {CREATOR_HISTORY_LABELS[entry.entryType]}
                                            </p>
                                            {entry.occurredAt && (
                                                <time className="font-sans text-[11px] text-wood-400 tabular-nums" dateTime={entry.occurredAt}>
                                                    {entry.occurredAt}
                                                </time>
                                            )}
                                        </div>
                                        <p className="mt-1 font-serif text-lg leading-snug text-wood-800 break-words">
                                            {entry.title}
                                        </p>
                                        {entry.role && (
                                            <p className="mt-1 font-sans text-[12px] text-wood-500 break-words">
                                                {entry.role}
                                            </p>
                                        )}
                                        {entry.detail && (
                                            <p className="mt-2 font-sans text-[13px] leading-relaxed text-wood-600 whitespace-pre-wrap break-words">
                                                {entry.detail}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {recordProbe.status === 'present' && recordProbe.publicCode === publicCode && (
                        <div className="max-w-md mx-auto mt-10 pt-10 border-t border-wood-100 text-center min-w-0 print:hidden">
                            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-400 font-semibold mb-5">
                                Permanent record
                            </p>
                            <p className="font-sans text-[13px] leading-relaxed text-wood-600 mb-5">
                                A single file holding this artwork's identity and the instructions
                                to verify it. It opens with no internet connection, and it can be
                                saved anywhere.
                            </p>
                            <a
                                href={`/api/records/${encodeURIComponent(publicCode)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-block font-label text-[11px] uppercase tracking-[0.15em] text-bronze-600 hover:text-bronze-800 transition-colors font-semibold border-b border-bronze-300 pb-1"
                            >
                                Open the permanent record
                            </a>
                        </div>
                    )}
                </div>
            </div>
            <span className="sr-only">Verified public code {publicCode}</span>
        </section>
    );
}

function OrnamentalDivider() {
    return (
        <div className="flex items-center justify-center gap-4 mb-10" aria-hidden="true">
            <div className="h-px w-12 bg-bronze-300" />
            <div className="w-1.5 h-1.5 rotate-45 border border-bronze-300" />
            <div className="h-px w-12 bg-bronze-300" />
        </div>
    );
}

function formatPlateStatus(status: PublicPlateIdentity['plateStatus']): string {
    if (status === 'registered') return 'Registered artwork record';
    if (status === 'active') return 'Active';
    if (status === 'superseded') return 'Superseded';
    return 'Generated';
}

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
            <span className="font-sans text-[14px] text-wood-700 text-right max-w-[60%] min-w-0 ml-4 break-words">
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
