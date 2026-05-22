import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../lib/profile/context';
import {
  POSITIONS_BY_KEY,
  POSITION_KEYS,
} from '../../data/profilePositions';
import type { ProfileKey } from '../../lib/astrology/types';
import { LAUNCH_FLAGS } from '../../launchFlags';

interface Props {
  /** The card's Human Design gate (1..64). */
  gate: number;
}

interface Match {
  key: ProfileKey;
  line: number;
}

/**
 * When a Universal Language card matches one or more positions in the
 * visitor's saved profile, this surfaces "This is your Pearl · Line 3"
 * with the position's role copy. Renders nothing when the profile is
 * absent or the gate doesn't match — no nag, no upsell.
 */
const YourPositionCallout: React.FC<Props> = ({ gate }) => {
  const { profile } = useProfile();

  const matches = useMemo<Match[]>(() => {
    if (!profile) return [];
    const out: Match[] = [];
    for (const key of POSITION_KEYS) {
      const gl = profile.computed[key];
      if (gl.gate === gate) out.push({ key, line: gl.line });
    }
    return out;
  }, [profile, gate]);

  if (!LAUNCH_FLAGS.hologeneticProfile || matches.length === 0) return null;

  const labelText = matches
    .map(({ key, line }) => `your ${POSITIONS_BY_KEY[key].label} · Line ${line}`)
    .join(' and ');
  const role = POSITIONS_BY_KEY[matches[0].key].role;

  return (
    <aside
      className="your-position-callout"
      aria-label="This card sits inside your Hologenetic Profile"
    >
      <div className="your-position-callout__label">Your profile</div>
      <div className="your-position-callout__title">This is {labelText}.</div>
      <p className="your-position-callout__role">{role}</p>
      <Link to="/oracle/profile" className="your-position-callout__link">
        View your full chart
      </Link>

      <style>{`
        .your-position-callout {
          width: 100%;
          max-width: 540px;
          margin: 16px 0;
          padding: 14px 16px;
          background: color-mix(in oklab, var(--color-paper-100) 85%, transparent);
          border: 1px solid color-mix(in oklab, var(--color-bronze-600) 30%, transparent);
          border-radius: 3px;
        }
        .your-position-callout__label {
          font-family: Cinzel, Palatino, serif;
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
          margin-bottom: 4px;
        }
        .your-position-callout__title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          font-style: italic;
          color: var(--color-wood-900);
          margin-bottom: 4px;
        }
        .your-position-callout__role {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 12px;
          color: var(--color-wood-700);
          margin: 0 0 8px;
          line-height: 1.5;
        }
        .your-position-callout__link {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
          text-decoration: none;
        }
        .your-position-callout__link:hover {
          color: var(--color-bronze-700, var(--color-bronze-600));
        }
      `}</style>
    </aside>
  );
};

export default YourPositionCallout;
