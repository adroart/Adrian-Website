import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { AdminAlert, AdminPage, AdminPageHeader, AdminSection } from './AdminPage';

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

const emptyDraft = Object.fromEntries(fieldLabels.map(([field]) => [field, ''])) as Record<CertificateField, string>;

export const CertificateEditor: React.FC<{ artworks: ArtworkChoice[] }> = ({ artworks }) => {
  const [searchParams] = useSearchParams();
  const queryArtworkIds = searchParams.getAll('artworkId');
  const linkedArtworkId = queryArtworkIds.length === 1 ? queryArtworkIds[0] : '';
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [draft, setDraft] = useState({ ...emptyDraft });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<string[]>(
    linkedArtworkId ? [linkedArtworkId] : [],
  );
  const [overrideArtworkId, setOverrideArtworkId] = useState(linkedArtworkId);
  const [overrideField, setOverrideField] = useState<CertificateField>('materials');
  const [overrideMode, setOverrideMode] = useState<CertificateOverride['mode']>('inherit');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideVersions, setOverrideVersions] = useState<Record<string, number>>({});
  const [artworkState, setArtworkState] = useState<CertificateArtworkEditorState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const assignmentKey = useRef<string | null>(null);

  useEffect(() => {
    if (!linkedArtworkId) return;
    setOverrideArtworkId(linkedArtworkId);
    setSelectedArtworkIds([linkedArtworkId]);
  }, [linkedArtworkId]);

  useEffect(() => {
    certificateAdminApi.listTemplates()
      .then((body) => {
        const loaded = (body as { templates?: Template[] }).templates ?? [];
        setTemplates(loaded);
        setSelectedTemplateId((current) => current || loaded[0]?.templateId || '');
      })
      .catch(() => setError('Certificate templates could not be loaded.'));
  }, []);

  useEffect(() => {
    if (!overrideArtworkId) {
      setArtworkState(null);
      return;
    }
    let current = true;
    setArtworkState(null);
    certificateAdminApi.getArtworkState(overrideArtworkId)
      .then((state) => {
        if (!current) return;
        setArtworkState(state);
        if (state.assignment?.templateId) setSelectedTemplateId(state.assignment.templateId);
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
      });
    return () => { current = false; };
  }, [overrideArtworkId]);

  useEffect(() => {
    if (!artworkState) return;
    const next = overrideEditorDraft(artworkState, overrideField);
    setOverrideMode(next.mode);
    setOverrideValue(next.value);
  }, [artworkState, overrideField]);

  const selectedTemplate = templates.find((template) => template.templateId === selectedTemplateId);
  const draftPreview = useMemo(() => parseTemplateContent(draft), [draft]);
  const preview = useMemo(
    () => artworkState
      ? projectEffectiveCertificate(artworkState.effective)
      : Object.keys(draftPreview).length > 0
        ? draftPreview
        : projectEffectiveCertificate(selectedTemplate?.content ?? {}),
    [artworkState, draftPreview, selectedTemplate],
  );

  async function createTemplate(event: React.FormEvent) {
    event.preventDefault(); setError(null); setMessage(null);
    try {
      const body = await certificateAdminApi.createTemplate({
        name: templateName, content: parseTemplateContent(draft),
      }) as { template: Template };
      setTemplates((current) => [...current, body.template]);
      setSelectedTemplateId(body.template.templateId);
      setTemplateName(''); setDraft({ ...emptyDraft });
      setMessage('Template created.');
    } catch { setError('The template could not be created.'); }
  }

  async function assignTemplate() {
    setError(null); setMessage(null);
    assignmentKey.current ||= crypto.randomUUID();
    try {
      await certificateAdminApi.assignTemplate(buildAssignmentRequest({
        templateId: selectedTemplateId,
        artworkIds: selectedArtworkIds,
        idempotencyKey: assignmentKey.current,
      }));
      assignmentKey.current = null;
      if (overrideArtworkId && selectedArtworkIds.includes(overrideArtworkId)) {
        setArtworkState(await certificateAdminApi.getArtworkState(overrideArtworkId));
      }
      setMessage('Template assigned to the selected artwork. Individual overrides were preserved.');
    } catch { setError('The assignment could not be confirmed. Retry without changing the selection.'); }
  }

  async function saveOverride() {
    setError(null); setMessage(null);
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
        setError('Enter a replacement value, or choose Suppress.');
        return;
      }
    }
    try {
      const body = await certificateAdminApi.setOverride(buildOverrideRequest({
        artworkId: overrideArtworkId,
        field: overrideField,
        override,
        expectedVersion: overrideVersions[key] ?? 0,
      })) as { override: { version: number } };
      setOverrideVersions((current) => ({ ...current, [key]: body.override.version }));
      setArtworkState(await certificateAdminApi.getArtworkState(overrideArtworkId));
      setMessage('Artwork override saved.');
    } catch { setError('This field changed after it was opened. Refresh before saving again.'); }
  }

  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Certificate content" description="Reuse recorded facts and wording, then tune only the artwork that differs." />
      {error && <AdminAlert tone="error">{error}</AdminAlert>}
      {message && <AdminAlert tone="success">{message}</AdminAlert>}

      <AdminSection title="Create template" description="Blank values stay absent from public certificates.">
        <form onSubmit={createTemplate}>
          <label>Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} required /></label>
          {fieldLabels.map(([field, label]) => (
            <label key={field}>{label}
              <textarea
                value={draft[field]}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
                placeholder={field === 'makers' ? 'Name | role, one maker per line' : undefined}
              />
            </label>
          ))}
          <button type="submit">Create template</button>
        </form>
      </AdminSection>

      <AdminSection title="Assign template" description="Bulk assignment preserves every per-artwork override.">
        <label>Template
          <select value={selectedTemplateId} onChange={(event) => { setSelectedTemplateId(event.target.value); assignmentKey.current = null; }}>
            <option value="">Choose a template</option>
            {templates.map((template) => <option key={template.templateId} value={template.templateId}>{template.name}</option>)}
          </select>
        </label>
        <fieldset><legend>Artwork selection</legend>
          {artworks.map((artwork) => (
            <label key={artwork.id}>
              <input type="checkbox" checked={selectedArtworkIds.includes(artwork.id)} onChange={(event) => {
                assignmentKey.current = null;
                setSelectedArtworkIds((current) => event.target.checked
                  ? [...current, artwork.id]
                  : current.filter((id) => id !== artwork.id));
              }} /> {artwork.title} · {artwork.id}
            </label>
          ))}
        </fieldset>
        <button type="button" onClick={assignTemplate} disabled={!selectedTemplateId || selectedArtworkIds.length === 0}>Assign to selected artwork</button>
      </AdminSection>

      <AdminSection title="Artwork override" description="Each field can Inherit, Override, or Suppress the template value.">
        <label>Artwork<select value={overrideArtworkId} onChange={(event) => setOverrideArtworkId(event.target.value)}>
          <option value="">Choose artwork</option>
          {artworks.map((artwork) => <option key={artwork.id} value={artwork.id}>{artwork.title} · {artwork.id}</option>)}
        </select></label>
        <label>Field<select value={overrideField} onChange={(event) => setOverrideField(event.target.value as CertificateField)}>
          {fieldLabels.map(([field, label]) => <option key={field} value={field}>{label}</option>)}
        </select></label>
        <fieldset><legend>Field behavior</legend>
          {(['inherit', 'override', 'suppress'] as const).map((mode) => (
            <label key={mode}><input type="radio" name="override-mode" checked={overrideMode === mode} onChange={() => setOverrideMode(mode)} /> {mode === 'inherit' ? 'Inherit' : mode === 'override' ? 'Override' : 'Suppress'}</label>
          ))}
        </fieldset>
        {overrideMode === 'override' && <label>Replacement value<textarea value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} /></label>}
        <button type="button" onClick={saveOverride} disabled={!overrideArtworkId}>Save field</button>
      </AdminSection>

      <AdminSection title="Effective preview" description="This is the public content after inheritance, overrides, suppression, and blank-value omission.">
        {Object.keys(preview).length === 0 ? <p>No recorded certificate values.</p> : <pre>{JSON.stringify(preview, null, 2)}</pre>}
      </AdminSection>
    </AdminPage>
  );
};

export default CertificateEditor;
