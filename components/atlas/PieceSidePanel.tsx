import React from 'react';

export interface SelectedPiece {
  pieceId: string;
  editionNumber?: number;
  title: string;
  series?: string;
  category?: string;
  status: 'seeking' | 'placed';
  cityLabel?: string;     // e.g. "Lisbon, Portugal"  (omitted when seeking)
  placedAt?: string;      // ISO of most recent placed/moved event
}

/** One kindred Universal Language piece, surfaced beneath a UL selection. */
export interface KinSummary {
  key: string;            // globe id (pieceId:editionNumber)
  title: string;
  cityLabel?: string;
}

export interface PieceSidePanelProps {
  piece: SelectedPiece | null;
  /**
   * Kin pieces for the current selection, sorted by great-circle proximity.
   * Empty array or undefined when there are no kin to display (e.g. non-UL
   * selection, no other UL pieces placed, or no shared trigrams).
   */
  kin?: KinSummary[];
  /** Click handler when a kin entry is selected. */
  onSelectKin?: (key: string) => void;
}

function formatPlacedYear(iso?: string): string | null {
  if (!iso) return null;
  // Show just the year. Anything more specific risks reading like an address-level breadcrumb.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getUTCFullYear());
}

const PieceSidePanel: React.FC<PieceSidePanelProps> = ({ piece, kin, onSelectKin }) => {
  if (!piece) {
    return (
      <aside
        aria-label="Selected piece"
        className="bg-paper-100 border border-wood-200 p-6 sm:p-8 min-h-[16rem] flex items-center justify-center"
      >
        <p className="font-serif italic text-base text-wood-600 max-w-xs text-center leading-[1.7]">
          Tap a point on the globe to see where that piece has come to rest.
        </p>
      </aside>
    );
  }

  const placedYear = formatPlacedYear(piece.placedAt);
  const isSeeking = piece.status === 'seeking';
  const statusLine = isSeeking
    ? 'seeking ground'
    : piece.cityLabel
    ? `placed in ${piece.cityLabel}`
    : 'placed';

  // Build inline detail row with middle-dot separators.
  const inlineBits: string[] = [];
  if (piece.series) inlineBits.push(piece.series);
  if (typeof piece.editionNumber === 'number')
    inlineBits.push(`Edition ${piece.editionNumber}`);
  if (placedYear && !isSeeking) inlineBits.push(placedYear);

  return (
    <aside
      aria-label={`Selected piece, ${piece.title}`}
      className="bg-paper-100 border border-wood-200 p-6 sm:p-8"
    >
      <p className="font-label text-[11px] uppercase tracking-[0.25em] text-bronze-700 mb-3">
        {piece.category ?? 'Selected piece'}
      </p>
      <h3 className="font-serif text-2xl sm:text-3xl text-wood-900 font-medium leading-tight mb-3">
        {piece.title}
      </h3>

      {inlineBits.length > 0 && (
        <p className="font-sans text-sm text-wood-700 leading-relaxed mb-5">
          {inlineBits.map((bit, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span aria-hidden className="mx-1.5 text-wood-400">
                  ·
                </span>
              )}
              <span>{bit}</span>
            </React.Fragment>
          ))}
        </p>
      )}

      <div className="border-t border-wood-200 pt-5">
        <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-1">
          Where it rests
        </p>
        <p
          className={`font-serif text-lg leading-snug ${
            isSeeking ? 'italic text-wood-700' : 'text-wood-900'
          }`}
        >
          {statusLine}
        </p>
      </div>

      {/* Kin section: only for UL pieces with at least one kindred placed piece.
          Capped at 6 entries upstream, sorted by great-circle proximity. */}
      {kin && kin.length > 0 && (
        <div className="border-t border-wood-200 pt-5 mt-5">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-2">
            Kin
          </p>
          <ul className="flex flex-col gap-1">
            {kin.map((k) => (
              <li key={k.key}>
                <button
                  type="button"
                  onClick={() => onSelectKin?.(k.key)}
                  className="font-serif text-base text-wood-900 hover:text-bronze-700 transition-colors text-left leading-snug"
                >
                  {k.title}
                  {k.cityLabel && (
                    <span className="font-sans text-sm text-wood-600">
                      <span aria-hidden className="mx-1.5 text-wood-400">·</span>
                      {k.cityLabel}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

export default PieceSidePanel;
