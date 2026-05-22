import React from 'react';
import { CARD_BY_NUMBER } from '../../data/oracleData';

const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  '☰': [true, true, true],
  '☷': [false, false, false],
  '☳': [false, false, true],
  '☵': [false, true, false],
  '☶': [true, false, false],
  '☴': [true, true, false],
  '☲': [true, false, true],
  '☱': [false, true, true],
};

interface Props {
  /** Gate number 1..64; used to look up the hexagram via CARD_BY_NUMBER. */
  gate: number;
  color?: string;
  width?: number;
  className?: string;
}

/**
 * Hexagram glyph for a given gate number. Looks the gate up in the oracle
 * data to find its upper/lower trigrams, then renders the six lines.
 * Shared by ProfileGraph, YourPositionCallout, and the today/year energy
 * panels — no markup duplication, single visual language.
 */
const HexagramGlyph: React.FC<Props> = ({
  gate,
  color = 'currentColor',
  width = 32,
  className,
}) => {
  const card = CARD_BY_NUMBER.get(gate);
  if (!card) return null;

  const lh = Math.max(2, Math.round(width * 0.1));
  const step = Math.round(width * 0.18);
  const totalH = lh + step * 5;
  const gap = Math.round(width * 0.14);
  const hw = (width - gap) / 2;

  const allLines = [
    ...(TRIGRAM_LINES[card.iching.upper_trigram.symbol] ?? [true, true, true]),
    ...(TRIGRAM_LINES[card.iching.lower_trigram.symbol] ?? [true, true, true]),
  ];

  return (
    <svg
      width={width}
      height={totalH}
      viewBox={`0 0 ${width} ${totalH}`}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {allLines.map((solid, i) => {
        const y = i * step;
        return solid ? (
          <rect key={i} x={0} y={y} width={width} height={lh} rx={1} fill={color} />
        ) : (
          <React.Fragment key={i}>
            <rect x={0} y={y} width={hw} height={lh} rx={1} fill={color} />
            <rect x={hw + gap} y={y} width={hw} height={lh} rx={1} fill={color} />
          </React.Fragment>
        );
      })}
    </svg>
  );
};

export default HexagramGlyph;
