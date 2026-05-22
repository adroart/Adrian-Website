import React from 'react';

export interface SeekingPiece {
  pieceId: string;
  editionNumber?: number;
  title: string;
  series?: string;
}

export interface SeekingGroundProps {
  seekingPieces: SeekingPiece[];
  totalPieces: number;
  onSelect?: (pieceId: string, editionNumber?: number) => void;
  selectedKey?: string | null;   // matches `${pieceId}:${editionNumber ?? ''}`
}

const SeekingGround: React.FC<SeekingGroundProps> = ({
  seekingPieces,
  totalPieces,
  onSelect,
  selectedKey,
}) => {
  if (totalPieces === 0) {
    return null;
  }

  const count = seekingPieces.length;

  if (count === 0) {
    return (
      <section
        aria-labelledby="atlas-seeking-heading"
        className="border-t border-wood-200 pt-10"
      >
        <h2
          id="atlas-seeking-heading"
          className="font-serif text-2xl text-wood-900 font-medium mb-3"
        >
          Every piece has found ground
        </h2>
        <p className="font-serif italic text-base text-wood-700 leading-[1.7] max-w-prose">
          Nothing wandering, for now.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="atlas-seeking-heading"
      className="border-t border-wood-200 pt-10"
    >
      <h2
        id="atlas-seeking-heading"
        className="font-serif text-2xl text-wood-900 font-medium mb-3"
      >
        Seeking ground
      </h2>
      <p className="font-sans text-sm text-wood-700 leading-[1.7] max-w-prose mb-6">
        {count} of {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'} seeking ground.
        Made, not yet placed.
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        {seekingPieces.map((p) => {
          const key = `${p.pieceId}:${p.editionNumber ?? ''}`;
          const isSelected = selectedKey === key;
          const inline: string[] = [];
          if (p.series) inline.push(p.series);
          if (typeof p.editionNumber === 'number')
            inline.push(`Edition ${p.editionNumber}`);

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect?.(p.pieceId, p.editionNumber)}
                aria-pressed={isSelected}
                className={`w-full text-left py-2 border-b border-wood-200 transition-colors duration-200 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 ${
                  isSelected
                    ? 'text-bronze-700'
                    : 'text-wood-900 hover:text-bronze-700'
                }`}
              >
                <span className="font-serif text-base leading-snug">{p.title}</span>
                {inline.length > 0 && (
                  <span className="block font-label text-[11px] uppercase tracking-[0.15em] text-wood-600 mt-1">
                    {inline.map((bit, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && (
                          <span aria-hidden className="mx-1.5 text-wood-400">
                            ·
                          </span>
                        )}
                        <span>{bit}</span>
                      </React.Fragment>
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default SeekingGround;
