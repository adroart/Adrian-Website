import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProfile } from '../lib/profile/context';
import ProfileForm from './oracle/ProfileForm';
import ProfileGraph from './oracle/ProfileGraph';
import { useMetaTags } from '../hooks/useMetaTags';

/**
 * /oracle/profile
 *
 * Renders the birth-data form when no profile is saved; the graph + summary
 * when one is. Local-first: works without signing in. Sync to D1 happens
 * silently when accounts are configured AND the user is signed in.
 */
const OracleProfile: React.FC = () => {
  const { profile } = useProfile();
  const [editing, setEditing] = useState(false);

  useMetaTags({
    title: 'Your Hologenetic Profile · Universal Language',
    description:
      'Enter your birth data once and your eleven positions follow you through every Universal Language reading.',
  });

  const showForm = editing || !profile;

  return (
    <main className="min-h-screen pt-32 pb-24 px-6 max-w-3xl mx-auto">
      <header className="mb-10">
        <p
          style={{
            fontFamily: 'Cinzel, Palatino, serif',
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--color-bronze-600)',
            marginBottom: 14,
          }}
        >
          Universal Language
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 36,
            color: 'var(--color-wood-900)',
            margin: 0,
          }}
        >
          Your Hologenetic Profile
        </h1>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 17,
            color: 'var(--color-wood-700)',
            marginTop: 12,
            maxWidth: 560,
            lineHeight: 1.5,
          }}
        >
          Eleven positions calculated from the moment you arrived. Once entered,
          they follow you through every Universal Language reading, showing
          which card meets you in which place.
        </p>
      </header>

      {showForm ? (
        <ProfileForm
          initial={profile?.inputs ?? null}
          onSaved={() => setEditing(false)}
        />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 15,
                color: 'var(--color-wood-700)',
              }}
            >
              {profile!.inputs.date} at {profile!.inputs.time} · {profile!.inputs.place.label}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{
                fontFamily: "'Lato', Helvetica, sans-serif",
                fontSize: 10,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--color-bronze-600)',
                background: 'transparent',
                border: 0,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              Edit
            </button>
          </div>
          <ProfileGraph profile={profile!.computed} />
        </>
      )}

      <footer
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: '1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent)',
          fontFamily: "'Lato', Helvetica, sans-serif",
          fontSize: 11,
          color: 'var(--color-wood-600)',
          letterSpacing: '0.04em',
          lineHeight: 1.6,
        }}
      >
        <p>
          The Hologenetic Profile structure follows the Gene Keys synthesis by
          Richard Rudd. Artwork and interpretation by Adrian Rasmussen.
        </p>
        <p style={{ marginTop: 8 }}>
          Your birth data is stored on this device only.{' '}
          <Link to="/privacy" style={{ color: 'var(--color-bronze-600)' }}>
            How we handle data
          </Link>.
        </p>
      </footer>
    </main>
  );
};

export default OracleProfile;
