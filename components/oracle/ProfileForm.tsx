import React, { useEffect, useRef, useState } from 'react';
import { useProfile } from '../../lib/profile/context';
import { searchPlaces, type Place } from '../../lib/astrology/places';
import type { ProfileInputs } from '../../lib/profile/storage';

interface ProfileFormProps {
  initial?: ProfileInputs | null;
  onSaved?: () => void;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ initial, onSaved }) => {
  const { save } = useProfile();
  const [date, setDate] = useState<string>(initial?.date ?? '');
  const [time, setTime] = useState<string>(initial?.time ?? '');
  const [placeQuery, setPlaceQuery] = useState<string>(initial?.place?.label ?? '');
  const [place, setPlace] = useState<Place | null>(initial?.place ?? null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced place lookup as the user types.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!placeQuery || placeQuery === place?.label) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(placeQuery, 8);
      setSuggestions(results);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [placeQuery, place]);

  const canSubmit = !!date && !!time && !!place && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !place) return;
    setError(null);
    setSubmitting(true);
    try {
      await save({ date, time, place });
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong building your profile. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectPlace = (p: Place) => {
    setPlace(p);
    setPlaceQuery(p.label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <div className="profile-form__field">
        <label htmlFor="profile-date" className="profile-form__label">
          Birth date
        </label>
        <input
          id="profile-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="profile-form__input"
          required
          autoComplete="bday"
        />
      </div>

      <div className="profile-form__field">
        <label htmlFor="profile-time" className="profile-form__label">
          Birth time
        </label>
        <input
          id="profile-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="profile-form__input"
          required
        />
        <p className="profile-form__help">
          As exact as possible. Every minute matters for the moving positions.
        </p>
      </div>

      <div className="profile-form__field">
        <label htmlFor="profile-place" className="profile-form__label">
          Birth place
        </label>
        <input
          id="profile-place"
          type="text"
          value={placeQuery}
          onChange={(e) => {
            setPlaceQuery(e.target.value);
            setPlace(null);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
          className="profile-form__input"
          placeholder="City, region or country"
          autoComplete="off"
          required
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="profile-form__suggestions" role="listbox">
            {suggestions.map((s) => (
              <li
                key={`${s.lat}_${s.lng}_${s.tzId}`}
                role="option"
                aria-selected={place?.label === s.label}
              >
                <button
                  type="button"
                  className="profile-form__suggestion"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectPlace(s);
                  }}
                >
                  <span className="profile-form__suggestion-label">{s.label}</span>
                  <span className="profile-form__suggestion-tz">{s.tzId}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {place && (
          <p className="profile-form__help">
            {place.tzId} resolved from {place.label}
          </p>
        )}
      </div>

      {error && <p className="profile-form__error" role="alert">{error}</p>}

      <button type="submit" className="profile-form__submit" disabled={!canSubmit}>
        {submitting ? 'Building...' : 'Build my profile'}
      </button>

      <style>{`
        .profile-form {
          max-width: 460px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .profile-form__field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }
        .profile-form__label {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-wood-700);
        }
        .profile-form__input {
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px;
          color: var(--color-wood-900);
          background: var(--color-paper-50);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 30%, transparent);
          border-radius: 3px;
          padding: 10px 12px;
          outline: 2px solid transparent;
          outline-offset: 2px;
          transition: border-color 0.2s, outline-color 0.2s;
        }
        .profile-form__input:focus-visible {
          outline-color: var(--color-bronze-500);
          border-color: var(--color-bronze-500);
        }
        .profile-form__help {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          color: var(--color-wood-600);
        }
        .profile-form__error {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 12px;
          color: #a04040;
        }
        .profile-form__suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 5;
          background: var(--color-paper-50);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 18%, transparent);
          border-radius: 3px;
          margin: 4px 0 0;
          padding: 4px 0;
          list-style: none;
          max-height: 260px;
          overflow-y: auto;
          box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.15);
        }
        .profile-form__suggestion {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          padding: 8px 12px;
          background: transparent;
          border: 0;
          font-family: 'Cormorant Garamond', serif;
          font-size: 15px;
          color: var(--color-wood-900);
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
        }
        .profile-form__suggestion:hover {
          background: color-mix(in oklab, var(--color-bronze-400) 8%, transparent);
        }
        .profile-form__suggestion-tz {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          color: var(--color-wood-600);
          letter-spacing: 0.1em;
        }
        .profile-form__submit {
          align-self: flex-start;
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-paper-50);
          background: var(--color-bronze-600);
          border: 0;
          border-radius: 3px;
          padding: 12px 20px;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
        }
        .profile-form__submit:hover {
          background: var(--color-bronze-700, var(--color-bronze-600));
        }
        .profile-form__submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
};

export default ProfileForm;
