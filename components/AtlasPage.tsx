import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Globe, { type GlobeNode } from './atlas/Globe';
import AtlasFilters, { type AtlasStatusFilter } from './atlas/AtlasFilters';
import PieceSidePanel, { type KinEntry, type SelectedPiece } from './atlas/PieceSidePanel';
import SeekingGround, { type SeekingPiece } from './atlas/SeekingGround';
import KinshipLayer from './atlas/KinshipLayer';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID } from '../data/cities';
import { buildKinshipIndex, MAX_KINSHIP_ARCS } from '../utils/kinship';
import type { PublicAtlasState } from '../types';

const MAX_KIN_PER_PIECE = 6;

/* ─── State machine ────────────────────────────────────────────────────────── */
type FetchState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: PublicAtlasState };

type EnrichedPiece = PublicAtlasState['pieces'][number] & {
  key: string;
  title: string;
};

/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function makeKey(pieceId: string, editionNumber?: number): string {
  return `${pieceId}:${editionNumber ?? ''}`;
}

function titleFor(pieceId: string): string {
  const a = FULL_ARCHIVE.find((art) => art.id === pieceId);
  return a?.title ?? pieceId;
}

function categoryFor(pieceId: string): string | undefined {
  return FULL_ARCHIVE.find((art) => art.id === pieceId)?.category;
}

function cityLabelFor(cityId: string | null | undefined): string | undefined {
  if (!cityId) return undefined;
  const c = CITIES_BY_ID.get(cityId);
  if (!c) return undefined;
  return `${c.city}, ${c.country}`;
}

/* ─── Component ────────────────────────────────────────────────────────────── */
const AtlasPage: React.FC = () => {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [status, setStatus] = useState<AtlasStatusFilter>('all');
  const [kinshipVisible, setKinshipVisible] = useState<boolean>(true);

  /* Globe container size — KinshipLayer needs CSS pixels to render the SVG
     overlay at the same dimensions cobe is drawing into. */
  const globeBoxRef = useRef<HTMLDivElement | null>(null);
  const [globeSize, setGlobeSize] = useState({ width: 0, height: 0 });

  /* Fetch on mount. No retry, no spinner — quiet copy only. */
  useEffect(() => {
    let active = true;
    fetch('/api/atlas')
      .then(async (res) => {
        if (!res.ok) throw new Error(`atlas ${res.status}`);
        const body = await res.json();
        if (!body || body.ok !== true || !body.state) {
          throw new Error('atlas malformed');
        }
        return body.state as PublicAtlasState;
      })
      .then((data) => {
        if (active) setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  /* Enrich pieces with titles, build the series list for the filter. */
  const enriched: EnrichedPiece[] = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return state.data.pieces.map((p) => ({
      ...p,
      key: makeKey(p.pieceId, p.editionNumber),
      title: titleFor(p.pieceId),
    }));
  }, [state]);

  const availableSeries: string[] = useMemo(() => {
    const set = new Set<string>();
    for (const p of enriched) {
      if (p.series) set.add(p.series);
    }
    return Array.from(set).sort();
  }, [enriched]);

  /* Apply series filter to derive what the rest of the page sees. */
  const seriesFiltered: EnrichedPiece[] = useMemo(() => {
    if (selectedSeries === 'all') return enriched;
    return enriched.filter((p) => p.series === selectedSeries);
  }, [enriched, selectedSeries]);

  /* Counts for filter chrome — based on the series filter, before status filter. */
  const placedCount = useMemo(
    () => seriesFiltered.filter((p) => p.status === 'placed').length,
    [seriesFiltered],
  );
  const seekingCount = useMemo(
    () => seriesFiltered.filter((p) => p.status === 'seeking').length,
    [seriesFiltered],
  );

  /* Pieces visible on the globe respect both filters; status=seeking is shown
     in the seeking section, never on the globe (no coords to plot). */
  const globeNodes: GlobeNode[] = useMemo(() => {
    const visible = seriesFiltered.filter((p) => {
      if (status === 'seeking') return false; // seeking-only filter hides globe markers
      if (p.status !== 'placed') return false;
      if (!p.cityId) return false;
      return true;
    });
    const nodes: GlobeNode[] = [];
    for (const p of visible) {
      const c = p.cityId ? CITIES_BY_ID.get(p.cityId) : undefined;
      if (!c) continue;
      nodes.push({
        id: p.key,
        lat: c.lat,
        lng: c.lng,
        status: 'placed',
        label: p.title,
      });
    }
    return nodes;
  }, [seriesFiltered, status]);

  /* Seeking section honors filters — when status=placed, the section hides. */
  const seekingPieces: SeekingPiece[] = useMemo(() => {
    if (status === 'placed') return [];
    return seriesFiltered
      .filter((p) => p.status === 'seeking')
      .map((p) => ({
        pieceId: p.pieceId,
        editionNumber: p.editionNumber,
        title: p.title,
        series: p.series,
      }));
  }, [seriesFiltered, status]);

  /* Selected piece — falls back to null if the current selection got filtered out. */
  const selectedPiece: SelectedPiece | null = useMemo(() => {
    if (!selectedKey) return null;
    const match = seriesFiltered.find((p) => p.key === selectedKey);
    if (!match) return null;
    return {
      pieceId: match.pieceId,
      editionNumber: match.editionNumber,
      title: match.title,
      series: match.series,
      category: categoryFor(match.pieceId),
      status: match.status,
      cityLabel: cityLabelFor(match.cityId),
      placedAt: match.placedAt,
    };
  }, [selectedKey, seriesFiltered]);

  /* If the selected piece falls outside the current filters, drop selection
     silently so the side panel doesn't show stale info. */
  useEffect(() => {
    if (!selectedKey) return;
    const stillVisible = seriesFiltered.some((p) => p.key === selectedKey);
    if (!stillVisible) setSelectedKey(null);
  }, [selectedKey, seriesFiltered]);

  /* Mirror cobe's square sizing — Globe sets width=height=min(box.w,box.h). The
     SVG overlay reads the same dimensions so arcs land on the canvas pixels. */
  useEffect(() => {
    const el = globeBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        const d = Math.max(120, Math.min(cr.width, cr.height));
        setGlobeSize({ width: d, height: d });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* Kinship index — built off the raw atlas state, never the filtered slice.
     The map shows kinship as a property of the ledger, not of UI filters. */
  const kinshipIndex = useMemo(() => {
    if (state.kind !== 'ready') return null;
    return buildKinshipIndex(state.data, CITIES_BY_ID, FULL_ARCHIVE);
  }, [state]);

  useEffect(() => {
    if (kinshipIndex?.capped) {
      // Surface the cap in the architecture log per the spec.
      // eslint-disable-next-line no-console
      console.info(
        `[atlas/kinship] pair count exceeded MAX_KINSHIP_ARCS (${MAX_KINSHIP_ARCS}); rendering shortest arcs only.`,
      );
    }
  }, [kinshipIndex]);

  /* Kin list for the selected piece — only for UL pieces with kindred peers. */
  const kinForSelected: KinEntry[] = useMemo(() => {
    if (!selectedKey || !kinshipIndex) return [];
    const node = kinshipIndex.nodes.get(selectedKey);
    if (!node) return [];
    const pairs = kinshipIndex.pairsByKey.get(selectedKey) ?? [];
    return pairs
      .slice()
      .sort((a, b) => a.distance - b.distance)
      .slice(0, MAX_KIN_PER_PIECE)
      .map((pair) => {
        const otherKey = pair.aKey === selectedKey ? pair.bKey : pair.aKey;
        const other = kinshipIndex.nodes.get(otherKey);
        return { key: otherKey, title: other?.title ?? otherKey };
      });
  }, [selectedKey, kinshipIndex]);

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-32 pb-10 max-w-7xl mx-auto">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 gap-y-1 font-label text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] text-wood-700 mb-8 sm:mb-12"
        >
          <Link to="/" className="hover:text-wood-900 transition-colors">
            Home
          </Link>
          <span aria-hidden className="text-wood-400">
            /
          </span>
          <span className="text-wood-900">Atlas</span>
        </nav>

        <h1
          className="font-serif text-5xl md:text-7xl lg:text-8xl text-wood-900 font-medium leading-[0.93] mb-6"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}
        >
          Atlas
        </h1>
        <p className="font-serif text-xl md:text-2xl text-wood-700 max-w-2xl leading-[1.6]">
          Every piece, wherever it has come to rest. City-level only, never an address.
        </p>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="px-6 pb-32 max-w-7xl mx-auto">
        {state.kind === 'loading' && (
          <p
            className="font-serif italic text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            loading the atlas
          </p>
        )}

        {state.kind === 'error' && (
          <p
            className="font-serif italic text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            the atlas is briefly out of reach.
          </p>
        )}

        {state.kind === 'ready' && (
          <>
            {/* Filters */}
            <div className="border-t border-wood-200 pt-6 pb-8">
              <AtlasFilters
                series={availableSeries}
                selectedSeries={selectedSeries}
                onSeriesChange={setSelectedSeries}
                status={status}
                onStatusChange={setStatus}
                placedCount={placedCount}
                seekingCount={seekingCount}
                kinshipVisible={kinshipVisible}
                onKinshipChange={setKinshipVisible}
              />
            </div>

            {/* Globe + side panel.
                Globe takes ~60vh; side panel sits beside on lg+, below on smaller. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div
                ref={globeBoxRef}
                className="lg:col-span-2 w-full max-w-full overflow-hidden relative"
                style={{ height: '60vh', minHeight: 360 }}
              >
                <Globe
                  nodes={globeNodes}
                  selectedId={selectedKey}
                  onSelect={(id) => setSelectedKey(id)}
                  className="w-full h-full"
                />
                {kinshipIndex && (
                  <KinshipLayer
                    index={kinshipIndex}
                    width={globeSize.width}
                    height={globeSize.height}
                    selectedId={selectedKey}
                    visible={kinshipVisible}
                  />
                )}
              </div>
              <div className="lg:col-span-1">
                <PieceSidePanel
                  piece={selectedPiece}
                  kin={kinForSelected}
                  onSelectKin={(key) => setSelectedKey(key)}
                />
              </div>
            </div>

            {/* Seeking ground */}
            <div className="mt-16">
              <SeekingGround
                seekingPieces={seekingPieces}
                totalPieces={seriesFiltered.length}
                onSelect={(pieceId, editionNumber) =>
                  setSelectedKey(makeKey(pieceId, editionNumber))
                }
                selectedKey={selectedKey}
              />
            </div>

            {/* Generated-at footer note. */}
            <p className="mt-16 font-label text-[11px] uppercase tracking-[0.18em] text-wood-600">
              Last gathered{' '}
              {new Date(state.data.generatedAt).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default AtlasPage;
