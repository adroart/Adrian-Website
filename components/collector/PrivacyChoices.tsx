import React, { useEffect, useId, useState } from 'react';
import {
  getCollectorCuratedCities, updateCollectorPrivacy,
  type CollectorCuratedCity, type CollectorPrivacyState,
} from './api';
import { COPY } from './copy';
import { C, F } from './tokens';
import { Note, TLink } from './ui';
import { WalkScreen, type Screen } from './walk';

const G = COPY.gathering;

export function PrivacyChoices({
  screen, saved, keeperPieceId, onBack, onSaved,
}: {
  screen: Screen;
  saved: CollectorPrivacyState;
  keeperPieceId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [lamps, setLamps] = useState(() => [
    saved.ring4.shareIntention, saved.ring2.shareCity, saved.ring4.shareName,
    saved.ring4.shareFace, saved.ring3.shareDerivedChart, saved.ring4.shareBusiness,
    saved.ring4.shareMission,
  ]);
  const [cityId, setCityId] = useState(saved.ring2.cityId ?? '');
  const [cities, setCities] = useState<CollectorCuratedCity[] | null>(null);
  const [cityError, setCityError] = useState(false);
  const [cityAttempt, setCityAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cityInput = useId();
  const shareCity = lamps[1];

  useEffect(() => {
    if (!shareCity || cities) return;
    let active = true;
    setCityError(false);
    void getCollectorCuratedCities().then(result => {
      if (!active) return;
      if (result.ok) setCities(result.data);
      else setCityError(true);
    }).catch(() => { if (active) setCityError(true); });
    return () => { active = false; };
  }, [shareCity, cities, cityAttempt]);

  const save = async () => {
    if (saving) return;
    const city = shareCity ? cityId : null;
    const mapChanged = city !== saved.ring2.cityId || shareCity !== saved.ring2.shareCity;
    if (mapChanged && shareCity && !cities?.some(place => place.id === city)) {
      setError('Choose a city to show on the map.');
      return;
    }
    const person = {
      shareIntention: lamps[0], shareName: lamps[2], shareFace: lamps[3],
      shareDerivedChart: lamps[4], shareBusiness: lamps[5], shareMission: lamps[6],
    };
    const previous = { ...saved.ring3, ...saved.ring4 };
    const personChanged = Object.entries(person).some(([name, value]) => previous[name] !== value);
    if (!mapChanged && !personChanged) {
      onBack();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await updateCollectorPrivacy({
        ...(mapChanged ? { piece: { keeperPieceId, shareCity, cityId: city } } : {}),
        ...(personChanged ? { person } : {}),
      });
      if (result.ok) onSaved();
      else {
        const adulthood = 'error' in result
          && ['adult_status_required', 'minor_publicity_forbidden'].includes(result.error);
        setError(adulthood
          ? 'Public choices stay closed until adulthood is confirmed.'
          : 'Your privacy choices could not be saved right now. Please try again.');
      }
    } catch {
      setError('Your privacy choices could not be saved right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <fieldset disabled={saving} aria-busy={saving} style={{ display: 'contents' }}>
      <WalkScreen
        screen={{ ...screen, eyebrow: undefined, back: 'account', to: 'save', required: false, note: error }}
        onGo={target => target === 'save' ? void save() : onBack()}
        lampsValue={lamps}
        onLamps={setLamps}
        mapChoice={
          <div style={{ borderBottom: `1px solid ${C.hair}`, padding: '8px 4px 14px' }}>
            <label style={{ display: 'flex', gap: 12, alignItems: 'center', minHeight: 'var(--control-h)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={shareCity}
                onChange={event => {
                  const checked = event.target.checked;
                  setLamps(current => current.map((value, index) => index === 1 ? checked : value));
                  setError('');
                }}
                style={{ accentColor: C.brass, width: 18, height: 18, flexShrink: 0 }}
              />
              <span style={{ color: C.ink, fontFamily: F.body, fontSize: 'var(--text-body)' }}>{G.showLight}</span>
            </label>
            <Note>{G.showLightNote.split('. ')[0]}.</Note>
            {shareCity && (cityError ? (
              <TLink onClick={() => setCityAttempt(attempt => attempt + 1)}>Retry loading cities</TLink>
            ) : (
              <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                <label htmlFor={cityInput} style={{ color: C.ink, fontFamily: F.body, fontSize: 'var(--text-small)' }}>{G.fieldCity}</label>
                <select
                  id={cityInput}
                  value={cityId}
                  onChange={event => { setCityId(event.target.value); setError(''); }}
                  disabled={!cities}
                  style={{
                    width: '100%', minWidth: 0, minHeight: 'var(--control-h)', padding: '0 10px',
                    color: C.ink, background: C.sheet, border: `1px solid ${C.hairStrong}`, borderRadius: 'var(--radius-none)',
                    fontFamily: F.body, fontSize: 'var(--text-small)',
                  }}
                >
                  <option value="">{cities ? 'Choose a city' : 'Loading cities'}</option>
                  {cities?.map(city => <option key={city.id} value={city.id}>{city.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        }
      />
    </fieldset>
  );
}
