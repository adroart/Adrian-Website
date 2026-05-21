import React from 'react';
import { Link } from 'react-router-dom';
import HexagramGlyph from './HexagramGlyph';
import {
  PROFILE_POSITIONS,
  SEQUENCE_LABEL,
} from '../../data/profilePositions';
import type { HologeneticProfile, ProfileSequence } from '../../lib/astrology/types';
import { CARD_BY_NUMBER } from '../../data/oracleData';

interface Props {
  profile: HologeneticProfile;
}

const ProfileGraph: React.FC<Props> = ({ profile }) => {
  const bySequence: Record<ProfileSequence, typeof PROFILE_POSITIONS> = {
    activation: PROFILE_POSITIONS.filter((p) => p.sequence === 'activation'),
    venus: PROFILE_POSITIONS.filter((p) => p.sequence === 'venus'),
    pearl: PROFILE_POSITIONS.filter((p) => p.sequence === 'pearl'),
  };

  return (
    <div className="profile-graph">
      {(['activation', 'venus', 'pearl'] as const).map((seq) => (
        <section key={seq} className="profile-graph__band">
          <h2 className="profile-graph__band-label">{SEQUENCE_LABEL[seq]}</h2>
          <ul className="profile-graph__list">
            {bySequence[seq].map((meta) => {
              const gl = profile[meta.key];
              const card = CARD_BY_NUMBER.get(gl.gate);
              return (
                <li key={meta.key}>
                  <Link
                    to={`/oracle/universal-language/${gl.gate}`}
                    className="profile-graph__row"
                  >
                    <HexagramGlyph gate={gl.gate} width={32} color="var(--color-wood-700)" />
                    <div className="profile-graph__text">
                      <div className="profile-graph__row-label">
                        <span className="profile-graph__position">{meta.label}</span>
                        <span className="profile-graph__gateline">
                          {gl.gate}.{gl.line}
                        </span>
                      </div>
                      <div className="profile-graph__row-detail">
                        {card ? card.card_name : `Gate ${gl.gate}`}
                        {meta.body ? ` · ${meta.body}` : null}
                      </div>
                      <p className="profile-graph__role">{meta.role}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <style>{`
        .profile-graph {
          display: flex;
          flex-direction: column;
          gap: 36px;
        }
        .profile-graph__band-label {
          font-family: Cinzel, Palatino, serif;
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
          margin: 0 0 12px;
        }
        .profile-graph__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .profile-graph__row {
          display: grid;
          grid-template-columns: 40px 1fr;
          align-items: start;
          gap: 14px;
          padding: 12px 14px;
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent);
          border-radius: 3px;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.2s, background 0.2s;
        }
        .profile-graph__row:hover {
          border-color: color-mix(in oklab, var(--color-bronze-600) 40%, transparent);
          background: color-mix(in oklab, var(--color-bronze-400) 5%, transparent);
        }
        .profile-graph__row-label {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
        }
        .profile-graph__position {
          font-family: 'Cormorant Garamond', serif;
          font-size: 19px;
          color: var(--color-wood-900);
        }
        .profile-graph__gateline {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.18em;
          color: var(--color-bronze-600);
        }
        .profile-graph__row-detail {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.06em;
          color: var(--color-wood-600);
          margin-top: 2px;
        }
        .profile-graph__role {
          font-family: 'Cormorant Garamond', serif;
          font-size: 14px;
          font-style: italic;
          color: var(--color-wood-700);
          margin: 6px 0 0;
        }
      `}</style>
    </div>
  );
};

export default ProfileGraph;
