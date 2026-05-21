import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { todaysEnergy } from '../../lib/astrology/today';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import { findUlArtworkForGate } from '../../utils/universalLanguage';
import { img } from '../../utils/cloudinary';

/**
 * "Today's energy" — the gate the Sun is currently transiting, rendered as
 * a small linkable card with the corresponding UL artwork.
 */
const TodayEnergyPanel: React.FC<{ now?: Date }> = ({ now }) => {
  const { gate, line, card, artwork, thumb } = useMemo(() => {
    const energy = todaysEnergy(now);
    const card = CARD_BY_NUMBER.get(energy.gate) ?? null;
    const artwork = findUlArtworkForGate(energy.gate);
    const thumb = artwork ? img(artwork.coverImage, { w: 80, h: 80 }) : null;
    return { gate: energy.gate, line: energy.line, card, artwork, thumb };
  }, [now]);

  return (
    <Link
      to={`/oracle/universal-language/${gate}`}
      className="ul-energy-panel"
      aria-label={`Today's energy: gate ${gate} line ${line}${card ? `, ${card.card_name}` : ''}`}
    >
      <div className="ul-energy-panel__label">Today</div>
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

export default TodayEnergyPanel;
