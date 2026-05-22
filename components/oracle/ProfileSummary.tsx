import React from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../../lib/profile/context';
import { PROFILE_POSITIONS } from '../../data/profilePositions';

/**
 * Compact representation of a saved profile, shown on /oracle when the
 * visitor has built theirs. Lists the four Activation positions
 * (Life's Work, Evolution, Radiance, Purpose) as the headline view, with
 * a link to the full graph and a clear button.
 */
const ProfileSummary: React.FC = () => {
  const { profile, clear } = useProfile();
  if (!profile) return null;

  const activation = PROFILE_POSITIONS.filter((p) => p.sequence === 'activation');

  return (
    <div className="profile-summary">
      <div className="profile-summary__head">
        <div className="profile-summary__label">Your profile</div>
        <div className="profile-summary__sub">{profile.inputs.place.label}</div>
      </div>
      <ul className="profile-summary__list">
        {activation.map((meta) => {
          const gl = profile.computed[meta.key];
          return (
            <li key={meta.key} className="profile-summary__row">
              <span className="profile-summary__pos">{meta.label}</span>
              <span className="profile-summary__gl">{gl.gate}.{gl.line}</span>
            </li>
          );
        })}
      </ul>
      <div className="profile-summary__actions">
        <Link to="/oracle/profile" className="profile-summary__link">
          View full chart
        </Link>
        <button
          type="button"
          className="profile-summary__clear"
          onClick={() => {
            if (window.confirm('Clear your saved profile from this device?')) {
              clear();
            }
          }}
        >
          Clear
        </button>
      </div>

      <style>{`
        .profile-summary {
          width: 100%;
          max-width: 360px;
          padding: 14px 16px;
          background: color-mix(in oklab, var(--color-paper-100) 80%, transparent);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 18%, transparent);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .profile-summary__head {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .profile-summary__label {
          font-family: Cinzel, Palatino, serif;
          font-size: 9px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
        }
        .profile-summary__sub {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--color-wood-600);
        }
        .profile-summary__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .profile-summary__row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px;
          color: var(--color-wood-900);
        }
        .profile-summary__gl {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: var(--color-bronze-600);
        }
        .profile-summary__actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 6px;
          border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent);
        }
        .profile-summary__link {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
          text-decoration: none;
        }
        .profile-summary__link:hover {
          color: var(--color-bronze-700, var(--color-bronze-600));
        }
        .profile-summary__clear {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-wood-600);
          background: transparent;
          border: 0;
          cursor: pointer;
        }
        .profile-summary__clear:hover {
          color: var(--color-wood-900);
        }
      `}</style>
    </div>
  );
};

export default ProfileSummary;
