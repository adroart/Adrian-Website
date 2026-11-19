import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  searchMaintenance,
  MaintenanceRequestError,
  type MaintenanceListItem,
} from '../../utils/adminRegistryMaintenance';
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader } from './AdminPage';
import './ArtworkList.css';

// Every screen here reads the same private piece registry that Maintenance
// already searches (GET /api/admin/maintenance, via the Maintenance client
// helpers). That endpoint already joins the catalog title onto each
// registered piece and is the one place Adrian can find a piece by public
// code, artwork ID, title, or edition number, so this page calls it
// directly rather than building a second search against the same rows.

type LoadStatus = 'loading' | 'ready' | 'error';

type SearchDraft = {
  publicCode: string;
  artworkId: string;
  title: string;
  editionNumber: string;
};

const EMPTY_DRAFT: SearchDraft = { publicCode: '', artworkId: '', title: '', editionNumber: '' };
const SEARCH_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'publicCode', label: 'Public code' },
  { key: 'artworkId', label: 'Artwork ID' },
  { key: 'editionNumber', label: 'Edition number' },
] as const;
const ARTWORK_LIST_PATH = '/admin/artworks';
const EDITION_ERROR = 'Edition number must be a whole number from 0 to 9999.';

type SearchResults = {
  status: LoadStatus;
  results: MaintenanceListItem[];
  error: string;
};

const LOADING_RESULTS: SearchResults = { status: 'loading', results: [], error: '' };

function searchDraftFromQuery(query: string): SearchDraft {
  const params = new URLSearchParams(query);
  const draft = { ...EMPTY_DRAFT };
  for (const { key } of SEARCH_FIELDS) draft[key] = params.get(key)?.trim() ?? '';
  return draft;
}

function validEdition(value: string): boolean {
  return !value || (/^\d+$/.test(value) && Number(value) <= 9999);
}

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

const ResultRow: React.FC<{ item: MaintenanceListItem; returnPath: string }> = ({ item, returnPath }) => (
  <li className="studio-artworks-row">
    <Link
      to={workspaceHref(item)}
      state={{ artworkListReturnPath: returnPath }}
      className="studio-artworks-record"
      aria-label={`Open record for ${item.title}, ${item.artworkId}, ${displayEdition(item.editionNumber)}, ${item.publicCode || 'no public code'}`}
    >
      <span className="studio-artworks-identity">
        <span className="studio-artworks-title">{item.title}</span>
        <span className="studio-artworks-meta">{item.artworkId} &middot; {displayEdition(item.editionNumber)}</span>
      </span>
      <span className="studio-artworks-meta studio-artworks-plate">
        {item.publicCode || 'No public code'} &middot; {stateLabel(item.plateStatus)}
      </span>
      <span className="btn btn-outline studio-artworks-button studio-artworks-open">Open record</span>
    </Link>
  </li>
);

const ResultList: React.FC<SearchResults & {
  returnPath: string;
  emptyTitle: string;
  emptyDescription: string;
  loadingLabel: string;
}> = ({ status, error, results, returnPath, emptyTitle, emptyDescription, loadingLabel }) => {
  if (status === 'loading') return <AdminAlert tone="info" live>{loadingLabel}</AdminAlert>;
  if (status === 'error') return <AdminAlert tone="error" live>{error}</AdminAlert>;
  if (!results.length) return <AdminEmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <ul className="studio-artworks-results">
      {results.map(item => <ResultRow key={item.id} item={item} returnPath={returnPath} />)}
    </ul>
  );
};

const ArtworkList: React.FC = () => {
  const { search, key: locationKey } = useLocation();
  const navigate = useNavigate();
  const submittedDraft = useMemo(() => searchDraftFromQuery(search), [search]);
  const returnPath = ARTWORK_LIST_PATH + search;
  const filtered = Object.values(submittedDraft).some(Boolean);
  const [searchDraft, setSearchDraft] = useState(submittedDraft);
  const [loaded, setLoaded] = useState<(SearchResults & { locationKey: string }) | null>(null);
  const [draftError, setDraftError] = useState('');
  const titleFieldRef = useRef<HTMLInputElement | null>(null);
  const visibleResults = loaded?.locationKey === locationKey ? loaded : LOADING_RESULTS;

  useEffect(() => {
    setSearchDraft(submittedDraft);
    setDraftError('');
  }, [submittedDraft]);

  useEffect(() => {
    const { editionNumber, ...textFilters } = submittedDraft;
    if (!validEdition(editionNumber)) {
      setLoaded({ locationKey, status: 'error', results: [], error: EDITION_ERROR });
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const filters = { ...textFilters, ...(editionNumber ? { editionNumber: Number(editionNumber) } : {}) };
    void searchMaintenance(filters, signal)
      .then((results) => {
        if (!signal.aborted) setLoaded({ locationKey, status: 'ready', results, error: '' });
      })
      .catch((error: unknown) => {
        if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        const fallback = filtered
          ? 'The search could not be completed. Try again.'
          : 'Artworks could not be loaded. Reload this page to try again.';
        setLoaded({ locationKey, status: 'error', results: [], error: messageFor(error, fallback) });
      });
    return () => controller.abort();
  }, [filtered, locationKey, submittedDraft]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const { key } of SEARCH_FIELDS) {
      const value = searchDraft[key].trim();
      if (value) params.set(key, value);
    }
    if (!validEdition(params.get('editionNumber') ?? '')) {
      setDraftError(EDITION_ERROR);
      return;
    }
    if (!params.size) {
      clearSearch();
      return;
    }
    const query = `?${params.toString()}`;
    setDraftError('');
    navigate(ARTWORK_LIST_PATH + query, { replace: query === search });
  };

  const clearSearch = () => {
    setSearchDraft(EMPTY_DRAFT);
    setDraftError('');
    if (search) navigate(ARTWORK_LIST_PATH);
  };

  const canClear = filtered || Object.values(searchDraft).some(Boolean);

  return (
    <AdminPage width="wide">
      <div className="studio-artworks">
        <AdminPageHeader
          title="Artworks"
          actions={<>
            <Link className="btn btn-primary studio-artworks-button" to="/admin/register">Register artwork</Link>
            <Link className="btn btn-outline btn btn-ghost studio-artworks-button" to="/admin/tools">Artwork tools</Link>
          </>}
        />

        <section aria-labelledby="studio-artworks-find">
          <h2 className="studio-artworks-heading" id="studio-artworks-find">Find artwork</h2>
          <form className="studio-artworks-search" role="search" onSubmit={submitSearch} aria-labelledby="studio-artworks-find">
            {SEARCH_FIELDS.map(({ key, label }) => (
              <div className="studio-artworks-field" key={key}>
                <label htmlFor={`artwork-list-${key}`}>{label}</label>
                <input
                  id={`artwork-list-${key}`}
                  className="input studio-artworks-input"
                  ref={key === 'title' ? titleFieldRef : undefined}
                  value={searchDraft[key]}
                  onChange={event => setSearchDraft(draft => ({ ...draft, [key]: event.target.value }))}
                  inputMode={key === 'editionNumber' ? 'numeric' : undefined}
                  autoComplete="off"
                />
              </div>
            ))}
            <div className="studio-artworks-search-actions">
              <button type="submit" className="btn btn-outline studio-artworks-button" disabled={filtered && visibleResults.status === 'loading'}>Search</button>
              {canClear && (
                <button type="button" className="btn btn-ghost studio-artworks-button" onClick={() => {
                  clearSearch();
                  titleFieldRef.current?.focus();
                }}>Clear</button>
              )}
            </div>
          </form>
          {draftError && <AdminAlert tone="error" live>{draftError}</AdminAlert>}
        </section>

        <section className="studio-artworks-list" aria-labelledby="studio-artworks-list-heading">
          <h2 className="studio-artworks-heading" id="studio-artworks-list-heading">
            {filtered ? 'Search results' : 'Registered artworks'}
          </h2>
          <p role="status" className="sr-only">
            {filtered && visibleResults.status === 'ready' && `${visibleResults.results.length} ${visibleResults.results.length === 1 ? 'artwork' : 'artworks'} found`}
          </p>
          <ResultList
            {...visibleResults}
            returnPath={returnPath}
            emptyTitle={filtered ? 'No matching artworks' : 'No artworks registered yet'}
            emptyDescription={filtered ? 'Adjust the search criteria and try again.' : 'Register an artwork to see it here.'}
            loadingLabel={filtered ? 'Searching artworks.' : 'Loading artworks.'}
          />
        </section>
      </div>
    </AdminPage>
  );
};

export default ArtworkList;
