/**
 * "The Viewing" — the client's artifact. A private, link-shared art lookbook.
 *
 * Display-first scaffolding. Renders a ViewingData object through five movements:
 *   1. Cover         — "For <name>", a contact-sheet of every piece
 *   2. Gallery       — large art-led cards (skim layer); star/select here
 *   3. Piece detail  — full reading, unfolds on "Read more" (dive layer)
 *   4. Recommendation— the signed dealer's note (2-3 picks + reasons)
 *   5. Selection tray— a near-invisible bar that ends in "Request these pieces"
 *
 * Design law (brand): nothing covers the artwork; no icons/badges/filled buttons;
 * no prices (the money arrives later as an invoice); state shown in text + bronze
 * only (★ recommended, ✓ selected). Mobile-first; motion is a whisper.
 *
 * Data source today: baked-in SAMPLE_VIEWING. Later: GET /api/viewings/:token.
 * "Request these pieces" is stubbed — it will hand the selection to the invoice
 * flow (/admin/invoices) once the Curation Desk + delivery API are built.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { img } from '../../utils/cloudinary';
import type { ViewingData, ViewingPiece } from './viewingTypes';
import { SAMPLE_VIEWING } from './sampleViewing';
import { UL_COVER_BY_CODE } from './ulCovers';

/**
 * Resolve a piece's image. Pull from the LINKED SITE first — the Universal
 * Language cover for this code in Adrian's own Cloudinary cloud — so the
 * collector sees the site's photographs, not the engine's. Fall back to an
 * explicit full URL on the piece, then nothing.
 */
function pieceImg(p: ViewingPiece, w: number, crop: 'fit' | 'fill' = 'fit'): string | undefined {
  const siteCover = p.code ? UL_COVER_BY_CODE[p.code] : undefined;
  if (siteCover) return img(siteCover, { w, crop });
  if (p.image && /^https?:\/\//.test(p.image)) return p.image;
  return undefined;
}

const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`font-label text-[10px] uppercase tracking-[0.22em] text-bronze-600 ${className}`}>{children}</span>
);

/** A scannable row of evocative keywords. Pure art language, no system. */
const Keywords: React.FC<{ words?: string[] }> = ({ words }) => {
  if (!words || words.length === 0) return null;
  return (
    <p className="font-label text-[14px] sm:text-[15px] uppercase tracking-[0.16em] text-bronze-600 my-4 leading-relaxed">
      {words.map((w, i) => (
        <React.Fragment key={w}>
          {i > 0 && <span className="text-bronze-500 px-2">·</span>}
          {w}
        </React.Fragment>
      ))}
    </p>
  );
};

/** One art-led card in the gallery, with inline expand for a taste of the piece. */
const PieceCard: React.FC<{
  piece: ViewingPiece;
  selected: boolean;
  onToggleSelect: () => void;
}> = ({ piece, selected, onToggleSelect }) => {
  const hero = pieceImg(piece, 1400, 'fit');
  const [expanded, setExpanded] = useState(false);

  // First paragraph by default; "Read more" reveals the other two.
  const paragraphs = (piece.description || '').split('\n\n').filter(Boolean);
  const firstPara = paragraphs[0] || '';
  const restParas = paragraphs.slice(1);

  return (
    <article id={`piece-${piece.code}`} className="max-w-3xl mx-auto px-6 py-16 sm:py-20 scroll-mt-6">
      {/* The artwork dominates. Nothing sits on top of it. */}
      <figure className="m-0">
        {hero ? (
          <img
            src={hero}
            alt={`${piece.name}, Universal Language ${piece.code}. Original multi-dimensional wooden sculpture by Adrian Rasmussen.`}
            className="w-full border border-wood-200 bg-paper-100 block"
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square border border-wood-200 bg-paper-100 flex items-center justify-center">
            <Label>image</Label>
          </div>
        )}
      </figure>

      <div className="mt-3">
        {/* The label row spans the full art width; the star sits at its right
            end (its original spot), separate from the title. */}
        <div className="flex items-baseline justify-between gap-4 w-full">
          <Label>Universal Language · No. {piece.code}</Label>
          {piece.recommended && <span className="text-bronze-600 text-sm leading-none" aria-label="recommended">★</span>}
        </div>

        <h2 className="font-display text-4xl sm:text-5xl text-wood-900 mt-1.5 leading-tight">{piece.name}</h2>

        {/* Keywords full width (match the art), then the reading. The glance
            line is dropped — it duplicated the first sentence. */}
        <Keywords words={piece.keywords} />
        {firstPara && (
          <p className="font-sans text-wood-800 text-base leading-relaxed mt-3 whitespace-pre-line">{firstPara}</p>
        )}
        {restParas.length > 0 && expanded && (
          <p className="font-sans text-wood-800 text-base leading-relaxed mt-4 whitespace-pre-line">
            {restParas.join('\n\n')}
          </p>
        )}
        {restParas.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 hover:text-bronze-700 underline underline-offset-4 decoration-wood-200 transition-colors mt-3"
          >
            {expanded ? 'Read less' : 'Read more'}
          </button>
        )}

        {/* Matching bordered buttons: Select (fills when chosen) + Go deeper. */}
        <div className="flex flex-wrap items-center gap-3 mt-7 pt-5 border-t border-wood-200">
          <button
            type="button"
            onClick={onToggleSelect}
            className={`font-label text-[11px] uppercase tracking-[0.18em] border px-5 py-2.5 transition-colors ${
              selected
                ? 'border-bronze-500 bg-bronze-200 text-bronze-700'
                : 'border-wood-300 text-wood-700 hover:border-bronze-500 hover:text-bronze-700'
            }`}
          >
            {selected ? '✓ Selected' : 'Select'}
          </button>
          {piece.pieceUrl && (
            <a
              href={piece.pieceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-label text-[11px] uppercase tracking-[0.18em] border border-wood-300 text-wood-700 hover:border-bronze-500 hover:text-bronze-700 px-5 py-2.5 transition-colors"
            >
              Go deeper
            </a>
          )}
        </div>
      </div>
    </article>
  );
};

const Viewing: React.FC<{ data?: ViewingData }> = ({ data: dataProp }) => {
  const { token } = useParams<{ token: string }>();

  // Three sources, in order: explicit prop (the desk's live preview), a token
  // fetch (a real shared viewing), or the baked-in sample (token === 'sample'
  // or no token, for design/testing).
  const [fetched, setFetched] = useState<ViewingData | null>(null);
  useEffect(() => {
    if (dataProp || !token || token === 'sample') return;
    let live = true;
    fetch(`/api/viewings/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (live && d?.ok) setFetched(d.viewing as ViewingData);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [dataProp, token]);

  const data: ViewingData = dataProp ?? fetched ?? SAMPLE_VIEWING;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [trayOpen, setTrayOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const byId = useMemo(() => new Map(data.pieces.map((p) => [p.id, p])), [data.pieces]);
  const chosen = [...selected].map((id) => byId.get(id)).filter(Boolean) as ViewingPiece[];

  // Codes not already featured — the "rest of the collection" grid.
  const restCodes = useMemo(() => {
    const shown = new Set(data.pieces.map((p) => p.code));
    return Object.keys(UL_COVER_BY_CODE)
      .map(Number)
      .filter((c) => !shown.has(c))
      .sort((a, b) => a - b);
  }, [data.pieces]);

  const requestPieces = async () => {
    if (requesting || requested) return;
    // No token (sample / desk preview): nothing to persist, just confirm.
    if (!token || token === 'sample' || dataProp) {
      setRequested(true);
      return;
    }
    setRequesting(true);
    try {
      const res = await fetch(`/api/viewings/${encodeURIComponent(token)}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pieceIds: [...selected] }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d?.ok) setRequested(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900 pb-28">
      {/* 1 · Cover — title, then the contact-sheet pulled up tight beneath it. */}
      <header className="max-w-4xl mx-auto px-6 pt-24 sm:pt-28 pb-16">
        <Label className="text-[11px] tracking-[0.32em]">A Private Viewing</Label>
        <h1 className="font-display text-5xl sm:text-7xl leading-[1.02] text-wood-900 mt-3">
          For {data.recipientName}
        </h1>
        <p className="font-sans italic text-wood-600 text-xl mt-4 max-w-[34ch]">{data.subtitle}</p>

        {/* Contact sheet: click a piece to jump to its card below. */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-6 mt-10">
          {data.pieces.map((p) => {
            const t = pieceImg(p, 360, 'fill');
            return (
              <a
                key={p.id}
                href={`#piece-${p.code}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`piece-${p.code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="group flex flex-col gap-1.5 cursor-pointer"
              >
                {t ? (
                  <img src={t} alt="" className="w-full aspect-square object-cover border border-wood-200 group-hover:border-bronze-500 transition-colors" loading="lazy" />
                ) : (
                  <div className="w-full aspect-square border border-wood-200 bg-paper-100" />
                )}
                <span className="font-label text-[9px] uppercase tracking-[0.12em] text-wood-600 group-hover:text-bronze-700 leading-tight transition-colors">
                  {p.recommended && <span className="text-bronze-600">★ </span>}
                  {p.name}
                </span>
              </a>
            );
          })}
        </div>
        <div className="flex justify-between mt-10 border-t border-wood-200 pt-3">
          <Label className="text-[9px] tracking-[0.16em]">Pieces chosen with you in mind</Label>
          <Label className="text-[9px] tracking-[0.16em]">adrianrasmussen.com</Label>
        </div>
      </header>

      {/* 2 + 3 · Gallery (art-led cards) with inline detail */}
      <section className="divide-y divide-wood-200 border-t border-wood-200">
        {data.pieces.map((p) => (
          <PieceCard key={p.id} piece={p} selected={selected.has(p.id)} onToggleSelect={() => toggle(p.id)} />
        ))}
      </section>

      {/* 4 · The recommendation (signed dealer's note) */}
      {data.recommendation && data.recommendation.picks.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-20 border-t border-wood-200">
          <Label className="text-[11px] tracking-[0.32em]">A Recommendation</Label>
          <h2 className="font-display text-4xl sm:text-5xl text-wood-900 mt-3 leading-tight">
            What I'd choose for you
          </h2>
          {data.recommendation.intention && (
            <p className="font-sans text-wood-600 text-lg leading-relaxed mt-4 max-w-[54ch]">
              Based on what you told me, <em>{data.recommendation.intention}</em>.
            </p>
          )}

          <div className="mt-10 space-y-8">
            {data.recommendation.picks.map((pick) => {
              const piece = byId.get(pick.pieceId);
              if (!piece) return null;
              const t = pieceImg(piece, 200, 'fill');
              return (
                <div key={pick.pieceId} className="grid grid-cols-[88px_1fr] gap-5 border-t border-wood-200 pt-6">
                  {t ? (
                    <img src={t} alt="" className="w-[88px] h-[88px] object-cover border border-wood-200" loading="lazy" />
                  ) : (
                    <div className="w-[88px] h-[88px] border border-wood-200 bg-paper-100" />
                  )}
                  <div>
                    <Label>Universal Language · No. {piece.code}</Label>
                    <h3 className="font-display text-2xl text-wood-900 mt-1 leading-tight">{piece.name}</h3>
                    <p className="font-sans text-wood-800 text-sm leading-relaxed mt-1.5 max-w-prose">{pick.reason}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {data.recommendation.closing && (
            <p className="font-sans text-wood-800 text-base leading-relaxed border-t border-wood-200 pt-5 mt-8">
              {data.recommendation.closing}
            </p>
          )}
          <p className="font-display italic text-wood-600 text-xl mt-2">— {data.recommendation.signature || 'Adrian'}</p>
        </section>
      )}

      {/* The rest of the collection — only for open/anonymous viewings. */}
      {data.showRestOfCollection && (
        <section className="max-w-3xl mx-auto px-6 py-16 border-t border-wood-200">
          <Label className="text-[11px] tracking-[0.32em]">The rest of the collection</Label>
          <p className="font-sans italic text-wood-600 text-base mt-3 mb-8 max-w-prose">
            The full Universal Language. Tap any piece to read its code.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
            {restCodes.map((code) => {
              const cover = UL_COVER_BY_CODE[code];
              return (
                <a
                  key={code}
                  href={`https://mandalacodes.com/universal-language/${code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  {cover ? (
                    <img src={img(cover, { w: 240, crop: 'fill' })} alt="" className="w-full aspect-square object-cover border border-wood-200 group-hover:border-bronze-500 transition-colors" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-square border border-wood-200 bg-paper-100" />
                  )}
                  <span className="font-label text-[9px] uppercase tracking-[0.14em] text-wood-500 group-hover:text-bronze-700 block mt-1.5">No. {code}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* 5 · Selection tray — near-invisible until something is chosen */}
      {chosen.length > 0 && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 bg-paper-50/95 backdrop-blur-sm border-t border-wood-200">
            <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setTrayOpen((o) => !o)}
                className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-700"
              >
                {chosen.length} piece{chosen.length === 1 ? '' : 's'} selected
              </button>
              <button
                type="button"
                onClick={requestPieces}
                disabled={requesting || requested}
                className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-700 border border-bronze-500 px-4 py-2 hover:bg-bronze-200 disabled:opacity-60 transition-colors"
              >
                {requested ? '✓ Request received' : requesting ? 'Sending…' : 'Request these pieces'}
              </button>
            </div>

            {trayOpen && (
              <div className="max-w-3xl mx-auto px-6 pb-4 border-t border-wood-200">
                <ul className="divide-y divide-wood-200">
                  {chosen.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                      <span className="font-sans text-wood-800 text-sm">
                        {p.name} <span className="text-wood-600">· No. {p.code}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggle(p.id)}
                        className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-500 hover:text-bronze-700 underline underline-offset-4"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Viewing;
