import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { loadArtworkWorkspace } from '../../utils/artworkWorkspace';
import {
  buildAssignmentRequest,
  buildOverrideRequest,
  certificateAdminApi,
  overrideEditorDraft,
  projectEffectiveCertificate,
  type CertificateArtworkEditorState,
  type CertificateField,
  type CertificateOverride,
  type EffectiveCertificate,
} from '../../utils/certificateContent';
import { loadChoosableArtworks } from '../registry/artworkChoices';
import { AdminPage } from './AdminPage';
import './CertificateEditor.css';
import CertificateTemplateChoices from './CertificateTemplateChoices';

type ArtworkChoice = { id: string; title: string };
type Template = { templateId: string; name: string; content: EffectiveCertificate; version: number };

const fieldLabels: Array<[CertificateField, string]> = [
  ['materials', 'Materials'],
  ['makers', 'Makers and roles'],
  ['origin', 'Origin'],
  ['techniques', 'Techniques'],
  ['yearWording', 'Year wording'],
  ['editionWording', 'Edition wording'],
  ['certificateWording', 'Certificate wording'],
  ['openingWording', 'Opening wording'],
];

function parseLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function parseTemplateContent(draft: Record<CertificateField, string>): EffectiveCertificate {
  const makers = parseLines(draft.makers).flatMap((line) => {
    const [name, ...roleParts] = line.split('|').map((part) => part.trim());
    const role = roleParts.join(' | ');
    return name && role ? [{ name, role }] : [];
  });
  return projectEffectiveCertificate({
    materials: parseLines(draft.materials),
    makers,
    origin: draft.origin,
    techniques: parseLines(draft.techniques),
    yearWording: draft.yearWording,
    editionWording: draft.editionWording,
    certificateWording: draft.certificateWording,
    openingWording: draft.openingWording,
  });
}

const views = [
  ['artwork', 'Artwork facts'],
  ['templates', 'Templates'],
  ['assign', 'Assign template'],
] as const;
const pageSize = 6;
const fieldHints: Partial<Record<CertificateField, string>> = {
  materials: 'One material per line',
  techniques: 'One technique per line',
  makers: 'One maker per line, in Name | Role format',
};

function factText(value: EffectiveCertificate[CertificateField]) {
  return Array.isArray(value)
    ? value.map(item => typeof item === 'string' ? item : `${item.name} · ${item.role}`).join(', ')
    : value;
}

const fieldModes = [
  { value: 'inherit', label: 'Inherit template' },
  { value: 'override', label: 'Use a custom value' },
  { value: 'suppress', label: 'Omit from certificate' },
] as const;

function CertificatePreview({ facts, empty }: { facts: EffectiveCertificate; empty: string }) {
  const entries = fieldLabels.filter(([field]) => facts[field] !== undefined);
  if (!entries.length) return <p className="cert-note">{empty}</p>;
  return <dl className="cert-preview">
    {entries.map(([field, label]) => <div key={field}><dt>{label}</dt><dd>{factText(facts[field])}</dd></div>)}
  </dl>;
}

const emptyDraft = Object.fromEntries(fieldLabels.map(([field]) => [field, ''])) as Record<CertificateField, string>;

export const CertificateEditor: React.FC<{ artworks: ArtworkChoice[] }> = ({ artworks }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const requestedView = searchParams.get('view');
  const view = requestedView === 'templates' || requestedView === 'assign' || requestedView === 'new-template'
    || requestedView === 'choose-artwork' || requestedView === 'choose-template' ? requestedView : 'artwork';
  const editingFact = view === 'artwork' ? fieldLabels.find(([field]) => field === searchParams.get('field')) : undefined;
  const overrideField = editingFact?.[0] ?? 'materials';

  function viewHref(target: string, artworkId?: string, field?: CertificateField) {
    const query = new URLSearchParams(searchParams);
    query.delete('field');
    if (target === 'artwork') query.delete('view');
    else query.set('view', target);
    if (artworkId) query.set('artworkId', artworkId);
    if (field) query.set('field', field);
    return { pathname: location.pathname, search: query.toString() };
  }
  const queryArtworkIds = searchParams.getAll('artworkId');
  const linkedArtworkId = queryArtworkIds.length === 1 ? queryArtworkIds[0].trim() : '';
  const linkedInArchive = artworks.some(artwork => artwork.id === linkedArtworkId);
  const [registryArtworks, setRegistryArtworks] = useState<ArtworkChoice[] | null>(null);
  const [linkedArtwork, setLinkedArtwork] = useState<ArtworkChoice | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [libraryTemplateId, setLibraryTemplateId] = useState('');
  const [artworkReload, setArtworkReload] = useState(0);
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<string[]>(
    linkedArtworkId ? [linkedArtworkId] : [],
  );
  const overrideArtworkId = linkedArtworkId;
  const [overrideMode, setOverrideMode] = useState<CertificateOverride['mode']>('inherit');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideVersions, setOverrideVersions] = useState<Record<string, number>>({});
  const [loadedArtworkState, setArtworkState] = useState<CertificateArtworkEditorState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const assignmentKey = useRef<string | null>(null);
  const assignmentEdited = useRef(false);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [templateLoadFailed, setTemplateLoadFailed] = useState(false);
  const [templateReload, setTemplateReload] = useState(0);
  const [artworkLoading, setArtworkLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showSelected, setShowSelected] = useState(false);
  const [artworkPage, setArtworkPage] = useState(1);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(1);
  const choosingArtwork = view === 'choose-artwork' || (view === 'artwork' && !overrideArtworkId);

  function beginSave() {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    return true;
  }

  function finishSave() {
    inFlight.current = false;
    setBusy(false);
  }

  const artworkChoices = useMemo(() => {
    const byId = new Map(artworks.map(artwork => [artwork.id, artwork]));
    for (const artwork of registryArtworks ?? []) {
      if (!byId.has(artwork.id)) byId.set(artwork.id, artwork);
    }
    if (linkedArtwork?.id === linkedArtworkId && !byId.has(linkedArtworkId)) {
      byId.set(linkedArtworkId, linkedArtwork);
    }
    return [...byId.values()];
  }, [artworks, registryArtworks, linkedArtwork, linkedArtworkId]);
  const selectedArtwork = artworkChoices.find(artwork => artwork.id === overrideArtworkId);
  const artworkState = selectedArtwork && loadedArtworkState?.artworkId === selectedArtwork.id
    ? loadedArtworkState : null;
  const hasAssignmentSelection = selectedArtworkIds.length > 0
    && selectedArtworkIds.every(id => artworkChoices.some(artwork => artwork.id === id));

  useEffect(() => {
    let current = true;
    void loadChoosableArtworks().then(result => {
      if (current) setRegistryArtworks(result.filter(artwork => artwork.draft));
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (!linkedArtworkId || linkedInArchive || !registryArtworks
      || registryArtworks.some(artwork => artwork.id === linkedArtworkId)) return;
    // The workspace is also available when the registry tools are gated.
    const controller = new AbortController();
    void loadArtworkWorkspace({ artworkId: linkedArtworkId }, controller.signal)
      .then(({ catalog }) => {
        if (!controller.signal.aborted && catalog?.artworkId === linkedArtworkId) {
          setLinkedArtwork({ id: catalog.artworkId, title: catalog.title });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('The linked catalog artwork could not be loaded.');
      });
    return () => controller.abort();
  }, [linkedArtworkId, linkedInArchive, registryArtworks]);

  useEffect(() => {
    if (assignmentEdited.current) return;
    assignmentKey.current = null;
    setSelectedArtworkIds(linkedArtworkId ? [linkedArtworkId] : []);
  }, [linkedArtworkId]);

  useEffect(() => {
    let current = true;
    setTemplateLoading(true);
    setTemplateLoadFailed(false);
    certificateAdminApi.listTemplates()
      .then((body) => {
        if (!current) return;
        const loaded = (body as { templates?: Template[] }).templates ?? [];
        setTemplates(loaded);
        setLibraryTemplateId((current) => current || loaded[0]?.templateId || '');
      })
      .catch(() => { if (current) setTemplateLoadFailed(true); })
      .finally(() => { if (current) setTemplateLoading(false); });
    return () => { current = false; };
  }, [templateReload]);

  useEffect(() => {
    if (!overrideArtworkId) {
      setArtworkState(null);
      setArtworkLoading(false);
      return;
    }
    let current = true;
    setArtworkLoading(true);
    setArtworkState(null);
    certificateAdminApi.getArtworkState(overrideArtworkId)
      .then((state) => {
        if (!current) return;
        if (state.artworkId !== overrideArtworkId) throw new Error('certificate_artwork_mismatch');
        setArtworkState(state);

        setOverrideVersions((versions) => ({
          ...versions,
          ...Object.fromEntries(Object.entries(state.overrides).map(([field, override]) => [
            `${state.artworkId}:${field}`,
            override?.version ?? 0,
          ])),
        }));
      })
      .catch(() => {
        if (current) setError('The current certificate state could not be loaded.');
      })
      .finally(() => { if (current) setArtworkLoading(false); });
    return () => { current = false; };
  }, [overrideArtworkId, artworkReload]);

  useEffect(() => {
    if (!artworkState) return;
    const next = overrideEditorDraft(artworkState, overrideField);
    setOverrideMode(next.mode);
    setOverrideValue(next.value);
  }, [artworkState, overrideField]);

  const selectedTemplate = templates.find((template) => template.templateId === libraryTemplateId);
  const draftPreview = useMemo(() => parseTemplateContent(draft), [draft]);
  const normalizedSearch = (choosingArtwork ? pickerSearch : search).trim().toLowerCase();
  const filteredArtworks = useMemo(() => artworkChoices.filter(artwork =>
    (choosingArtwork || !showSelected || selectedArtworkIds.includes(artwork.id))
    && `${artwork.title} ${artwork.id}`.toLowerCase().includes(normalizedSearch),
  ), [artworkChoices, choosingArtwork, showSelected, selectedArtworkIds, normalizedSearch]);
  const lastPage = Math.max(1, Math.ceil(filteredArtworks.length / pageSize));
  const currentPage = Math.min(choosingArtwork ? pickerPage : artworkPage, lastPage);
  const shownArtworks = filteredArtworks.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const assignedTemplate = templates.find(template => template.templateId === artworkState?.assignment?.templateId);
  const assignmentTemplate = templates.find(template => template.templateId === selectedTemplateId);

  function chooseTemplate(id: string) {
    if (selectedTemplateId !== id) assignmentKey.current = null;
    setSelectedTemplateId(id);
  }

  async function createTemplate(event: React.FormEvent) {
    event.preventDefault();
    if (!beginSave()) return;
    try {
      const body = await certificateAdminApi.createTemplate({
        name: templateName, content: parseTemplateContent(draft),
      }) as { template: Template };
      setTemplates((current) => [...current, body.template]);
      setLibraryTemplateId(body.template.templateId);
      setTemplateName(''); setDraft({ ...emptyDraft });
      setMessage('Template created.');
      navigate(viewHref('templates'), { state: location.state });
    } catch { setError('The template could not be created.'); }
    finally { finishSave(); }
  }

  async function assignTemplate() {
    if (!selectedTemplateId || !hasAssignmentSelection || !beginSave()) return;
    assignmentKey.current ||= crypto.randomUUID();
    try {
      await certificateAdminApi.assignTemplate(buildAssignmentRequest({
        templateId: selectedTemplateId,
        artworkIds: selectedArtworkIds,
        idempotencyKey: assignmentKey.current,
      }));
      assignmentKey.current = null;
      if (overrideArtworkId && selectedArtworkIds.includes(overrideArtworkId)) {
        setArtworkReload(current => current + 1);
      }
      setMessage('Template assigned. Individual artwork overrides were kept.');
    } catch { setError('The assignment could not be confirmed. Retry without changing the selection.'); }
    finally { finishSave(); }
  }

  async function refreshArtworkState(artworkId: string) {
    const next = await certificateAdminApi.getArtworkState(artworkId);
    if (next.artworkId !== artworkId) throw new Error('certificate_artwork_mismatch');
    setArtworkState(current => current?.artworkId === artworkId ? next : current);
  }

  async function saveOverride() {
    if (!artworkState || !editingFact) return;
    const key = `${overrideArtworkId}:${overrideField}`;
    let override: CertificateOverride = { mode: overrideMode } as CertificateOverride;
    if (overrideMode === 'override') {
      const value = overrideField === 'materials' || overrideField === 'techniques'
        ? parseLines(overrideValue)
        : overrideField === 'makers'
          ? parseLines(overrideValue).flatMap((line) => {
            const [name, ...parts] = line.split('|').map((part) => part.trim());
            const role = parts.join(' | ');
            return name && role ? [{ name, role }] : [];
          })
          : overrideValue;
      override = { mode: 'override', value };
      if ((Array.isArray(value) && value.length === 0)
        || (typeof value === 'string' && !value.trim())) {
        setError('Enter a replacement value, or choose Omit from certificate.');
        return;
      }
    }
    if (!beginSave()) return;
    try {
      const body = await certificateAdminApi.setOverride(buildOverrideRequest({
        artworkId: overrideArtworkId,
        field: overrideField,
        override,
        expectedVersion: overrideVersions[key] ?? 0,
      })) as { override: { version: number } };
      setOverrideVersions((current) => ({ ...current, [key]: body.override.version }));
      await refreshArtworkState(overrideArtworkId);
      setMessage('Artwork override saved.');
      navigate(viewHref('artwork'), { state: location.state });
    } catch (failure) {
      setError(failure instanceof Error && failure.message === 'version_conflict'
        ? 'This field changed after you opened it. Reload before saving again.'
        : 'The field could not be confirmed. Reload the artwork to check its saved value.');
    } finally { finishSave(); }
  }

  return (
    <AdminPage width="wide">
      <div className="studio-cert">
        <header className="cert-header">
          <h1>Certificates</h1>
          <nav className="cert-nav" aria-label="Certificate tools">
            {views.map(([target, label]) => (
              <Link key={target} to={viewHref(target)} state={location.state}
                aria-current={view === target
                || (target === 'artwork' && view === 'choose-artwork')
                || (target === 'templates' && view === 'new-template')
                || (target === 'assign' && view === 'choose-template') ? 'page' : undefined}>{label}</Link>
            ))}
          </nav>
        </header>
        {templateLoadFailed && <div className="cert-message">
          <p role="alert">Certificate templates could not be loaded.</p>
          <button type="button" className="cert-action" disabled={busy}
            onClick={() => setTemplateReload(current => current + 1)}>Retry loading templates</button>
        </div>}
        {error && <div className="cert-message">
          <p role="alert">{error}</p>
          {view === 'artwork' && overrideArtworkId && !artworkLoading && <button type="button" className="cert-action"
            onClick={() => { setError(null); setArtworkReload(current => current + 1); }}>Reload artwork facts</button>}
        </div>}
        {message && <p className="cert-message" role="status">{message}</p>}

        {choosingArtwork && (
          <section className="cert-pane cert-assignment" aria-labelledby="cert-artwork-picker">
            <h2 id="cert-artwork-picker">Choose an artwork</h2>
            <div className="cert-field">
              <label className="cert-label" htmlFor="cert-artwork-search">Find artworks</label>
              <input className="cert-control" id="cert-artwork-search" type="search" placeholder="Title or catalog ID"
                value={pickerSearch} onChange={event => { setPickerSearch(event.target.value); setPickerPage(1); }} />
            </div>
            {shownArtworks.length ? <ul className="cert-choice-list" aria-label="Artwork results">
              {shownArtworks.map(artwork => <li key={artwork.id}>
                <Link className="cert-choice-row" to={viewHref('artwork', artwork.id)} state={location.state}
                  onClick={() => { setError(null); setMessage(null); }}>
                  <span>{artwork.title}</span><span className="cert-meta">{artwork.id}</span>
                </Link>
              </li>)}
            </ul> : <p className="cert-note">No artworks match this search.</p>}
            {lastPage > 1 && <div className="cert-actions" role="group" aria-label="Artwork results pages">
              <button className="cert-action" type="button" disabled={currentPage === 1} onClick={() => setPickerPage(currentPage - 1)}>Previous</button>
              <span className="cert-note">Page {currentPage} of {lastPage}</span>
              <button className="cert-action" type="button" disabled={currentPage === lastPage} onClick={() => setPickerPage(currentPage + 1)}>Next</button>
            </div>}
          </section>
        )}

        {view === 'artwork' && !choosingArtwork && (
          <section className="cert-pane cert-facts" aria-labelledby="cert-artwork-title">
            <div className="cert-context">
              <h2 id="cert-artwork-title">{selectedArtwork ? `${selectedArtwork.title} · ${selectedArtwork.id}` : overrideArtworkId}</h2>
              <Link className="cert-action" to={viewHref('choose-artwork')} state={location.state}>Change artwork</Link>
            </div>
            {artworkState ? editingFact ? (
              <div className="cert-work">
                <section className="cert-pane" aria-labelledby="cert-edit-heading">
                  <h3 id="cert-edit-heading">{editingFact[1]}</h3>
                  <form className="cert-pane" onSubmit={event => { event.preventDefault(); void saveOverride(); }}>
                    <fieldset className="cert-modes" disabled={busy}>
                      <legend>What appears on the certificate</legend>
                      {fieldModes.map(mode => <label className="cert-mode" key={mode.value}>
                        <span><input type="radio" name="certificate-mode" value={mode.value} checked={overrideMode === mode.value}
                          onChange={() => setOverrideMode(mode.value)} /></span>
                        {mode.label}
                      </label>)}
                    </fieldset>
                    {overrideMode === 'override' && <div className="cert-field">
                      <label className="cert-label" htmlFor="cert-value">Replacement value</label>
                      <textarea id="cert-value" className="cert-control" rows={3} value={overrideValue} disabled={busy}
                        aria-describedby={fieldHints[overrideField] ? 'cert-value-hint' : undefined}
                        onChange={event => setOverrideValue(event.target.value)} />
                      {fieldHints[overrideField] && <p className="cert-note" id="cert-value-hint">{fieldHints[overrideField]}</p>}
                    </div>}
                    <div className="cert-actions">
                      <button type="submit" className="cert-action cert-primary" disabled={busy}>{busy ? 'Saving…' : 'Save field'}</button>
                      <Link className="cert-action" to={viewHref('artwork')} state={location.state}>Back to facts</Link>
                    </div>
                  </form>
                </section>
                <section className="cert-pane cert-preview-pane" aria-labelledby="cert-current-heading">
                  <h3 id="cert-current-heading">Current public value</h3>
                  <p className="cert-note">{factText(artworkState.effective[overrideField]) || 'This fact does not appear on the certificate.'}</p>
                  <p className="cert-note">Applies to all editions of this artwork.</p>
                </section>
              </div>
            ) : (
              <section aria-labelledby="cert-public-heading">
                <h3 id="cert-public-heading">Public certificate</h3>
                <div className="cert-context cert-facts-meta">
                  <p className="cert-note">Applies to all editions of this artwork.</p>
                  <p className="cert-note">{assignedTemplate ? `Template · ${assignedTemplate.name}`
                    : artworkState.assignment ? 'Template assigned' : 'No template assigned'}</p>
                </div>
                <ul className="cert-choice-list" aria-label="Certificate facts">
                  {fieldLabels.map(([field, label]) => <li key={field}>
                    <Link className="cert-choice-row cert-fact-row" to={viewHref('artwork', overrideArtworkId, field)} state={location.state}>
                      <span>{label}</span>
                      <span className="cert-meta">{factText(artworkState.effective[field])
                        || (artworkState.overrides[field]?.mode === 'suppress' ? 'Omitted' : 'No value')}</span>
                      <span className="cert-fact-action">Edit</span>
                    </Link>
                  </li>)}
                </ul>
              </section>
            ) : <p className="cert-note" role="status">{artworkLoading ? 'Loading certificate facts…' : 'Certificate facts could not be shown.'}</p>}
          </section>
        )}

        {view === 'templates' && (
          <section className="cert-pane" aria-labelledby="cert-template-heading">
            <div className="cert-actions">
              <h2 id="cert-template-heading">Saved templates</h2>
              <Link className="cert-action cert-primary" to={viewHref('new-template')} state={location.state}>New template</Link>
            </div>
            {templateLoading ? <p role="status" className="cert-note">Loading templates…</p>
              : templateLoadFailed ? null : templates.length ? <>
                <CertificateTemplateChoices templates={templates} selectedId={libraryTemplateId}
                  onSelect={setLibraryTemplateId} disabled={busy} />
                <CertificatePreview facts={selectedTemplate?.content ?? {}} empty="This template has no saved facts." />
                <div className="cert-actions"><Link className="cert-action" to={viewHref('assign')} state={location.state}
                  onClick={() => chooseTemplate(libraryTemplateId)}>Assign this template</Link></div>
              </> : <p className="cert-note">Create a template for facts that apply to more than one artwork.</p>}
          </section>
        )}

        {view === 'new-template' && (
          <div className="cert-work">
            <section className="cert-pane" aria-labelledby="cert-create-heading">
              <h2 id="cert-create-heading">New template</h2>
              <form className="cert-form-grid" onSubmit={createTemplate}>
                <div className="cert-field cert-wide">
                  <label className="cert-label" htmlFor="cert-template-name">Template name</label>
                  <input id="cert-template-name" className="cert-control" required value={templateName}
                    disabled={busy} onChange={event => setTemplateName(event.target.value)} />
                </div>
                {fieldLabels.map(([field, label]) => <div key={field} className={`cert-field${field === 'certificateWording' || field === 'openingWording' ? ' cert-wide' : ''}`}>
                  <label className="cert-label" htmlFor={`cert-draft-${field}`}>{label}</label>
                  {fieldHints[field] || field === 'certificateWording' || field === 'openingWording'
                    ? <textarea className="cert-control" id={`cert-draft-${field}`} rows={2} value={draft[field]} disabled={busy}
                        aria-describedby={fieldHints[field] ? `cert-hint-${field}` : undefined}
                        onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />
                    : <input className="cert-control" id={`cert-draft-${field}`} value={draft[field]} disabled={busy}
                        onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} />}
                  {fieldHints[field] && <p className="cert-note" id={`cert-hint-${field}`}>{fieldHints[field]}</p>}
                </div>)}
                <div className="cert-actions cert-wide">
                  <button type="submit" className="cert-action cert-primary" disabled={busy}>{busy ? 'Creating…' : 'Create template'}</button>
                  <Link className="cert-action" to={viewHref('templates')} state={location.state}>Back to templates</Link>
                </div>
              </form>
            </section>
            <section className="cert-pane cert-preview-pane" aria-labelledby="cert-template-preview-heading">
              <h2 id="cert-template-preview-heading">Template preview</h2>
              <CertificatePreview facts={draftPreview} empty="The facts you enter will appear here." />
            </section>
          </div>
        )}

        {view === 'choose-template' && (
          <section className="cert-pane cert-assignment" aria-labelledby="cert-choose-template">
            <h2 id="cert-choose-template">Choose a template</h2>
            {templateLoading ? <p role="status" className="cert-note">Loading templates…</p>
              : !templateLoadFailed && <CertificateTemplateChoices templates={templates} selectedId={selectedTemplateId} disabled={busy}
                onSelect={id => { chooseTemplate(id); navigate(viewHref('assign'), { state: location.state }); }} />}
            <div className="cert-actions">
              <Link className="cert-action" to={viewHref('assign')} state={location.state}>Back to assignment</Link>
              {!templateLoading && !templateLoadFailed && templates.length === 0 && <Link className="cert-action" to={viewHref('new-template')} state={location.state}>New template</Link>}
            </div>
          </section>
        )}

        {view === 'assign' && (
          <section className="cert-pane cert-assignment" aria-labelledby="cert-assign-heading">
            <h2 id="cert-assign-heading">Assign a template</h2>
            {templateLoading || templates.length > 0 ? (
              <div className="cert-context">
                <p className="cert-note">{templateLoading ? 'Loading templates…' : assignmentTemplate?.name ?? 'No template selected'}</p>
                <Link className="cert-action" to={viewHref('choose-template')} state={location.state}>
                  {assignmentTemplate ? 'Change template' : 'Choose template'}
                </Link>
              </div>
           ) : !templateLoadFailed && <div className="cert-actions">
              <p className="cert-note">Create a template before assigning it.</p>
              <Link className="cert-action" to={viewHref('new-template')} state={location.state}>New template</Link>
            </div>}
            <div className="cert-field">
              <label className="cert-label" htmlFor="cert-search">Find artworks</label>
              <input className="cert-control" id="cert-search" type="search" placeholder="Title or catalog ID"
                value={search} onChange={event => { setSearch(event.target.value); setArtworkPage(1); }} />
            </div>
            <div className="cert-assignment-actions">
              <div className="cert-actions">
                <span className="cert-selection-count" role="status">{selectedArtworkIds.length} selected</span>
                <button type="button" className="cert-action" aria-pressed={showSelected} onClick={() => {
                  if (!showSelected) setSearch('');
                  setShowSelected(!showSelected);
                  setArtworkPage(1);
                }}>Selected only</button>
              </div>
              {templates.length > 0 && <button type="button" className="cert-action cert-primary" onClick={assignTemplate}
                aria-describedby="cert-assign-scope" disabled={busy || !selectedTemplateId || !hasAssignmentSelection}>{busy ? 'Assigning…' : 'Assign to selected artwork'}</button>}
            </div>
            {templates.length > 0 && <p className="cert-note" id="cert-assign-scope">Existing artwork overrides are kept.</p>}
            {shownArtworks.length ? <ul className="cert-picker" aria-label="Artwork results">
              {shownArtworks.map(artwork => <li key={artwork.id}>
                <label className="cert-picker-row">
                  <span><input type="checkbox" disabled={busy} checked={selectedArtworkIds.includes(artwork.id)}
                    onChange={event => {
                      assignmentEdited.current = true;
                      assignmentKey.current = null;
                      setSelectedArtworkIds(current => event.target.checked
                        ? [...current, artwork.id] : current.filter(id => id !== artwork.id));
                    }} /></span>
                  <span>{artwork.title} <small>· {artwork.id}</small></span>
                </label>
              </li>)}
            </ul> : <p className="cert-note">{showSelected ? 'No selected artworks match this view.' : 'No artworks match this search.'}</p>}
            {lastPage > 1 && <div className="cert-actions" role="group" aria-label="Artwork results pages">
              <button className="cert-action" type="button" disabled={currentPage === 1} onClick={() => setArtworkPage(currentPage - 1)}>Previous</button>
              <span className="cert-note" aria-live="polite">Page {currentPage} of {lastPage}</span>
              <button className="cert-action" type="button" disabled={currentPage === lastPage} onClick={() => setArtworkPage(currentPage + 1)}>Next</button>
            </div>}
          </section>
        )}
      </div>
    </AdminPage>
  );
};

export default CertificateEditor;
