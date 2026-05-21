import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { yearsEnergy } from '../../lib/astrology/today';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import { findUlArtworkForGate } from '../../utils/universalLanguage';
import { img } from '../../utils/cloudinary';

/**
 * "Year's keynote" — the gate the Sun sits in at the Human Design new year
 * (Jan 22 ~09:30 UTC = Gate 41 transit). Always Gate 41 by definition, but
 * the line shifts year by year, and we render it for parity with the daily
 * panel.
 */
const YearEnergyPanel: React.FC<{ now?: Date }> = ({ now }) => {
  const { gate, line, year, card, thumb } = useMemo(() => {
    const energy = yearsEnergy(now);
    const card = CARD_BY_NUMBER.get(energy.gate) ?? null;
    const artwork = findUlArtworkForGate(energy.gate);
    const thumb = artwork ? img(artwork.coverImage, { w: 80, h: 80 }) : null;
    return { gate: energy.gate, line: energy.line, year: energy.year, card, thumb };
  }, [now]);

  return (
    <Link
      to={`/oracle/universal-language/${gate}`}
      className="ul-energy-panel"
      aria-label={`The year ${year}'s keynote: gate ${gate} line ${line}${card ? `, ${card.card_name}` : ''}`}
    >
      <div className="ul-energy-panel__label">The Year {year}</div>
      {thumb && (
        <img
          src={thumb}
          alt=""
          aria-hidden="true"
          className="ul-energy-panel__thumb"
          loading="lazy"
        />
      )}
      <div className="ul-energy-panel__body">
        <div className="ul-energy-panel__title">
          {card ? card.card_name : `Gate ${gate}`}
        </div>
        <div className="ul-energy-panel__meta">
          Gate {gate} · Line {line}
          {card ? <> · {card.gene_keys.gift}</> : null}
        </div>
      </div>
    </Link>
  );
};

export default YearEnergyPanel;
