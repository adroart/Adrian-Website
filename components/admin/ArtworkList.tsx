import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  searchMaintenance,
  MaintenanceRequestError,
  type MaintenanceListItem,
  type MaintenanceSearchFilters,
} from '../../utils/adminRegistryMaintenance';
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader, AdminSection } from './AdminPage';

// Every screen here reads the same private piece registry that Maintenance
// already searches (GET /api/admin/maintenance, via the Maintenance client
// helpers). That endpoint already joins the catalog title onto each
// registered piece and is the one place Adrian can find a piece by public
// code, artwork ID, title, or edition number, so this page calls it
// directly rather than building a second search against the same rows.

type Tab = 'artworks' | 'search';
type LoadStatus = 'loading' | 'ready' | 'error';

type SearchDraft = {
  publicCode: string;
  artworkId: string;
  title: string;
  editionNumber: string;
};

const EMPTY_DRAFT: SearchDraft = { publicCode: '', artworkId: '', title: '', editionNumber: '' };

const tabButtonClass = (active: boolean) => [
  'border-b-2 px-1 pb-3 font-sans text-sm font-semibold uppercase tracking-wide transition-colors',
  active
    ? 'border-bronze-600 text-wood-900'
    : 'border-transparent text-wood-500 hover:text-wood-800',
].join(' ');

const linkClass = 'font-sans text-base font-semibold text-bronze-700 underline decoration-bronze-300 underline-offset-4 hover:text-bronze-900';
const inputClass = 'w-full rounded border border-wood-300 bg-paper-50 px-3 py-2 font-sans text-base text-wood-900';
const labelClass = 'block font-sans text-sm font-semibold text-wood-700';
const primaryButtonClass = 'rounded bg-bronze-700 px-4 py-2 font-sans text-sm font-semibold text-paper-50 hover:bg-bronze-800 disabled:cursor-not-allowed disabled:opacity-50';
const quietButtonClass = 'font-sans text-sm font-semibold text-wood-600 underline decoration-wood-300 underline-offset-4 hover:text-wood-900';

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof MaintenanceRequestError) {
    if (error.code === 'invalid_filter' || error.code === 'invalid_public_code'
      || error.code === 'invalid_artwork_id' || error.code === 'invalid_edition_number') {
      return 'Those search values are not valid. Check the format and try again.';
    }
  }
  return fallback;
}

function displayEdition(editionNumber: number): string {
  return editionNumber === 0 ? 'Unique work' : `Edition ${editionNumber}`;
}

function stateLabel(value: string): string {
  return value.replaceAll('_', ' ');
}

function workspaceHref(item: MaintenanceListItem): string {
  const params = new URLSearchParams({ instance: item.id });
  return `/admin/artworks/${encodeURIComponent(item.artworkId)}?${params.toString()}`;
}

const ResultRow: React.FC<{ item: MaintenanceListItem }> = ({ item }) => (
  <li className="border-t border-wood-200 py-4 first:border-t-0">
    <Link className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between" to={workspaceHref(item)}>
      <span>
        <span className="font-serif text-lg text-wood-900">{item.title}</span>
        <span className="ml-2 font-sans text-sm text-wood-600">
          {item.artworkId} &middot; {displayEdition(item.editionNumber)}
        </span>
      </span>
      <span className="font-sans text-sm text-wood-600">
        {item.publicCode || 'No public code'} &middot; {stateLabel(item.plateStatus)}
      </span>
    </Link>
  </li>
);

const ResultList: React.FC<{
  status: LoadStatus;
  errorMessage: string;
  results: MaintenanceListItem[];
  emptyTitle: string;
  emptyDescription: string;
  loadingLabel: string;
}> = ({ status, errorMessage, results, emptyTitle, emptyDescription, loadingLabel }) => {
  if (status === 'loading') return <AdminAlert tone="info" live>{loadingLabel}</AdminAlert>;
  if (status === 'error') return <AdminAlert tone="error" live>{errorMessage}</AdminAlert>;
  if (!results.length) return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="min-w-0">
      {results.map(item => <ResultRow key={item.id} item={item} />)}
    </ul>
  );
};

const ArtworkList: React.FC = () => {
  const [tab, setTab] = useState<Tab>('artworks');

  const [listResults, setListResults] = useState<MaintenanceListItem[]>([]);
  const [listStatus, setListStatus] = useState<LoadStatus>('loading');
  const [listError, setListError] = useState('');

  const [searchDraft, setSearchDraft] = useState<SearchDraft>(EMPTY_DRAFT);
  const [searchResults, setSearchResults] = useState<MaintenanceListItem[]>([]);
  const [searchStatus, setSearchStatus] = useState<LoadStatus | 'idle'>('idle');
  const [searchError, setSearchError] = useState('');
  const [draftError, setDraftError] = useState('');
  const searchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setListStatus('loading');
    setListError('');
    void searchMaintenance({}, controller.signal)
      .then((results) => {
        if (controller.signal.aborted) return;
        setListResults(results);
        setListStatus('ready');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted
          || (error instanceof DOMException && error.name === 'AbortError')) return;
        setListError(messageFor(error, 'Artworks could not be loaded. Reload this page to try again.'));
        setListStatus('error');
      });
    return () => controller.abort();
  }, []);

  const runSearch = useCallback((filters: MaintenanceSearchFilters, signal: AbortSignal) => {
    setSearchStatus('loading');
    setSearchError('');
    void searchMaintenance(filters, signal)
      .then((results) => {
        if (signal.aborted) return;
        setSearchResults(results);
        setSearchStatus('ready');
      })
      .catch((error: unknown) => {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setSearchError(messageFor(error, 'The search could not be completed. Try again.'));
        setSearchStatus('error');
      });
  }, []);

  useEffect(() => () => searchAbortRef.current?.abort(), []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const edition = searchDraft.editionNumber.trim();
    if (edition && (!/^\d+$/.test(edition) || Number(edition) > 9999)) {
      setDraftError('Edition number must be a whole number from 0 to 9999.');
      return;
    }
    setDraftError('');
    const filters: MaintenanceSearchFilters = {
      publicCode: searchDraft.publicCode,
      artworkId: searchDraft.artworkId,
      title: searchDraft.title,
      ...(edition ? { editionNumber: Number(edition) } : {}),
    };
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    runSearch(filters, controller.signal);
  };

  const clearSearch = () => {
    searchAbortRef.current?.abort();
    setSearchDraft(EMPTY_DRAFT);
    setSearchResults([]);
    setSearchStatus('idle');
    setSearchError('');
    setDraftError('');
  };

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Artwork"
        title="Artworks"
        description="Every registered piece, opening to its own workspace."
      />

      <div role="tablist" aria-label="Artwork views" className="mb-6 flex gap-8 border-b border-wood-200">
        <button
          type="button"
          role="tab"
          id="artwork-list-tab-artworks"
          aria-selected={tab === 'artworks'}
          aria-controls="artwork-list-panel-artworks"
          className={tabButtonClass(tab === 'artworks')}
          onClick={() => setTab('artworks')}
        >
          Artworks
        </button>
        <button
          type="button"
          role="tab"
          id="artwork-list-tab-search"
          aria-selected={tab === 'search'}
          aria-controls="artwork-list-panel-search"
          className={tabButtonClass(tab === 'search')}
          onClick={() => setTab('search')}
        >
          Search
        </button>
      </div>

      {tab === 'artworks' && (
        <div id="artwork-list-panel-artworks" role="tabpanel" aria-labelledby="artwork-list-tab-artworks">
          <AdminSection title="Registered artworks" description="Every piece with a registered identity, most recently active first.">
            <ResultList
              status={listStatus}
              errorMessage={listError}
              results={listResults}
              emptyTitle="No artworks registered yet"
              emptyDescription="Register an artwork to see it here."
              loadingLabel="Loading artworks."
            />
          </AdminSection>
        </div>
      )}

      {tab === 'search' && (
        <div id="artwork-list-panel-search" role="tabpanel" aria-labelledby="artwork-list-tab-search">
          <AdminSection title="Find an artwork" description="Search by public code, artwork ID, title, or edition number.">
            <form className="mb-6 grid gap-4 sm:grid-cols-2" onSubmit={submitSearch} aria-label="Search artworks">
              <label htmlFor="artwork-list-public-code">
                <span className={labelClass}>Public code</span>
                <input
                  id="artwork-list-public-code"
                  className={inputClass}
                  value={searchDraft.publicCode}
                  onChange={event => setSearchDraft(draft => ({ ...draft, publicCode: event.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label htmlFor="artwork-list-artwork-id">
                <span className={labelClass}>Artwork ID</span>
                <input
                  id="artwork-list-artwork-id"
                  className={inputClass}
                  value={searchDraft.artworkId}
                  onChange={event => setSearchDraft(draft => ({ ...draft, artworkId: event.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label htmlFor="artwork-list-title">
                <span className={labelClass}>Title</span>
                <input
                  id="artwork-list-title"
                  className={inputClass}
                  value={searchDraft.title}
                  onChange={event => setSearchDraft(draft => ({ ...draft, title: event.target.value }))}
                  autoComplete="off"
                />
              </label>
              <label htmlFor="artwork-list-edition">
                <span className={labelClass}>Edition number</span>
                <input
                  id="artwork-list-edition"
                  className={inputClass}
                  inputMode="numeric"
                  value={searchDraft.editionNumber}
                  onChange={event => setSearchDraft(draft => ({ ...draft, editionNumber: event.target.value }))}
                  autoComplete="off"
                />
              </label>
              <div className="flex items-center gap-4 sm:col-span-2">
                <button type="submit" className={primaryButtonClass} disabled={searchStatus === 'loading'}>Search</button>
                <button type="button" className={quietButtonClass} onClick={clearSearch}>Clear</button>
              </div>
            </form>

            {draftError && <AdminAlert tone="error" live>{draftError}</AdminAlert>}

            {searchStatus === 'idle' && !draftError && (
              <AdminEmptyState title="Enter search criteria" description="Search by public code, artwork ID, title, or edition number to find a specific piece." />
            )}
            {searchStatus !== 'idle' && (
              <ResultList
                status={searchStatus}
                errorMessage={searchError}
                results={searchResults}
                emptyTitle="No matching artworks"
                emptyDescription="Adjust the search criteria and try again."
                loadingLabel="Searching artworks."
              />
            )}
          </AdminSection>

          <p className="mt-4">
            <Link className={linkClass} to="/admin/maintenance">Open full Maintenance detail for a piece</Link>
          </p>
        </div>
      )}
    </AdminPage>
  );
};

export default ArtworkList;
