import { useEffect, useState } from 'react';
import { searchPlaces, type Place } from '../../../lib/astrology/places';
import type { BirthProfileInputs, CollectorOnboardingState } from '../../../utils/collectorOnboarding';
import {
  CLOSED_COLLECTOR_PRIVACY,
  type CollectorPersonChoices,
  type CollectorPrivacyState,
} from '../../../utils/collectorPrivacy';

export interface CuratedCityChoice {
  id: string;
  label: string;
}

interface PrivacyAndBirthProps {
  onboarding: CollectorOnboardingState;
  privacy?: CollectorPrivacyState;
  keeperPieceId?: string;
  curatedCities?: CuratedCityChoice[];
  onSaveBirth: (inputs: BirthProfileInputs) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  onSavePrivacy: (input: {
    person: CollectorPersonChoices;
    piece?: { keeperPieceId: string; shareCity: boolean; cityId: string | null };
  }) => Promise<void> | void;
}

const emptyInputs: BirthProfileInputs = {
  date: '',
  time: '',
  place: { label: '', lat: 0, lng: 0, tzId: '' },
};

const ringFourChoices = [
  ['shareFace', 'Your face'],
  ['shareName', 'Your name'],
  ['shareIntention', 'Your intention'],
  ['shareBusiness', 'Your business'],
  ['shareMission', 'Your mission'],
] as const;

function adulthoodIsEstablished(onboarding: CollectorOnboardingState): boolean {
  if (onboarding.status !== 'current') return false;
  const [year, month, day] = onboarding.inputs.date.split('-').map(Number);
  if (!year || !month || !day) return false;
  const today = new Date();
  let age = today.getUTCFullYear() - year;
  const currentMonth = today.getUTCMonth() + 1;
  const currentDay = today.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 18;
}

export default function PrivacyAndBirth({
  onboarding,
  privacy = CLOSED_COLLECTOR_PRIVACY,
  keeperPieceId,
  curatedCities = [],
  onSaveBirth,
  onSkip,
  onSavePrivacy,
}: PrivacyAndBirthProps) {
  const [inputs, setInputs] = useState<BirthProfileInputs>(
    onboarding.status === 'current' ? onboarding.inputs : emptyInputs,
  );
  const [editingBirth, setEditingBirth] = useState(onboarding.status !== 'current');
  const [person, setPerson] = useState<CollectorPersonChoices>({
    ...privacy.ring3,
    ...privacy.ring4,
  });
  const [shareCity, setShareCity] = useState(privacy.ring2.shareCity);
  const [cityId, setCityId] = useState(privacy.ring2.cityId ?? '');
  const [placeResults, setPlaceResults] = useState<Place[]>([]);
  const canOpenPublicChoices = adulthoodIsEstablished(onboarding);

  useEffect(() => {
    if (onboarding.status === 'current') setInputs(onboarding.inputs);
  }, [onboarding]);

  useEffect(() => {
    setPerson({ ...privacy.ring3, ...privacy.ring4 });
    setShareCity(privacy.ring2.shareCity);
    setCityId(privacy.ring2.cityId ?? '');
  }, [privacy]);

  useEffect(() => {
    if (!editingBirth || inputs.place.tzId || inputs.place.label.trim().length < 2) {
      setPlaceResults([]);
      return;
    }
    let current = true;
    void searchPlaces(inputs.place.label).then((places) => {
      if (current) setPlaceResults(places);
    });
    return () => { current = false; };
  }, [editingBirth, inputs.place.label, inputs.place.tzId]);

  const setPersonChoice = (key: keyof CollectorPersonChoices, value: boolean) => {
    setPerson((current) => ({ ...current, [key]: value }));
  };

  return (
    <section className="mx-auto max-w-3xl space-y-10" aria-labelledby="privacy-birth-title">
      <header className="space-y-3">
        <p className="font-label text-xs uppercase tracking-[0.18em] text-bronze-700">Your record</p>
        <h2 id="privacy-birth-title" className="font-title text-3xl text-wood-900">
          Privacy and birth details
        </h2>
        <p className="font-body text-lg text-wood-700">
          Your choices begin closed. You can open or close them whenever you want.
        </p>
        {!canOpenPublicChoices && (
          <p className="font-body text-wood-700">
            Birth details remain optional. Public choices stay closed until adulthood is confirmed.
          </p>
        )}
      </header>

      <div className="space-y-6">
        <fieldset className="space-y-2 border-t border-stone-200 pt-5">
          <legend className="font-title text-xl text-wood-900">Ring one, your private record</legend>
          <p className="font-body text-wood-700">
            Always private. There is no switch to expose it, and anything by or about a child stays here.
          </p>
        </fieldset>

        {keeperPieceId && (
          <fieldset className="space-y-3 border-t border-stone-200 pt-5">
            <legend className="font-title text-xl text-wood-900">Ring two, the dot on the map</legend>
            <label className="flex gap-3 font-body text-wood-800">
              <input
                type="checkbox"
                checked={shareCity}
                disabled={!canOpenPublicChoices && !shareCity}
                onChange={(event) => setShareCity(event.target.checked)}
              />
              Show the piece at city level, never at an address
            </label>
            {shareCity && (
              <label className="block space-y-2 font-label text-xs uppercase tracking-[0.12em] text-wood-700">
                City
                <select
                  value={cityId}
                  required
                  onChange={(event) => setCityId(event.target.value)}
                  className="block w-full border border-stone-300 bg-paper-50 p-3 font-body text-base normal-case tracking-normal"
                >
                  <option value="">Choose a city</option>
                  {curatedCities.map((city) => (
                    <option key={city.id} value={city.id}>{city.label}</option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>
        )}

        <fieldset className="space-y-3 border-t border-stone-200 pt-5">
          <legend className="font-title text-xl text-wood-900">Ring three, your chart</legend>
          <label className="flex gap-3 font-body text-wood-800">
            <input
              type="checkbox"
              checked={person.shareDerivedChart}
              disabled={!canOpenPublicChoices && !person.shareDerivedChart}
              onChange={(event) => setPersonChoice('shareDerivedChart', event.target.checked)}
            />
            Share what is derived from your birth details, never the details themselves
          </label>
        </fieldset>

        <fieldset className="space-y-3 border-t border-stone-200 pt-5">
          <legend className="font-title text-xl text-wood-900">Ring four, you</legend>
          {ringFourChoices.map(([key, label]) => (
            <label key={key} className="flex gap-3 font-body text-wood-800">
              <input
                type="checkbox"
                checked={person[key]}
                disabled={!canOpenPublicChoices && !person[key]}
                onChange={(event) => setPersonChoice(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={() => onSavePrivacy({
            person,
            piece: keeperPieceId
              ? { keeperPieceId, shareCity, cityId: shareCity ? cityId : null }
              : undefined,
          })}
          disabled={Boolean(keeperPieceId && shareCity && !cityId)}
          className="border border-bronze-600 px-5 py-3 font-label text-xs uppercase tracking-[0.14em] text-bronze-800 disabled:opacity-50"
        >
          Save privacy choices
        </button>
      </div>

      <div className="space-y-5 border-t border-stone-200 pt-8">
        <h3 className="font-title text-2xl text-wood-900">Birth details</h3>
        {onboarding.status === 'current' && !editingBirth ? (
          <div className="space-y-4">
            <p className="font-body text-wood-700">
              Your birth details are already here. You do not need to enter them again.
            </p>
            <button type="button" onClick={() => setEditingBirth(true)} className="font-label text-xs uppercase tracking-[0.14em] text-bronze-800">Update</button>
          </div>
        ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onSaveBirth(inputs);
            }}
          >
            <label className="space-y-2 font-label text-xs uppercase tracking-[0.12em] text-wood-700">
              Date
              <input type="date" required value={inputs.date} onChange={(event) => setInputs({ ...inputs, date: event.target.value })} className="block w-full border border-stone-300 bg-paper-50 p-3 font-body text-base" />
            </label>
            <label className="space-y-2 font-label text-xs uppercase tracking-[0.12em] text-wood-700">
              Time
              <input type="time" required value={inputs.time} onChange={(event) => setInputs({ ...inputs, time: event.target.value })} className="block w-full border border-stone-300 bg-paper-50 p-3 font-body text-base" />
            </label>
            <label className="space-y-2 font-label text-xs uppercase tracking-[0.12em] text-wood-700 sm:col-span-2">
              Birth place
              <input
                required
                autoComplete="off"
                value={inputs.place.label}
                onChange={(event) => setInputs({
                  ...inputs,
                  place: { label: event.target.value, lat: 0, lng: 0, tzId: '' },
                })}
                className="block w-full border border-stone-300 bg-paper-50 p-3 font-body text-base normal-case tracking-normal"
              />
              {placeResults.length > 0 && (
                <ul className="border border-stone-200 bg-paper-50 normal-case tracking-normal">
                  {placeResults.map((place) => (
                    <li key={`${place.label}:${place.tzId}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setInputs({
                            ...inputs,
                            place: {
                              label: place.label,
                              lat: place.lat,
                              lng: place.lng,
                              tzId: place.tzId,
                            },
                          });
                          setPlaceResults([]);
                        }}
                        className="block w-full px-3 py-2 text-left font-body text-base text-wood-800 hover:bg-stone-100"
                      >
                        {place.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </label>
            <div className="flex gap-4 sm:col-span-2">
              <button type="submit" disabled={!inputs.place.tzId} className="border border-bronze-600 px-5 py-3 font-label text-xs uppercase tracking-[0.14em] text-bronze-800 disabled:opacity-50">Save details</button>
              <button type="button" onClick={() => void onSkip()} className="px-5 py-3 font-label text-xs uppercase tracking-[0.14em] text-wood-600">Skip</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
