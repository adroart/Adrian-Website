import { useId, useMemo, useState } from 'react';

import type {
  CollectorFieldArtwork as CanonicalCollectorFieldArtwork,
  CollectorFieldIdentity as CanonicalCollectorFieldIdentity,
  CollectorFieldState,
} from '../../utils/collectorField';

import FieldBrowse from './FieldBrowse';
import FieldMap, { markerPresentation } from './FieldMap';

export type CollectorFieldIdentity = CanonicalCollectorFieldIdentity;
export type CollectorFieldArtwork = CanonicalCollectorFieldArtwork;
export type CollectorFieldData = CollectorFieldState;

export type FieldItem = Omit<CollectorFieldArtwork, 'identity'> & {
  key: string;
  identity: CollectorFieldIdentity;
};

export type FieldFilters = {
  series: string;
  year: string;
  place: string;
};

export type FilteredFieldItem = {
  item: FieldItem;
  matches: boolean;
};

export type FieldExperienceProps = {
  status: 'loading' | 'ready' | 'error';
  data: CollectorFieldData | null;
  onRetry: () => void;
  error?: string | null;
  initialFilters?: Partial<FieldFilters>;
};

export { markerPresentation };

const ALL_FILTERS: FieldFilters = { series: 'all', year: 'all', place: 'all' };

export function flattenFieldData(data: CollectorFieldData): FieldItem[] {
  return data.lights.flatMap(({ identity, ...artwork }) =>
    identity.map((pieceIdentity, identityIndex) => ({
      ...artwork,
      identity: pieceIdentity,
      key: `${artwork.artworkId}::${pieceIdentity.publicCode ?? `catalog-${identityIndex + 1}`}`,
    })),
  );
}

export function filterFieldItems(items: readonly FieldItem[], filters: FieldFilters): FilteredFieldItem[] {
  return items.map((item) => ({
    item,
    matches:
      (filters.series === 'all' || item.series === filters.series)
      && (filters.year === 'all' || item.year === Number(filters.year))
      && (filters.place === 'all' || (
        item.identity.status === 'registered' && item.identity.city?.id === filters.place
      )),
  }));
}

function validFilters(
  filters: FieldFilters,
  facets: CollectorFieldData['facets'],
): FieldFilters {
  return {
    series: filters.series === 'all' || facets.series.includes(filters.series) ? filters.series : 'all',
    year: filters.year === 'all' || facets.years.includes(Number(filters.year)) ? filters.year : 'all',
    place: filters.place === 'all' || facets.places.some((place) => place.id === filters.place)
      ? filters.place
      : 'all',
  };
}

const styles = `
  .collector-field {
    color-scheme: dark;
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    box-sizing: border-box;
    background:
      radial-gradient(circle at 50% 32%, rgba(89, 72, 51, 0.3), transparent 38%),
      linear-gradient(155deg, #171310 0%, #0f0d0b 72%);
    border: 1px solid rgba(196, 170, 124, 0.24);
    color: #f2ece3;
    padding: clamp(1.25rem, 4vw, 3.5rem);
    font-family: "Lora", Georgia, serif;
  }
  .collector-field, .collector-field * { box-sizing: border-box; }
  .collector-field__header { max-width: 46rem; margin: 0 auto 2rem; text-align: center; }
  .collector-field__eyebrow,
  .collector-field__label,
  .collector-field__legend,
  .collector-field__state-line,
  .collector-field__lens-note {
    font-family: "Karla", system-ui, sans-serif;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    line-height: 1.45;
    text-transform: uppercase;
  }
  .collector-field__eyebrow { margin: 0 0 0.6rem; color: #c4aa7c; }
  .collector-field h2 {
    margin: 0;
    color: #f7f1e8;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: clamp(2.4rem, 7vw, 4.5rem);
    font-weight: 400;
    line-height: 0.98;
  }
  .collector-field__intro {
    max-width: 37rem;
    margin: 1rem auto 0;
    color: #d9cfc1;
    font-size: 1rem;
    line-height: 1.7;
  }
  .collector-field__filters {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    max-width: 58rem;
    margin: 0 auto 2rem;
    padding: 0;
    border: 0;
  }
  .collector-field__filters legend {
    width: 100%;
    margin-bottom: 0.85rem;
    color: #cdbb9c;
    text-align: center;
  }
  .collector-field__control { min-width: 0; }
  .collector-field__label { display: block; margin-bottom: 0.45rem; color: #cdbb9c; }
  .collector-field select {
    display: block;
    width: 100%;
    min-height: 44px;
    border: 1px solid rgba(196, 170, 124, 0.44);
    border-radius: 0;
    background: #17130f;
    color: #f5eee4;
    padding: 0.65rem 2.25rem 0.65rem 0.75rem;
    font: inherit;
  }
  .collector-field select:focus-visible,
  .collector-field a:focus-visible,
  .collector-field button:focus-visible {
    outline: 2px solid #d6c38a;
    outline-offset: 3px;
  }
  .collector-field__stage {
    position: relative;
    max-width: 76rem;
    margin: 0 auto;
    border: 1px solid rgba(196, 170, 124, 0.16);
    background: rgba(8, 7, 6, 0.36);
  }
  .collector-field__map { display: block; width: 100%; height: auto; overflow: visible; }
  .collector-field__graticule { fill: none; stroke: rgba(196, 170, 124, 0.18); stroke-width: 1; }
  .collector-field__equator { stroke: rgba(196, 170, 124, 0.28); }
  .collector-field__horizon { fill: rgba(196, 170, 124, 0.025); stroke: rgba(196, 170, 124, 0.24); }
  .collector-field__map-label { fill: #cdbb9c; font-family: "Karla", system-ui, sans-serif; font-size: 12px; letter-spacing: 1.4px; }
  .collector-field__marker { transition: opacity 450ms ease, filter 450ms ease; }
  .collector-field__marker-core { filter: drop-shadow(0 0 8px currentColor); }
  .collector-field__map-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    padding: 0.85rem 1rem 1rem;
    border-top: 1px solid rgba(196, 170, 124, 0.13);
    color: #cdbb9c;
  }
  .collector-field__map-legend span { display: inline-flex; align-items: center; min-height: 24px; }
  .collector-field__map-legend span::before {
    width: 6px;
    height: 6px;
    margin-right: 0.55rem;
    border: 1px solid #c4aa7c;
    border-radius: 50%;
    content: "";
  }
  .collector-field__browse { max-width: 76rem; margin: 2rem auto 0; }
  .collector-field__browse-intro { margin: 0 0 0.8rem; color: #d9cfc1; line-height: 1.65; }
  .collector-field__list { margin: 0; padding: 0; border-top: 1px solid rgba(196, 170, 124, 0.2); list-style: none; }
  .collector-field__item {
    border-bottom: 1px solid rgba(196, 170, 124, 0.16);
    transition: background-color 450ms ease, box-shadow 450ms ease;
  }
  .collector-field__item[data-field-match="false"] {
    background: rgba(196, 170, 124, 0.035);
    box-shadow: inset 2px 0 0 rgba(196, 170, 124, 0.34);
  }
  .collector-field__item-link {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(10rem, auto);
    align-items: center;
    gap: 0.75rem 1.5rem;
    min-height: 64px;
    padding: 0.85rem 0.25rem;
    color: inherit;
    text-decoration: none;
  }
  .collector-field__item-title { display: block; color: #f6efe6; font-size: 1.1rem; line-height: 1.35; }
  .collector-field__item-meta { display: block; margin-top: 0.25rem; color: #cdbfac; font-size: 0.875rem; line-height: 1.5; }
  .collector-field__item-state { color: #cdbb9c; font-size: 0.875rem; line-height: 1.5; text-align: right; }
  .collector-field__lens-note { display: block; margin-top: 0.2rem; color: #d6c38a; }
  .collector-field__state { max-width: 36rem; margin: 3rem auto; text-align: center; }
  .collector-field__state p { color: #d9cfc1; font-size: 1rem; line-height: 1.7; }
  .collector-field__retry {
    min-height: 44px;
    margin-top: 0.75rem;
    border: 1px solid #c4aa7c;
    background: transparent;
    color: #f4eadb;
    padding: 0.7rem 1.25rem;
    font-family: "Karla", system-ui, sans-serif;
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  @media (max-width: 640px) {
    .collector-field { padding: 1.25rem 0.9rem 1.75rem; }
    .collector-field__filters { grid-template-columns: 1fr; gap: 0.8rem; }
    .collector-field__item-link { grid-template-columns: 1fr; gap: 0.35rem; min-height: 76px; }
    .collector-field__item-state { text-align: left; }
    .collector-field__map-legend { display: grid; grid-template-columns: 1fr; gap: 0.2rem; }
    .collector-field__map-label { font-size: 34px; letter-spacing: 1px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .collector-field *, .collector-field *::before, .collector-field *::after {
      animation: none !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

function StateMessage({ kind, children, onRetry }: {
  kind: 'loading' | 'empty' | 'error';
  children: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="collector-field__state"
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
    >
      <p>{children}</p>
      {kind === 'error' && onRetry && (
        <button type="button" className="collector-field__retry" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export default function FieldExperience({
  status,
  data,
  onRetry,
  error,
  initialFilters = ALL_FILTERS,
}: FieldExperienceProps) {
  const componentId = useId();
  const titleId = `${componentId}-collector-field-title`;
  const introId = `${componentId}-collector-field-intro`;
  const seriesId = `${componentId}-collector-field-series`;
  const yearId = `${componentId}-collector-field-year`;
  const placeId = `${componentId}-collector-field-place`;
  const [filters, setFilters] = useState<FieldFilters>(() => ({ ...ALL_FILTERS, ...initialFilters }));
  const facets = data?.facets ?? { series: [], years: [], places: [] };
  const activeFilters = validFilters(filters, facets);
  const items = useMemo(() => data ? flattenFieldData(data) : [], [data]);
  const filteredItems = useMemo(() => filterFieldItems(items, activeFilters), [items, activeFilters]);

  return (
    <section className="collector-field" aria-labelledby={titleId} aria-busy={status === 'loading'}>
      <style>{styles}</style>
      <header className="collector-field__header">
        <p className="collector-field__eyebrow">The living registry</p>
        <h2 id={titleId}>Collector field</h2>
        <p id={introId} className="collector-field__intro">
          Browse every work by series, year, or recorded place. A lens quiets the rest without taking it away.
        </p>
      </header>

      {status === 'loading' && <StateMessage kind="loading">Gathering the field.</StateMessage>}
      {status === 'error' && (
        <StateMessage kind="error" onRetry={onRetry}>{error || 'The field could not be reached.'}</StateMessage>
      )}
      {status === 'ready' && (!data || data.schemaVersion !== 3) && (
        <StateMessage kind="error" onRetry={onRetry}>The field format could not be read.</StateMessage>
      )}
      {status === 'ready' && data?.schemaVersion === 3 && items.length === 0 && (
        <StateMessage kind="empty">No works are in the field yet.</StateMessage>
      )}
      {status === 'ready' && data?.schemaVersion === 3 && items.length > 0 && (
        <>
          <fieldset className="collector-field__filters" aria-describedby={introId}>
            <legend className="collector-field__legend">Browse the whole field</legend>
            <div className="collector-field__control">
              <label className="collector-field__label" htmlFor={seriesId}>Series</label>
              <select
                id={seriesId}
                value={activeFilters.series}
                onChange={(event) => setFilters((current) => ({ ...current, series: event.target.value }))}
              >
                <option value="all">All series</option>
                {data.facets.series.map((series) => <option key={series} value={series}>{series}</option>)}
              </select>
            </div>
            <div className="collector-field__control">
              <label className="collector-field__label" htmlFor={yearId}>Year</label>
              <select
                id={yearId}
                value={activeFilters.year}
                onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
              >
                <option value="all">All years</option>
                {data.facets.years.map((year) => <option key={year} value={String(year)}>{year}</option>)}
              </select>
            </div>
            <div className="collector-field__control">
              <label className="collector-field__label" htmlFor={placeId}>Place</label>
              <select
                id={placeId}
                value={activeFilters.place}
                onChange={(event) => setFilters((current) => ({ ...current, place: event.target.value }))}
              >
                <option value="all">All places</option>
                {data.facets.places.map((place) => <option key={place.id} value={place.id}>{place.label}</option>)}
              </select>
            </div>
          </fieldset>
          <FieldMap items={filteredItems} />
          <FieldBrowse items={filteredItems} />
        </>
      )}
    </section>
  );
}
